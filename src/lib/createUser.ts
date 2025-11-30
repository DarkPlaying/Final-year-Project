import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase"; // Main DB instance (authenticated as Admin)

interface CreateUserParams {
    email: string;
    password: string;
    role: string;
    full_name?: string;
    department?: string;
    hashedPassword?: string;
}

/**
 * Creates a new user in the Main Firebase Project (Auth & Firestore)
 * and creates a corresponding document in the Secondary Firebase Project's Firestore.
 * Handles restoration of deleted users if they still exist in Auth.
 * 
 * @param params User creation parameters
 * @returns Object containing UID and restoration status
 */
export const createUserInBothSystems = async (params: CreateUserParams): Promise<{ uid: string; isRestored: boolean }> => {
    const { email, password, role, full_name, department, hashedPassword } = params;
    const emailLower = email.toLowerCase();
    let isRestored = false;

    // 1. Initialize Temporary Main App for Auth Creation
    // We use a temp app to avoid signing out the currently logged-in Admin
    const tempMainApp = initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
    }, `TempMainApp-${Date.now()}`);

    // 2. Initialize Temporary Secondary App for Auth & Firestore
    const tempSecondaryApp = initializeApp({
        apiKey: import.meta.env.VITE_ATTENDANCE_API_KEY,
        authDomain: import.meta.env.VITE_ATTENDANCE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_ATTENDANCE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_ATTENDANCE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_ATTENDANCE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_ATTENDANCE_APP_ID
    }, `TempSecondaryApp-${Date.now()}`);

    let mainUid = '';

    try {
        // --- Step A: Create User in Main Auth ---
        const mainAuth = getAuth(tempMainApp);
        try {
            const mainCred = await createUserWithEmailAndPassword(mainAuth, email, password);
            mainUid = mainCred.user.uid;
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                // Try to find in deleted_users
                const deletedRef = doc(db, 'deleted_users', emailLower);
                const deletedSnap = await getDoc(deletedRef);
                if (deletedSnap.exists()) {
                    mainUid = deletedSnap.data().uid;
                    isRestored = true;
                } else {
                    throw new Error(`User ${email} already exists in Auth system but no restore record found.`);
                }
            } else {
                throw error;
            }
        }

        // --- Step B & C: Secondary System ---
        const secondaryAuth = getAuth(tempSecondaryApp);
        const tempSecondaryDb = getFirestore(tempSecondaryApp);

        if (!isRestored) {
            // New User Flow
            await createUserWithEmailAndPassword(secondaryAuth, email, password);
            await setDoc(doc(tempSecondaryDb, 'users', mainUid), {
                email: email,
                email_lower: emailLower,
                role: role,
                createdAt: serverTimestamp()
            });
        } else {
            // Restore Flow: Try to restore Secondary DB entry
            // We attempt Anonymous Auth to gain write access (if allowed by project settings)
            try {
                await signInAnonymously(secondaryAuth);
                await setDoc(doc(tempSecondaryDb, 'users', mainUid), {
                    email: email,
                    email_lower: emailLower,
                    role: role,
                    createdAt: serverTimestamp(),
                    restored: true
                });
            } catch (secError) {
                console.warn("Failed to restore user in Secondary DB (Auth restriction):", secError);
                // We proceed, as Main DB restore is more critical for Admin Panel
            }
        }

        // --- Step D: Write to Main Firestore ---
        // We can use the main 'db' instance which is authenticated as Admin
        await setDoc(doc(db, 'users', mainUid), {
            full_name: full_name || '',
            email: email,
            email_lower: emailLower,
            role: role,
            department: department || '-',
            assignedWorkspaces: [],
            createdAt: serverTimestamp(),
            ...(hashedPassword && { password: hashedPassword })
        });

        // Cleanup deleted_users record if restored
        if (isRestored) {
            try {
                await deleteDoc(doc(db, 'deleted_users', emailLower));
            } catch (e) {
                console.warn("Failed to clean up deleted_users record", e);
            }
        }

        return { uid: mainUid, isRestored };

    } catch (error) {
        console.error("Error creating/restoring user in both systems:", error);
        throw error;
    } finally {
        // Cleanup: Delete temporary apps
        try {
            await deleteApp(tempMainApp);
            await deleteApp(tempSecondaryApp);
        } catch (cleanupError) {
            console.warn("Failed to cleanup temp apps:", cleanupError);
        }
    }
};
