import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Secondary Database Configuration (Attendance DB: finalyear-b56e7)
const secondaryFirebaseConfig = {
    apiKey: import.meta.env.VITE_ATTENDANCE_API_KEY,
    authDomain: import.meta.env.VITE_ATTENDANCE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_ATTENDANCE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_ATTENDANCE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_ATTENDANCE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_ATTENDANCE_APP_ID
};

import { getAuth } from "firebase/auth";

// Initialize the secondary app
// We use a unique name "SecondaryAppInstance" to avoid conflicts with the main app
const secondaryApp = initializeApp(secondaryFirebaseConfig, "SecondaryAppInstance");

export const secondaryDb = getFirestore(secondaryApp);
export const secondaryAuth = getAuth(secondaryApp);
