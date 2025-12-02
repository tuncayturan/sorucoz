// Firebase Cloud Messaging Service Worker
console.log('[SW] Service Worker script loaded');

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

console.log('[SW] Firebase scripts loaded');

// Service Worker lifecycle management
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  // Claim all clients immediately
  event.waitUntil(
    self.clients.claim().then(() => {
      console.log('[SW] ✅ Service worker activated and claimed all clients');
    })
  );
});

// Duplicate notification prevention - store recently shown notification IDs
// Using IndexedDB for cross-tab duplicate prevention
const DB_NAME = 'NotificationDB';
const DB_VERSION = 1;
const STORE_NAME = 'shownNotifications';
const NOTIFICATION_TIMEOUT = 10000; // 10 saniye içinde aynı bildirim tekrar gösterilmez (çoklu bildirim önleme)

// In-memory fallback for fast checks
const shownNotifications = new Set();

// Initialize IndexedDB for persistent cross-tab duplicate prevention
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Check if notification was recently shown (cross-tab)
const wasRecentlyShown = async (notificationId) => {
  // Quick in-memory check first
  if (shownNotifications.has(notificationId)) {
    return true;
  }
  
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(notificationId);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          const age = Date.now() - record.timestamp;
          resolve(age < NOTIFICATION_TIMEOUT);
        } else {
          resolve(false);
        }
      };
      request.onerror = () => resolve(false); // On error, allow notification
    });
  } catch (error) {
    console.error('[SW] IndexedDB check error:', error);
    return false; // On error, allow notification
  }
};

