import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInAnonymously, signInWithEmailAndPassword } from "firebase/auth";
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
                // 1. Try to find in deleted_users (Restoration)
                const deletedRef = doc(db, 'deleted_users', emailLower);
                const deletedSnap = await getDoc(deletedRef);

                if (deletedSnap.exists()) {
                    mainUid = deletedSnap.data().uid;
                    isRestored = true;
                    console.log(`[createUser] User found in deleted_users archive. Restoring UID: ${mainUid}`);
                } else {
                    // 2. Not in archive? User might exist in Auth but not Firestore (or just re-uploading).
                    // Try to sign in to recover UID.
                    console.log(`[createUser] User exists in Auth. Attempting to recover UID via login...`);
                    try {
                        const recoveredCred = await signInWithEmailAndPassword(mainAuth, email, password);
                        mainUid = recoveredCred.user.uid;
                        console.log(`[createUser] Recovered UID via login: ${mainUid}`);
                        // We don't mark as restored, we just treat as existing user to be synced.
                    } catch (loginError) {
                        console.error(`[createUser] Failed to recover user via login (Wrong password?):`, loginError);
                        throw new Error(`User ${email} already exists and password does not match.`);
                    }
                }
            } else {
                throw error;
            }
        }

        // --- Step B & C: Secondary System ---
        const secondaryAuth = getAuth(tempSecondaryApp);
        const tempSecondaryDb = getFirestore(tempSecondaryApp);

        console.log(`[createUser] Secondary App Project ID: ${tempSecondaryApp.options.projectId}`);
        alert(`Debug: Writing to Secondary Project ID: ${tempSecondaryApp.options.projectId}`);

        if (!isRestored) {
            // New User Flow
            console.log(`[createUser] Creating user in Secondary Auth: ${email}`);
            const secCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            console.log(`[createUser] Secondary Auth UID: ${secCred.user.uid}`);
            console.log(`[createUser] Main Auth UID: ${mainUid}`);

            const secUserRef = doc(tempSecondaryDb, 'users', mainUid);
            console.log(`[createUser] Writing to Secondary DB at: users/${mainUid}`);

            await setDoc(secUserRef, {
                email: email,
                email_lower: emailLower,
                role: role,
                createdAt: serverTimestamp()
            });
            console.log(`[createUser] Write operation completed.`);

            // Verify Write
            console.log(`[createUser] Verifying document existence...`);
            const verifySnap = await getDoc(secUserRef);
            if (verifySnap.exists()) {
                console.log(`[createUser] VERIFIED: Document exists in Secondary DB.`);
            } else {
                console.error(`[createUser] VERIFICATION FAILED: Document NOT found in Secondary DB after write.`);
                throw new Error("Secondary DB write verification failed. The document was not found after creation.");
            }

        } else {
            // Restore Flow
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
            }
        }

        // --- Step D: Write to Main Firestore ---
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
