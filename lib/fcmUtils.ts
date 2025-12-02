import { getMessagingInstance, db } from "./firebase";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

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
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    console.log("[FCM] Starting token retrieval...");
    
    // Önce service worker'ı kaydet
    const registration = await registerServiceWorker();
    if (!registration) {
      console.error("[FCM] Service worker registration failed");
      return null;
    }
    console.log("[FCM] Service worker registered successfully");

    const messaging = getMessagingInstance();
    if (!messaging) {
      console.error("[FCM] Messaging not available");
      return null;
    }
    console.log("[FCM] Messaging instance created");

    // VAPID key'i environment variable'dan al
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error("[FCM] VAPID key not found. Please set NEXT_PUBLIC_FIREBASE_VAPID_KEY");
      return null;
    }
    console.log("[FCM] VAPID key found");

    // Service worker'ın aktif olduğundan emin ol
    if (!registration.active) {
      console.error("[FCM] Service Worker is not active, cannot get token");
      return null;
    }

    console.log("[FCM] Requesting token from Firebase...");
    const token = await getToken(messaging, { 
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    
    if (token) {
      console.log("[FCM] Token retrieved successfully:", token.substring(0, 20) + "...");
    } else {
      console.warn("[FCM] No token available");
    }
    
    return token;
  } catch (error) {
    console.error("[FCM] Error getting FCM token:", error);
    return null;
  }
}

/**
 * Kullanıcının FCM token'ını Firestore'a kaydeder
 * Token'ları array olarak saklar (bir kullanıcının birden fazla cihazı olabilir)
 */
export async function saveFCMTokenToUser(userId: string, token: string): Promise<void> {
  try {
    console.log("[FCM] Saving token to Firestore for user:", userId);
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
      lastTokenUpdate: new Date(),
    });
    console.log("[FCM] Token saved successfully to Firestore");
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
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    console.log("[FCM] Checking notification support...");
    if (!("Notification" in window)) {
      console.warn("[FCM] This browser does not support notifications");
      return null;
    }

    console.log("[FCM] Requesting notification permission...");
    const permission = await Notification.requestPermission();
    console.log("[FCM] Notification permission:", permission);
    
    if (permission === "granted") {
      console.log("[FCM] Permission granted, getting token...");
      return await getFCMToken();
    } else {
      console.warn("[FCM] Notification permission denied:", permission);
      return null;
    }
  } catch (error) {
    console.error("[FCM] Error requesting notification permission:", error);
    return null;
  }
}

