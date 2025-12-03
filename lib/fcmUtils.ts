import { getMessagingInstance, db } from "./firebase";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { defaultVapidKey } from "./firebase/config";

/**
 * Service worker'ı kaydeder ve aktif olmasını bekler
 * Not: ServiceWorkerRegistration component'i zaten otomatik kayıt yapar,
 * bu fonksiyon sadece mevcut registration'ı kontrol eder
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    // Önce mevcut service worker'ı kontrol et (Firebase'in scope'u ile)
    let registration = await navigator.serviceWorker.getRegistration("/firebase-cloud-messaging-push-scope");
    
    if (!registration) {
      // Yeni service worker kaydet - Firebase'in varsayılan scope'unu kullan
      console.log("[FCM] No existing service worker found, registering new one...");
      registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/firebase-cloud-messaging-push-scope",
      });
      console.log("[FCM] Service Worker registered:", registration);
    } else {
      console.log("[FCM] Service Worker already registered (using existing):", registration.scope);
    }

    // Service worker'ın aktif olmasını bekle
    if (registration.installing) {
      console.log("[FCM] Service Worker is installing, waiting...");
      await new Promise<void>((resolve) => {
        registration!.installing!.addEventListener("statechange", function () {
          if (this.state === "activated") {
            console.log("[FCM] Service Worker activated");
            resolve();
          }
        });
      });
    } else if (registration.waiting) {
      console.log("[FCM] Service Worker is waiting, activating...");
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      await new Promise<void>((resolve) => {
        registration!.waiting!.addEventListener("statechange", function () {
          if (this.state === "activated") {
            console.log("[FCM] Service Worker activated");
            resolve();
          }
        });
      });
    } else if (registration.active) {
      console.log("[FCM] Service Worker is already active");
    }

    // Service worker'ın gerçekten aktif olduğundan emin ol
    if (!registration.active) {
      console.error("[FCM] Service Worker is not active");
      return null;
    }

    return registration;
  } catch (error) {
    console.error("[FCM] Service Worker registration failed:", error);
    return null;
  }
}

/**
 * FCM token'ı alır ve döndürür
 * NOT: Mobilde bu fonksiyon MUTLAKA user gesture (button click) içinden çağrılmalı
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    console.log("[FCM] 🚀 Starting token retrieval...");
    
    // 1. Service Worker kontrolü ve kaydı
    if (!("serviceWorker" in navigator)) {
      console.error("[FCM] ❌ Service Worker not supported");
      return null;
    }

    // iOS tespit - iOS Safari için farklı scope
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
    const swScope = isIOSSafari ? "/" : "/firebase-cloud-messaging-push-scope";
    
    console.log("[FCM] Device info:", { isIOS, isIOSSafari, scope: swScope });
    
    let registration = await navigator.serviceWorker.getRegistration(swScope);
    
    if (!registration) {
      console.log("[FCM] 📝 Registering service worker with scope:", swScope);
      registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: swScope,
        type: "classic"
      });
      
      // Service worker'ın aktif olmasını bekle
      if (registration.installing) {
        console.log("[FCM] ⏳ Waiting for service worker to activate...");
        await new Promise<void>((resolve) => {
          registration!.installing!.addEventListener("statechange", function () {
            if (this.state === "activated") {
              console.log("[FCM] ✅ Service Worker activated");
              resolve();
            }
          });
        });
      }
    }

    if (!registration.active) {
      console.error("[FCM] ❌ Service Worker not active");
      return null;
    }
    
    console.log("[FCM] ✅ Service Worker ready");

    // 2. Messaging instance
    const messaging = getMessagingInstance();
    if (!messaging) {
      console.error("[FCM] ❌ Messaging not available");
      return null;
    }
    console.log("[FCM] ✅ Messaging instance created");

    // 3. VAPID key
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || defaultVapidKey;
    
    if (!vapidKey) {
      console.error("[FCM] ❌ VAPID key not found");
      return null;
    }
    
    const usingDefault = vapidKey === defaultVapidKey;
    console.log("[FCM] ✅ VAPID key:", usingDefault ? "default" : "from env");

    // 4. Token al
    console.log("[FCM] 📞 Requesting token from Firebase...");
    const token = await getToken(messaging, { 
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    
    if (token) {
      console.log("[FCM] ✅ Token received:", token.substring(0, 30) + "...");
      return token;
    } else {
      console.warn("[FCM] ⚠️ No token received (permission may be denied)");
      return null;
    }
  } catch (error: any) {
    console.error("[FCM] ❌ Error getting token:", error.message || error);
    return null;
  }
}

/**
 * Kullanıcının FCM token'ını Firestore'a kaydeder
 * SADECE SON TOKEN'I TUTAR - Eski token'lar silinir
 * Bu sayede duplicate notification sorunu ortadan kalkar
 */
