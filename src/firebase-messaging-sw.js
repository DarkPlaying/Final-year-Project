import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.skipWaiting()
clientsClaim()

// Firebase Messaging Logic
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBKFjGmeykAc4Ck9zDrKz745yZQyqGC8y8",
    authDomain: "education-ai-af34e.firebaseapp.com",
    projectId: "education-ai-af34e",
    storageBucket: "education-ai-af34e.firebasestorage.app",
    messagingSenderId: "815335775209",
    appId: "1:815335775209:web:6c0bc09a99447a0f28c978"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Parse data payload
    const { title, body, icon, url } = payload.data;

    const notificationTitle = title;
    const notificationOptions = {
        body: body,
        icon: icon || '/favicon.ico', // Use provided icon or fallback
        data: { url: url } // Store URL to handle click later
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle Notification Click
self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click Received.', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // If a window is already open, focus it
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
