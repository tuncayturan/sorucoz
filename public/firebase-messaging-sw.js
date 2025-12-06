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
  // Force immediate activation
  event.waitUntil(
    self.skipWaiting().then(() => {
      console.log('[SW] ✅ Skip waiting completed');
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  // Claim all clients immediately and forcefully
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      self.skipWaiting()
    ]).then(() => {
      console.log('[SW] ✅ Service worker activated and claimed all clients');
      // Force update all clients
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_ACTIVATED' });
        });
        console.log(`[SW] ✅ Notified ${clients.length} client(s) about activation`);
      });
    }).catch(error => {
      console.error('[SW] ❌ Activation error:', error);
    })
  );
});

// Message handler for skip waiting
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
});

// ULTRA AGGRESSIVE Duplicate notification prevention
// Using IndexedDB + in-memory Set + processing lock
const DB_NAME = 'NotificationDB';
const DB_VERSION = 1;
const STORE_NAME = 'shownNotifications';
const NOTIFICATION_TIMEOUT = 300000; // 300 saniye (5 dakika) içinde aynı bildirim tekrar gösterilmez (ULTRA AGGRESSIVE - artırıldı)

// TRIPLE PROTECTION:
// 1. processingNotifications: Prevents concurrent processing (immediate)
// 2. shownNotifications: Fast in-memory check (instant)
// 3. IndexedDB: Persistent cross-tab check (reliable)
const shownNotifications = new Set();
const processingNotifications = new Set();

// Global counter for debugging
let notificationCounter = 0;

// Message handler debouncing - prevent rapid fire
const messageHandlerLock = new Map(); // messageId -> timestamp
const HANDLER_DEBOUNCE = 60000; // 60 saniye içinde aynı message için sadece 1 kere işle (ULTRA AGGRESSIVE - artırıldı)

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

// Check if notification was recently shown (cross-tab + in-memory)
const wasRecentlyShown = async (notificationId) => {
  console.log('[SW] 🔍 Checking if recently shown:', notificationId);
  
  // FASTEST: In-memory check first
  if (shownNotifications.has(notificationId)) {
    console.log('[SW] ✅ Found in memory cache - DUPLICATE!');
    return true;
  }
  
  // PERSISTENT: Check IndexedDB for cross-tab scenarios
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
          const isDuplicate = age < NOTIFICATION_TIMEOUT;
          console.log('[SW]', isDuplicate ? '✅ Found in IndexedDB - DUPLICATE!' : '⚠️ Found but expired');
          console.log('[SW] Age:', age, 'ms, Timeout:', NOTIFICATION_TIMEOUT, 'ms');
          resolve(isDuplicate);
        } else {
          console.log('[SW] ✅ Not found in IndexedDB - NEW notification');
          resolve(false);
        }
      };
      request.onerror = () => {
        console.warn('[SW] ⚠️ IndexedDB read error, allowing notification');
        resolve(false); // On error, allow notification
      };
    });
  } catch (error) {
    console.error('[SW] ❌ IndexedDB check error:', error);
    return false; // On error, allow notification
  }
};

