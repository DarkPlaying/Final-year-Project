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
 * Creates a new user in the Main Firebase Project (Auth & Firestore).
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
    // (We use a temp app to avoid signing out the current Admin user)
    const tempMainApp = initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
    }, `TempMainApp-${Date.now()}`);

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
                    } catch (loginError) {
                        console.warn(`[createUser] Password mismatch for ${email}. Attempting auto-cleanup via service...`);

                        // 3. Auto-fix: Call backend to delete the stale user from Auth
                        try {
                            const response = await fetch('https://edu-online-notifications.onrender.com/delete-user', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email })
                            });

                            if (!response.ok) {
                                throw new Error(`Cleanup failed with status ${response.status}`);
                            }

                            console.log(`[createUser] Stale user deleted. Retrying creation...`);

                            // 4. Retry Creation
                            const retryCred = await createUserWithEmailAndPassword(mainAuth, email, password);
                            mainUid = retryCred.user.uid;

                        } catch (cleanupError: any) {
                            console.error(`[createUser] Auto-fix failed:`, cleanupError);
                            throw new Error(`AUTH_PASSWORD_MISMATCH: User ${email} exists, password differs, and auto-fix failed: ${cleanupError.message}`);
                        }
                    }
                }
            } else {
                throw error;
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
        }, { merge: true }); // Merge to update if exists/restoring

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
        console.error("Error creating/restoring user:", error);
        throw error;
    } finally {
        // Cleanup: Delete temporary app
        try {
            await deleteApp(tempMainApp);
        } catch (cleanupError) {
            console.warn("Failed to cleanup temp app:", cleanupError);
        }
    }
};
