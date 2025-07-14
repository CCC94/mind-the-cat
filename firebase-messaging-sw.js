importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
    // Your Firebase config here
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
    // Customize notification here
    self.registration.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: '/icon-192.png' // or your app icon
    });
}); 