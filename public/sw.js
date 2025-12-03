importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBKFjGmeykAc4Ck9zDrKz745yZQyqGC8y8",
    authDomain: "education-ai-af34e.firebaseapp.com",
    projectId: "education-ai-af34e",
    storageBucket: "education-ai-af34e.firebasestorage.app",
    messagingSenderId: "815335775209",
    appId: "1:815335775209:web:6c0bc09a99447a0f28c978",
    databaseURL: "https://education-ai-af34e-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const DB_NAME = 'EduOnlineNotifications';
const STORE_NAME = 'shown_notifications';

// Initialize IndexedDB
const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = (event) => reject(event.target.error);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
    });
};

// Install and Activate events
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Check if notification already shown
const isNotificationShown = async (id) => {
    const db = await initDB();
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => resolve(false);
    });
};

// Mark notification as shown
const markNotificationShown = async (id) => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ id, timestamp: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject();
    });
};

let pollingInterval = null;

// Listen for messages from client
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'INIT_NOTIFICATIONS') {
        const userId = event.data.userId;
        console.log('[SW] Initializing notifications for user:', userId);

        if (pollingInterval) clearInterval(pollingInterval);

        // Poll every 10 seconds - DISABLED (Using Server Push now)
        // pollingInterval = setInterval(() => checkNotifications(userId), 10000);

        // Immediate check - DISABLED
        // checkNotifications(userId);
    }
});

const checkNotifications = async (userId) => {
    // Disabled to prevent duplicates with Server Push
    return;
    /*
    try {
        const notificationsRef = db.ref(`notifications/${userId}`);
        // Get last 5 notifications
        const snapshot = await notificationsRef.limitToLast(5).once('value');
        const notifications = snapshot.val();

        if (!notifications) return;

        Object.entries(notifications).forEach(async ([key, notif]) => {
            // Check if expired (24 hours)
            if (Date.now() - notif.timestamp > 24 * 60 * 60 * 1000) {
                return;
            }

            const alreadyShown = await isNotificationShown(key);
            if (!alreadyShown) {
                showNotification(notif.title, notif.body, notif.link);
                await markNotificationShown(key);
            }
        });
    } catch (error) {
        console.error('[SW] Error checking notifications:', error);
    }
    */
};

const showNotification = (title, body, link) => {
    self.registration.showNotification(title, {
        body: body,
        icon: '/favicon.ico', // Using favicon as requested logo might not exist
        badge: '/favicon.ico',
        data: { url: link }
    });
};

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there is already a window/tab open with the target URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
