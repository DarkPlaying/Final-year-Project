importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Retrieve config params from the script URL
console.log('SW Script URL:', self.location.href);
const params = new URLSearchParams(self.location.search);

// FALLBACK CONFIG (In case URL params fail)
const defaultConfig = {
    apiKey: "AIzaSyBKFJgmeykAc4CK9zDrKz74Sy7Qyq6C8y8",
    authDomain: "education-ai-af34e.firebaseapp.com",
    projectId: "education-ai-af34e",
    storageBucket: "education-ai-af34e.firebasestorage.app",
    messagingSenderId: "815335775209",
    appId: "1:815335775209:web:3a81533577520983aweb"
};

const apiKey = params.get('apiKey') || defaultConfig.apiKey;
const authDomain = params.get('authDomain') || defaultConfig.authDomain;
const projectId = params.get('projectId') || defaultConfig.projectId;
const storageBucket = params.get('storageBucket') || defaultConfig.storageBucket;
const messagingSenderId = params.get('messagingSenderId') || defaultConfig.messagingSenderId;
const appId = params.get('appId') || defaultConfig.appId;

if (apiKey && projectId) {
    const firebaseConfig = {
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId
    };
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized in SW');
    } catch (e) {
        console.error('Firebase init error in SW:', e);
    }
} else {
    console.warn('Firebase Messaging SW: Missing config parameters in URL and Default Config');
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
