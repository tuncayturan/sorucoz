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
    console.log("[FCM] 🚀 === STARTING TOKEN RETRIEVAL ===");
    
    // 1. Service Worker kontrolü ve kaydı
    if (!("serviceWorker" in navigator)) {
      console.error("[FCM] ❌ FATAL: Service Worker not supported");
      throw new Error("Service Worker not supported");
    }

    // iOS tespit - iOS Safari için farklı scope
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    const swScope = isIOSSafari ? "/" : "/firebase-cloud-messaging-push-scope";
    
    console.log("[FCM] 📱 Device info:");
    console.log("  - iOS:", isIOS);
    console.log("  - iOS Safari:", isIOSSafari);
    console.log("  - Scope:", swScope);
    console.log("  - User Agent:", ua.substring(0, 80) + "...");
    
    console.log("[FCM] 🔍 Checking for existing service worker...");
    let registration = await navigator.serviceWorker.getRegistration(swScope);
    
    if (!registration) {
      console.log("[FCM] ❌ No registration found");
      console.log("[FCM] 📝 Registering new service worker...");
      console.log("  - Script: /firebase-messaging-sw.js");
      console.log("  - Scope:", swScope);
      
      try {
        registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: swScope,
          type: "classic"
        });
        console.log("[FCM] ✅ Registration successful");
      } catch (regError: any) {
        console.error("[FCM] ❌ Registration FAILED:", regError.message);
        throw new Error(`Service Worker registration failed: ${regError.message}`);
      }
      
      // Service worker'ın aktif olmasını bekle
      if (registration.installing) {
        console.log("[FCM] ⏳ Service worker is installing, waiting...");
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Service Worker activation timeout"));
          }, 10000); // 10 saniye timeout
          
          registration!.installing!.addEventListener("statechange", function () {
            console.log(`[FCM] State changed: ${this.state}`);
            if (this.state === "activated") {
              clearTimeout(timeout);
              console.log("[FCM] ✅ Service Worker activated");
              resolve();
            } else if (this.state === "redundant") {
              clearTimeout(timeout);
              reject(new Error("Service Worker became redundant"));
            }
          });
        });
      }
    } else {
      console.log("[FCM] ✅ Existing registration found:", registration.scope);
    }

    // Service Worker durumu
    console.log("[FCM] 📊 Service Worker status:");
    console.log("  - Installing:", !!registration.installing);
    console.log("  - Waiting:", !!registration.waiting);
    console.log("  - Active:", !!registration.active);

    if (!registration.active) {
      console.error("[FCM] ❌ FATAL: Service Worker not active");
      throw new Error("Service Worker is not active");
    }
    
    console.log("[FCM] ✅ Service Worker is ready");

    // 2. Messaging instance
    console.log("[FCM] 🔧 Creating messaging instance...");
    const messaging = getMessagingInstance();
    if (!messaging) {
      console.error("[FCM] ❌ FATAL: Messaging instance is null");
      throw new Error("Failed to create messaging instance");
    }
    console.log("[FCM] ✅ Messaging instance created");

    // 3. VAPID key
    console.log("[FCM] 🔑 Checking VAPID key...");
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || defaultVapidKey;
    
    if (!vapidKey) {
      console.error("[FCM] ❌ FATAL: VAPID key not found");
      throw new Error("VAPID key not configured");
    }
    
    const usingDefault = vapidKey === defaultVapidKey;
    console.log("[FCM] ✅ VAPID key available:", usingDefault ? "using default" : "from environment");
    console.log("[FCM] VAPID key (first 20 chars):", vapidKey.substring(0, 20) + "...");

    // 4. Token al
    console.log("[FCM] 📞 Requesting token from Firebase Cloud Messaging...");
    try {
      const token = await getToken(messaging, { 
        vapidKey,
        serviceWorkerRegistration: registration,
      });
      
      if (token) {
        console.log("[FCM] ✅ === TOKEN RECEIVED SUCCESSFULLY ===");
        console.log("[FCM] Token length:", token.length);
        console.log("[FCM] Token preview:", token.substring(0, 30) + "...");
        return token;
      } else {
        console.error("[FCM] ❌ === TOKEN IS NULL ===");
        console.error("[FCM] getToken returned null - possible reasons:");
        console.error("  1. User denied permission (but we already checked this)");
        console.error("  2. VAPID key is invalid");
        console.error("  3. Firebase project misconfigured");
        console.error("  4. Network error");
        throw new Error("getToken returned null");
      }
    } catch (tokenError: any) {
      console.error("[FCM] ❌ === ERROR GETTING TOKEN ===");
      console.error("[FCM] Error message:", tokenError.message);
      console.error("[FCM] Error code:", tokenError.code);
      console.error("[FCM] Error stack:", tokenError.stack);
      throw tokenError;
    }
  } catch (error: any) {
    console.error("[FCM] ❌ === FATAL ERROR in getFCMToken ===");
    console.error("[FCM] Error:", error.message || error.toString());
    console.error("[FCM] Stack:", error.stack);
    throw error; // Re-throw to let caller handle
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
    console.log("[FCM] 🔔 === STARTING PERMISSION REQUEST ===");
    console.log("[FCM] 📊 Environment check:");
    console.log("  - Notification API:", "Notification" in window);
    console.log("  - Service Worker:", "serviceWorker" in navigator);
    console.log("  - User Agent:", navigator.userAgent.substring(0, 80) + "...");
    
    // Notification API kontrolü
    if (!("Notification" in window)) {
      console.error("[FCM] ❌ FATAL: Notifications not supported in this browser");
      throw new Error("Notification API not available");
    }

    // Mevcut izin durumu
    const currentPermission = Notification.permission;
    console.log("[FCM] 📋 Current permission:", currentPermission);

    // İzin zaten verilmişse direkt token al
    if (currentPermission === "granted") {
      console.log("[FCM] ✅ Permission already granted, getting token...");
      const token = await getFCMToken();
      console.log("[FCM] Token result:", token ? "SUCCESS" : "FAILED");
      return token;
    }

    // İzin reddedilmişse
    if (currentPermission === "denied") {
      console.error("[FCM] ❌ Permission previously denied by user");
      throw new Error("Notification permission was denied");
    }

    // İzin iste (MUTLAKA user gesture gerekli - button click içinden çağrılmalı)
    console.log("[FCM] 📞 Requesting notification permission from user...");
    const permission = await Notification.requestPermission();
    console.log("[FCM] 📝 User responded with:", permission);
    
    if (permission === "granted") {
      console.log("[FCM] ✅ Permission GRANTED! Now getting token...");
      const token = await getFCMToken();
      
      if (token) {
        console.log("[FCM] ✅ === SUCCESS: Token received ===");
      } else {
        console.error("[FCM] ❌ === FAILED: Token is null ===");
      }
      
      return token;
    } else if (permission === "denied") {
      console.error("[FCM] ❌ User DENIED permission");
      throw new Error("User denied notification permission");
    } else {
      console.warn("[FCM] ⚠️ Permission response:", permission, "(not granted/denied)");
      return null;
    }
  } catch (error: any) {
    console.error("[FCM] ❌ === ERROR in requestNotificationPermission ===");
    console.error("[FCM] Error message:", error.message || error.toString());
    console.error("[FCM] Error stack:", error.stack);
    throw error; // Re-throw to let caller handle it
  }
}

