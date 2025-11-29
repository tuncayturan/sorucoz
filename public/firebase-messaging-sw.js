// Firebase Cloud Messaging Service Worker
console.log('[SW] Service Worker script loaded');

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

console.log('[SW] Firebase scripts loaded');

// Firebase config - environment variables service worker'da çalışmaz, bu yüzden hardcode edilmeli
// Ancak güvenlik için sadece public config değerleri kullanılabilir
const firebaseConfig = {
  apiKey: "AIzaSyDmvEdQicJmsPhFjDcXXgj5rK0LO9Er2KU",
  authDomain: "sorucoz-6deb3.firebaseapp.com",
  projectId: "sorucoz-6deb3",
  storageBucket: "sorucoz-6deb3.firebasestorage.app",
  messagingSenderId: "1026488924758",
  appId: "1:1026488924758:web:d4c081b5f87a62f10ed9f7"
};

// Initialize Firebase
console.log('[SW] Initializing Firebase...');
firebase.initializeApp(firebaseConfig);
console.log('[SW] Firebase initialized');

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();
console.log('[SW] Firebase Messaging instance created');

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  console.log('[firebase-messaging-sw.js] Payload notification:', payload.notification);
  console.log('[firebase-messaging-sw.js] Payload data:', payload.data);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Yeni Bildirim';
  const notificationBody = payload.notification?.body || payload.data?.body || '';
  
  console.log('[firebase-messaging-sw.js] Notification title:', notificationTitle);
  console.log('[firebase-messaging-sw.js] Notification body:', notificationBody);
  
  const notificationOptions = {
    body: notificationBody,
    icon: '/img/logo.png',
    badge: '/img/logo.png',
    data: payload.data || {},
    requireInteraction: false,
    silent: false,
    tag: payload.messageId || 'notification-' + Date.now(), // Unique tag to prevent duplicates
  };

  console.log('[firebase-messaging-sw.js] Showing notification:', notificationTitle, notificationBody);
  console.log('[firebase-messaging-sw.js] Notification options:', notificationOptions);
  
  try {
    const promise = self.registration.showNotification(notificationTitle, notificationOptions);
    console.log('[firebase-messaging-sw.js] showNotification called, promise:', promise);
    
    return promise
      .then(() => {
        console.log('[firebase-messaging-sw.js] Notification shown successfully');
      })
      .catch((error) => {
        console.error('[firebase-messaging-sw.js] Error showing notification:', error);
        console.error('[firebase-messaging-sw.js] Error details:', error.message, error.stack);
      });
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Error in onBackgroundMessage:', error);
    console.error('[firebase-messaging-sw.js] Error details:', error.message, error.stack);
  }
});

// Manual push event handler (fallback) - Sadece Firebase Messaging çalışmazsa kullanılır
// Firebase Messaging zaten onBackgroundMessage ile handle ediyor, bu yüzden push event'i ignore ediyoruz
// Çift bildirim sorununu önlemek için push event listener'ı devre dışı bırakıyoruz
/*
self.addEventListener('push', (event) => {
  console.log('[SW] ========== PUSH EVENT RECEIVED (FALLBACK) ==========');
  console.log('[SW] Push event:', event);
  
  // Firebase Messaging onBackgroundMessage ile handle ediyor, bu yüzden burada bir şey yapmıyoruz
  // Eğer Firebase Messaging çalışmazsa, bu kodu aktif edebilirsiniz
});
*/

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.');
  
  event.notification.close();

  // Burada bildirime tıklandığında ne yapılacağını belirleyebilirsiniz
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

