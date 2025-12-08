import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Validate config presence
        const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
        if (!apiKey) {
            console.error('Firebase Config Missing! Notifications will not work.');
            return;
        }

        // Pass config to SW via URL params
        const configParams = new URLSearchParams({
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID
        });

        console.log('Registering SW with params...');

        // Aggressively unregister old SWs to force update
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
            for (let registration of registrations) {
                registration.unregister();
            }

            // Register new one
            // Add timestamp to force update
            navigator.serviceWorker.register(`/firebase-messaging-sw.js?${configParams.toString()}&v=${Date.now()}`)
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.error('ServiceWorker registration failed: ', err);
                });
        });
    });
}