export async function saveFCMTokenToUser(userId: string, token: string): Promise<void> {
  try {
    console.log("[FCM] Saving token to Firestore for user:", userId);
    const userRef = doc(db, "users", userId);
    
    // SADECE son token'ı tut - eski token'ları sil
    // Bu duplicate notification sorununu çözer
    await updateDoc(userRef, {
      fcmTokens: [token], // Array'e sadece yeni token'ı koy
      lastTokenUpdate: new Date(),
    });
    
    console.log("[FCM] ✅ Token saved successfully (old tokens removed)");
    console.log("[FCM] Token:", token.substring(0, 30) + "...");
  } catch (error) {
    console.error("[FCM] Error saving FCM token to Firestore:", error);
    throw error;
  }
}

/**
 * Kullanıcının eski FCM token'ını Firestore'dan kaldırır
 */
export async function removeFCMTokenFromUser(userId: string, token: string): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      fcmTokens: arrayRemove(token),
    });
  } catch (error) {
    console.error("Error removing FCM token:", error);
    throw error;
  }
}

/**
 * Foreground mesajları dinler (uygulama açıkken gelen bildirimler)
 */
export function onMessageListener(): Promise<any> {
  return new Promise((resolve) => {
    const messaging = getMessagingInstance();
    if (!messaging) {
      resolve(null);
      return;
    }

    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
}

/**
 * Bildirim izni ister ve token'ı alır
 * MOBILE FIX: Bu fonksiyon MUTLAKA user gesture (button click) içinden çağrılmalı
 * Mobil tarayıcılar user gesture olmadan Notification.requestPermission() çağrılmasına izin vermez
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    console.log("[FCM] 🔔 Checking notification support...");
    
    // Notification API kontrolü
    if (!("Notification" in window)) {
      console.error("[FCM] ❌ Notifications not supported in this browser");
      return null;
    }

    // Mevcut izin durumu
    console.log("[FCM] 📋 Current permission:", Notification.permission);

    // İzin zaten verilmişse direkt token al
    if (Notification.permission === "granted") {
      console.log("[FCM] ✅ Permission already granted");
      return await getFCMToken();
    }

    // İzin reddedilmişse
    if (Notification.permission === "denied") {
      console.warn("[FCM] ❌ Permission denied by user");
      return null;
    }

    // İzin iste (MUTLAKA user gesture gerekli - button click içinden çağrılmalı)
    console.log("[FCM] 📞 Requesting notification permission...");
    const permission = await Notification.requestPermission();
    console.log("[FCM] 📝 Permission result:", permission);
    
    if (permission === "granted") {
      console.log("[FCM] ✅ Permission granted! Getting token...");
      return await getFCMToken();
    } else {
      console.warn("[FCM] ⚠️ Permission not granted:", permission);
      return null;
    }
  } catch (error: any) {
    console.error("[FCM] ❌ Error requesting permission:", error.message || error);
    return null;
  }
}