// Mark notification as shown (cross-tab)
const markAsShown = async (notificationId) => {
  // Add to in-memory set
  shownNotifications.add(notificationId);
  
  // Add to IndexedDB for cross-tab sharing
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.put({
      id: notificationId,
      timestamp: Date.now()
    });
    
    // Clean up old entries (older than timeout)
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(Date.now() - NOTIFICATION_TIMEOUT);
    const cleanupRequest = index.openCursor(range);
    
    cleanupRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch (error) {
    console.error('[SW] IndexedDB mark error:', error);
  }
  
  // Remove from in-memory set after timeout
  setTimeout(() => {
    shownNotifications.delete(notificationId);
  }, NOTIFICATION_TIMEOUT);
};

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
messaging.onBackgroundMessage(async (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  console.log('[firebase-messaging-sw.js] Payload notification:', payload.notification);
  console.log('[firebase-messaging-sw.js] Payload data:', payload.data);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Yeni Bildirim';
  const notificationBody = payload.notification?.body || payload.data?.body || '';
  
  // Create notification ID for duplicate prevention
  // Use the messageId from API (which includes timestamp for uniqueness)
  // This allows each new message to create a notification, but prevents immediate duplicates
  const notificationId = payload.data?.messageId || 
                        payload.messageId || 
                        `${payload.data?.type || 'general'}-${Date.now()}`;
  
  // Check if this notification was recently shown (cross-tab check)
  const wasShown = await wasRecentlyShown(notificationId);
  if (wasShown) {
    console.log('[firebase-messaging-sw.js] ⚠️ Duplicate notification prevented (cross-tab):', notificationId);
    return Promise.resolve();
  }
  
  // Mark as shown (cross-tab)
  await markAsShown(notificationId);
  
  console.log('[firebase-messaging-sw.js] Notification title:', notificationTitle);
  console.log('[firebase-messaging-sw.js] Notification body:', notificationBody);
  console.log('[firebase-messaging-sw.js] Notification ID:', notificationId);
  
  // Logo URL'sini payload'dan veya varsayılan olarak kullan
  const iconUrl = payload.notification?.icon || payload.data?.icon || '/img/logo.png';
  
  // Ses URL'sini payload'dan al (varsa özel ses, yoksa varsayılan)
  const soundUrl = payload.data?.sound || payload.notification?.sound;
  
  // CRITICAL FIX: Use stable tag for conversation grouping
  // Same conversation = Same tag = Single notification (updated on new messages)
  const notificationType = payload.data?.type || 'general';
  
  let notificationTag;
  if (payload.data?.conversationId) {
    // SADECE conversationId - her mesaj aynı bildirimi güncelleyecek
    notificationTag = `conv-${payload.data.conversationId}`;
  } else if (payload.data?.supportId) {
    // SADECE supportId
    notificationTag = `supp-${payload.data.supportId}`;
  } else {
    // Diğer bildirimler için unique tag
    notificationTag = `${notificationType}-${Date.now()}`;
  }
  
  console.log('[firebase-messaging-sw.js] 🏷️ Notification Tag:', notificationTag);
  
  const notificationOptions = {
    body: notificationBody,
    icon: iconUrl,
    badge: iconUrl,
    data: payload.data || {},
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    tag: notificationTag, // STABLE TAG - aynı conversation her zaman aynı tag
    renotify: true, // Yeni mesaj geldiğinde ses + titreşim
    timestamp: Date.now(),
  };
  
  console.log('[firebase-messaging-sw.js] 🔔 Notification Options:', {
    tag: notificationTag,
    title: notificationTitle,
    icon: iconUrl ? 'yes' : 'no'
  });
  
  // Web Push API ses özelliğini desteklemiyor, ancak ses data olarak geçilebilir
  // Özel ses için Android/iOS native uygulamalarda veya browser'da farklı yöntemler kullanılmalı
  // FCM Admin SDK'da sound parametresi Android/iOS için ayarlandı
  
  console.log('[firebase-messaging-sw.js] Using icon:', iconUrl);
  console.log('[firebase-messaging-sw.js] Custom sound:', soundUrl || 'system default');
  console.log('[firebase-messaging-sw.js] Notification tag:', notificationTag);

  console.log('[firebase-messaging-sw.js] Showing notification:', notificationTitle, notificationBody);
  console.log('[firebase-messaging-sw.js] Notification options:', notificationOptions);
  
  try {
    const promise = self.registration.showNotification(notificationTitle, notificationOptions);
    console.log('[firebase-messaging-sw.js] showNotification called, promise:', promise);
    
    return promise
      .then(() => {
        console.log('[firebase-messaging-sw.js] ✅ Notification shown successfully');
      })
      .catch((error) => {
        console.error('[firebase-messaging-sw.js] ❌ Error showing notification:', error);
        console.error('[firebase-messaging-sw.js] Error details:', error.message, error.stack);
      });
  } catch (error) {
    console.error('[firebase-messaging-sw.js] ❌ Error in onBackgroundMessage:', error);
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
  console.log('[firebase-messaging-sw.js] Notification data:', event.notification.data);
  
  event.notification.close();

  // Bildirim tipine göre doğru sayfayı aç
  const notificationData = event.notification.data || {};
  const notificationType = notificationData.type || 'general';
  
  let targetUrl = '/';
  
  console.log('[firebase-messaging-sw.js] Processing notification click:', {
    type: notificationType,
    conversationId: notificationData.conversationId,
    supportId: notificationData.supportId,
    userId: notificationData.userId,
  });
  
  // Her bildirim tipine göre URL belirleme
  switch (notificationType) {
    case 'message':
      // Coach/Student mesajları
      if (notificationData.conversationId) {
        // conversationId var - direkt sohbeti aç
        targetUrl = `/mesajlar?conversationId=${notificationData.conversationId}`;
        console.log('[firebase-messaging-sw.js] Message notification - conversationId:', notificationData.conversationId);
      } else if (notificationData.userId) {
        // Sadece userId var - coach için
        targetUrl = `/coach/chat?userId=${notificationData.userId}`;
        console.log('[firebase-messaging-sw.js] Message notification - userId:', notificationData.userId);
      } else {
        targetUrl = '/mesajlar';
      }
      break;
      
    case 'support':
      // Yeni destek mesajı - Admin'e bildirim
      if (notificationData.supportId && notificationData.userId) {
        targetUrl = `/admin/destek?userId=${notificationData.userId}&supportId=${notificationData.supportId}`;
        console.log('[firebase-messaging-sw.js] Support notification - admin view');
      } else {
        targetUrl = '/admin/destek';
      }
      break;
      
    case 'support_reply':
      // Destek yanıtı
      if (notificationData.supportId && notificationData.userId) {
        // Admin yanıtladıysa öğrenciye, öğrenci yanıtladıysa admin'e
        // supportId var - her iki taraf için de kullanılabilir
        targetUrl = `/destek?supportId=${notificationData.supportId}`;
        console.log('[firebase-messaging-sw.js] Support reply notification');
      } else if (notificationData.supportId) {
        targetUrl = `/destek?supportId=${notificationData.supportId}`;
      } else {
        targetUrl = '/destek';
      }
      break;
      
    case 'question':
      // Soru bildirimleri
      if (notificationData.questionId) {
        targetUrl = `/sorularim/${notificationData.questionId}`;
      } else {
        targetUrl = '/sorularim';
      }
      break;
      
    case 'admin_message':
      // Admin ↔ Student mesajları (destek değil, normal mesajlar)
      if (notificationData.messageId && notificationData.userId) {
        targetUrl = `/admin/mesajlar?userId=${notificationData.userId}&messageId=${notificationData.messageId}`;
      } else {
        targetUrl = '/admin/mesajlar';
      }
      break;
      
    default:
      // Genel bildirimler veya belirtilmemiş URL
      targetUrl = notificationData.url || '/home';
  }
  
  console.log('[firebase-messaging-sw.js] 🎯 Target URL:', targetUrl);
  
  // Mevcut pencereyi bul veya yeni pencere aç
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Eğer açık bir pencere varsa, onu kullan
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            console.log('[firebase-messaging-sw.js] Focusing existing window and navigating to:', targetUrl);
            client.focus();
            return client.navigate(targetUrl);
          }
        }
        // Açık pencere yoksa yeni pencere aç
        console.log('[firebase-messaging-sw.js] Opening new window:', targetUrl);
        return clients.openWindow(targetUrl);
      })
      .catch((error) => {
        console.error('[firebase-messaging-sw.js] Error handling notification click:', error);
      })
  );
});