// Mark notification as shown (cross-tab + in-memory)
const markAsShown = async (notificationId) => {
  console.log('[SW] 📝 Marking as shown:', notificationId);
  
  // IMMEDIATE: Add to in-memory set (fastest protection)
  shownNotifications.add(notificationId);
  console.log('[SW] ✅ Added to in-memory set, total:', shownNotifications.size);
  
  // PERSISTENT: Add to IndexedDB for cross-tab sharing
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    store.put({
      id: notificationId,
      timestamp: Date.now()
    });
    console.log('[SW] ✅ Saved to IndexedDB');
    
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
    console.error('[SW] ❌ IndexedDB mark error:', error);
    // Even if IndexedDB fails, in-memory protection still works
  }
  
  // Remove from in-memory set after timeout
  setTimeout(() => {
    shownNotifications.delete(notificationId);
    console.log('[SW] 🗑️ Removed from in-memory set after timeout');
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
  notificationCounter++;
  const handlerCallNumber = notificationCounter;
  
  console.log('[firebase-messaging-sw.js] ==========================================');
  console.log(`[firebase-messaging-sw.js] 📨 onBackgroundMessage CALLED - CALL #${handlerCallNumber}`);
  console.log('[firebase-messaging-sw.js] ==========================================');
  
  // Extract messageId FIRST for debouncing
  const messageId = payload.data?.messageId || '';
  const conversationId = payload.data?.conversationId || payload.data?.supportId || '';
  const messageType = payload.data?.type || 'general';
  
      // STABLE ID: Use messageId from API (unique per user+conversation+time window)
      // Eğer messageId yoksa, daha stable bir ID oluştur
      // CRITICAL: Aynı mesaj için her zaman aynı ID olmalı
      // ULTRA AGGRESSIVE: messageId varsa direkt kullan, yoksa daha geniş time window kullan
      const timeWindow = Math.floor(Date.now() / 60000) * 60000; // 60 saniyelik window (artırıldı)
      const notificationId = messageId || `${messageType}-${conversationId || payload.data?.userId || 'general'}-${timeWindow}`;
  
  // ========== LAYER 0: Handler Debouncing (EARLIEST PROTECTION) ==========
  console.log(`[firebase-messaging-sw.js] 🔒 LAYER 0: Handler debouncing check...`);
  const now = Date.now();
  
  // Daha agresif: messageId veya conversationId bazlı kontrol
  const checkId = messageId || notificationId;
  const lastHandlerTime = messageHandlerLock.get(checkId);
  
  if (lastHandlerTime && (now - lastHandlerTime) < HANDLER_DEBOUNCE) {
    console.log(`[firebase-messaging-sw.js] 🛑 BLOCKED BY LAYER 0 - Handler called ${now - lastHandlerTime}ms ago!`);
    console.log(`[firebase-messaging-sw.js] ⚠️ onBackgroundMessage rapid fire detected - Call #${handlerCallNumber} blocked`);
    console.log(`[firebase-messaging-sw.js] This suggests FCM is calling handler multiple times!`);
    console.log(`[firebase-messaging-sw.js] Check ID: ${checkId}`);
    return Promise.resolve();
  }
  
  // Lock this message ID in handler
  messageHandlerLock.set(checkId, now);
  setTimeout(() => {
    messageHandlerLock.delete(checkId);
  }, HANDLER_DEBOUNCE);
  
  console.log(`[firebase-messaging-sw.js] ✅ LAYER 0 PASSED - First handler call for this message`);
  console.log('[firebase-messaging-sw.js] Full payload:', JSON.stringify(payload, null, 2));
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Yeni Bildirim';
  const notificationBody = payload.notification?.body || payload.data?.body || '';
  
  console.log(`[firebase-messaging-sw.js] 🆔 Notification ID: ${notificationId}`);
  console.log(`[firebase-messaging-sw.js] 📊 Current state:`, {
    processing: Array.from(processingNotifications),
    shown: Array.from(shownNotifications),
    processingSize: processingNotifications.size,
    shownSize: shownNotifications.size
  });
  
  // ========== LAYER 1: Processing Lock (IMMEDIATE) ==========
  console.log(`[firebase-messaging-sw.js] 🔒 LAYER 1: Checking processing lock...`);
  if (processingNotifications.has(notificationId)) {
    console.log(`[firebase-messaging-sw.js] 🛑 BLOCKED BY LAYER 1 - Currently processing!`);
    console.log(`[firebase-messaging-sw.js] Call #${handlerCallNumber} terminated (processing lock)`);
    return Promise.resolve();
  }
  
  // Mark as processing IMMEDIATELY
  processingNotifications.add(notificationId);
  console.log(`[firebase-messaging-sw.js] ✅ LAYER 1 PASSED - Locked for processing`);
  
  // ========== LAYER 2: In-Memory Cache (FAST) ==========
  console.log(`[firebase-messaging-sw.js] 💾 LAYER 2: Checking in-memory cache...`);
  if (shownNotifications.has(notificationId)) {
    console.log(`[firebase-messaging-sw.js] 🛑 BLOCKED BY LAYER 2 - In memory cache!`);
    console.log(`[firebase-messaging-sw.js] Call #${handlerCallNumber} terminated (memory cache)`);
    processingNotifications.delete(notificationId);
    return Promise.resolve();
  }
  console.log(`[firebase-messaging-sw.js] ✅ LAYER 2 PASSED - Not in memory`);
  
  // ========== LAYER 3: IndexedDB (PERSISTENT) ==========
  console.log(`[firebase-messaging-sw.js] 💽 LAYER 3: Checking IndexedDB...`);
  const wasShown = await wasRecentlyShown(notificationId);
  if (wasShown) {
    console.log(`[firebase-messaging-sw.js] 🛑 BLOCKED BY LAYER 3 - Recently shown in DB!`);
    console.log(`[firebase-messaging-sw.js] Call #${handlerCallNumber} terminated (IndexedDB)`);
    processingNotifications.delete(notificationId);
    return Promise.resolve();
  }
  console.log(`[firebase-messaging-sw.js] ✅ LAYER 3 PASSED - Not in IndexedDB`);
  
  // ========== ALL CHECKS PASSED - SHOW NOTIFICATION ==========
  console.log(`[firebase-messaging-sw.js] 🎯 ALL LAYERS PASSED - Proceeding to show notification`);
  
  // Mark as shown in both storages
  await markAsShown(notificationId);
  console.log(`[firebase-messaging-sw.js] ✅ Marked as shown in all storages`);
  
  console.log('[firebase-messaging-sw.js] Notification title:', notificationTitle);
  console.log('[firebase-messaging-sw.js] Notification body:', notificationBody);
  console.log('[firebase-messaging-sw.js] Notification ID:', notificationId);
  
  // Logo URL'sini payload'dan al - API her zaman siteSettings'ten gönderiyor
  // Eğer payload'da yoksa varsayılan logo kullan
  const iconUrl = payload.data?.icon || payload.notification?.icon || '/img/logo.png';
  console.log('[firebase-messaging-sw.js] Icon URL:', iconUrl);
  
  // Ses URL'sini payload'dan al (varsa özel ses, yoksa varsayılan)
  const soundUrl = payload.data?.sound || payload.notification?.sound;
  
  // CRITICAL FIX: Use unique tag for each notification to prevent duplicates
  // Her yeni mesaj için yeni bir tag - duplicate prevention messageId ile çalışıyor
  // ULTRA AGGRESSIVE: messageId bazlı unique tag kullan
  const notificationType = payload.data?.type || 'general';
  
  let notificationTag;
  if (messageId) {
    // EN İYİ: messageId varsa direkt kullan - her bildirim için unique tag
    // Duplicate prevention zaten messageId ile çalışıyor, tag sadece görsel güncelleme için
    notificationTag = `msg-${messageId}`;
  } else if (payload.data?.conversationId) {
    // conversationId + timestamp - her mesaj için unique tag
    const timeWindow = Math.floor(Date.now() / 1000); // 1 saniyelik window
    notificationTag = `conv-${payload.data.conversationId}-${timeWindow}`;
  } else if (payload.data?.supportId) {
    // supportId + timestamp
    const timeWindow = Math.floor(Date.now() / 1000);
    notificationTag = `supp-${payload.data.supportId}-${timeWindow}`;
  } else {
    // Diğer bildirimler için notificationId kullan
    notificationTag = `notif-${notificationId}`;
  }
  
  console.log('[firebase-messaging-sw.js] 🏷️ Notification Tag:', notificationTag);
  
  // ========== SMART NOTIFICATION CLEANUP ==========
  // Sadece aynı conversation'daki eski bildirimleri kapat - diğer conversation'ları koru
  console.log('[firebase-messaging-sw.js] 🧹 CLEANUP: Closing old notifications from same conversation...');
  
  let closedCount = 0;
  // conversationId zaten yukarıda tanımlanmış (satır 209)
  
  try {
    // ÖNCE: Aynı tag'deki tüm bildirimleri kapat (notification.replace çalışmıyorsa)
    const existingNotifications = await self.registration.getNotifications({ tag: notificationTag });
    if (existingNotifications.length > 0) {
      console.log(`[firebase-messaging-sw.js] 🔍 Found ${existingNotifications.length} notification(s) with same tag: ${notificationTag}`);
      for (const notification of existingNotifications) {
        try {
          notification.close();
          closedCount++;
        } catch (closeError) {
          console.error(`[firebase-messaging-sw.js] ❌ Failed to close same-tag notification:`, closeError);
        }
      }
    }
    
    // SONRA: Aynı conversation'daki eski bildirimleri kapat (eğer conversationId varsa)
    if (conversationId) {
      const allNotifications = await self.registration.getNotifications();
      console.log(`[firebase-messaging-sw.js] 📋 Found ${allNotifications.length} total existing notification(s)`);
      
      // Aynı conversation'daki eski bildirimleri bul ve kapat
      for (const notification of allNotifications) {
        const notifData = notification.data || {};
        const notifConversationId = notifData.conversationId || notifData.supportId;
        
        // Aynı conversation ve farklı tag (eski mesaj)
        if (notifConversationId === conversationId && notification.tag !== notificationTag) {
          console.log(`[firebase-messaging-sw.js] 🗑️ Closing old notification from same conversation:`, {
            title: notification.title,
            tag: notification.tag,
            timestamp: notification.timestamp
          });
          
          try {
            notification.close();
            closedCount++;
          } catch (closeError) {
            console.error(`[firebase-messaging-sw.js] ❌ Failed to close old notification:`, closeError);
          }
        }
      }
      
      // Kapanmaları tamamlanması için bekle
      if (closedCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`[firebase-messaging-sw.js] ✅ CLEANUP COMPLETE: Closed ${closedCount} notification(s) from same conversation`);
    } else {
      console.log('[firebase-messaging-sw.js] ℹ️ No conversationId, skipping conversation-specific cleanup');
    }
  } catch (error) {
    console.error('[firebase-messaging-sw.js] ❌ Error in cleanup process:', error);
    console.error('[firebase-messaging-sw.js] Error details:', error.message, error.stack);
  }
  
  console.log('[firebase-messaging-sw.js] 🎯 Proceeding to show NEW notification (only one visible)');
  
  const notificationOptions = {
    body: notificationBody,
    icon: iconUrl,
    badge: iconUrl,
    data: payload.data || {},
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
    tag: notificationTag, // STABLE TAG - aynı conversation her zaman aynı tag
    renotify: true, // true yap - aynı tag'deki bildirimi güncelle (ama cleanup'la çift koruma)
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

  console.log('[firebase-messaging-sw.js] 🔔 Showing notification:', notificationTitle, notificationBody);
  console.log('[firebase-messaging-sw.js] Notification options:', notificationOptions);
  
  try {
    const promise = self.registration.showNotification(notificationTitle, notificationOptions);
    console.log('[firebase-messaging-sw.js] showNotification called');
    
    return promise
      .then(() => {
        console.log('[firebase-messaging-sw.js] ✅ Notification shown successfully');
        console.log('[firebase-messaging-sw.js] ========== END ==========');
        // Clean up processing marker after successful show
        setTimeout(() => {
          processingNotifications.delete(notificationId);
          console.log('[firebase-messaging-sw.js] 🗑️ Removed from processing set');
        }, 1000); // 1 saniye sonra temizle
      })
      .catch((error) => {
        console.error('[firebase-messaging-sw.js] ❌ Error showing notification:', error);
        console.error('[firebase-messaging-sw.js] Error details:', error.message, error.stack);
        processingNotifications.delete(notificationId); // Error durumunda da temizle
      });
  } catch (error) {
    console.error('[firebase-messaging-sw.js] ❌ Error in onBackgroundMessage:', error);
    console.error('[firebase-messaging-sw.js] Error details:', error.message, error.stack);
    processingNotifications.delete(notificationId); // Error durumunda temizle
    return Promise.reject(error);
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
  console.log('[firebase-messaging-sw.js] ========== NOTIFICATION CLICK ==========');
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
    receiverRole: notificationData.receiverRole,
  });
  
  // Her bildirim tipine göre URL belirleme
  switch (notificationType) {
    case 'message':
      // Coach/Student mesajları
      // CRITICAL: receiverRole kontrolü - coach'a gelen mesajlar için /coach/chat
      const receiverRole = notificationData.receiverRole || notificationData.role || '';
      console.log('[firebase-messaging-sw.js] 🔍 Receiver Role Check:', { receiverRole, raw: notificationData.receiverRole, role: notificationData.role });
      
      if (receiverRole === 'coach') {
        // Coach'a gelen mesaj - /coach/chat sayfasına git
        if (notificationData.conversationId) {
          targetUrl = `/coach/chat?conversationId=${encodeURIComponent(notificationData.conversationId)}`;
        } else if (notificationData.userId) {
          targetUrl = `/coach/chat?userId=${encodeURIComponent(notificationData.userId)}`;
        } else {
          targetUrl = '/coach/chat';
        }
        console.log('[firebase-messaging-sw.js] ✅ Message notification - coach receiver:', targetUrl);
      } else if (notificationData.conversationId) {
        // Student'a gelen mesaj veya receiverRole belirtilmemiş - /mesajlar sayfası
        targetUrl = `/mesajlar?conversationId=${encodeURIComponent(notificationData.conversationId)}`;
        console.log('[firebase-messaging-sw.js] ✅ Message notification - student/conversationId:', notificationData.conversationId);
      } else if (notificationData.userId) {
        // Sadece userId var - student için (fallback)
        targetUrl = `/mesajlar?userId=${encodeURIComponent(notificationData.userId)}`;
        console.log('[firebase-messaging-sw.js] ✅ Message notification - userId fallback:', notificationData.userId);
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
  console.log('[firebase-messaging-sw.js] 🔍 Notification Data Debug:', {
    receiverRole: notificationData.receiverRole,
    role: notificationData.role,
    type: notificationType,
    conversationId: notificationData.conversationId,
    userId: notificationData.userId
  });
  
  // Mevcut pencereyi bul veya yeni pencere aç
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const fullUrl = self.location.origin + targetUrl;
        console.log('[firebase-messaging-sw.js] Full URL:', fullUrl);
        
        // Eğer açık bir pencere varsa, onu kullan ve navigate et
        for (const client of clientList) {
          if (client.url && client.url.includes(self.location.origin)) {
            console.log('[firebase-messaging-sw.js] ✅ Found existing window:', client.url);
            console.log('[firebase-messaging-sw.js] Navigating to:', fullUrl);
            
            // Önce focus et
            client.focus();
            
            // client.navigate() modern API, fallback için window.open kullan
            if ('navigate' in client && typeof client.navigate === 'function') {
              return client.navigate(fullUrl).catch((err) => {
                console.warn('[firebase-messaging-sw.js] navigate() failed, using window.open fallback:', err);
                return clients.openWindow(fullUrl);
              });
            } else {
              // Fallback: window.open kullan (daha uyumlu)
              return clients.openWindow(fullUrl);
            }
          }
        }
        
        // Açık pencere yoksa yeni pencere aç
        console.log('[firebase-messaging-sw.js] ⚠️ No existing window found, opening new window:', fullUrl);
        return clients.openWindow(fullUrl);
      })
      .catch((error) => {
        console.error('[firebase-messaging-sw.js] ❌ Error handling notification click:', error);
        // Fallback: direkt URL aç
        const fullUrl = self.location.origin + targetUrl;
        console.log('[firebase-messaging-sw.js] Fallback: opening window:', fullUrl);
        return clients.openWindow(fullUrl);
      })
      .then((client) => {
        if (client) {
          console.log('[firebase-messaging-sw.js] ✅ Window opened/navigated successfully');
        } else {
          console.warn('[firebase-messaging-sw.js] ⚠️ No client returned');
        }
      })
  );
  
  console.log('[firebase-messaging-sw.js] ========== END NOTIFICATION CLICK ==========');
});

