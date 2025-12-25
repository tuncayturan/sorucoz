import { getMessagingInstance, db } from "./firebase";
import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, arrayRemove, getDoc } from "firebase/firestore";
import { defaultVapidKey } from "./firebase/config";

declare global {
  interface Window {
    AndroidGoogleSignIn?: {
      signIn: () => void;
      getFCMToken: () => void;
    };
    handleNativeFCMToken?: (token: string) => void;
  }
}

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
      registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/firebase-cloud-messaging-push-scope",
      });
    }

    // Service worker'ın aktif olmasını bekle
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration!.installing!.addEventListener("statechange", function () {
          if (this.state === "activated") {
            resolve();
          }
        });
      });
    } else if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      await new Promise<void>((resolve) => {
        registration!.waiting!.addEventListener("statechange", function () {
          if (this.state === "activated") {
            resolve();
          }
        });
      });
    } else if (registration.active) {
    }

    // Service worker'ın gerçekten aktif olduğundan emin ol
    if (!registration.active) {
      return null;
    }

    return registration;
  } catch (error) {
    return null;
  }
}

/**
 * FCM token'ı alır ve döndürür
 * NOT: Mobilde bu fonksiyon MUTLAKA user gesture (button click) içinden çağrılmalı
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // 0. Android Native Bridge desteği - BİRİNCİ ÖNCELİK
    const isAndroidNative = typeof window !== "undefined" && !!window.AndroidGoogleSignIn;

    if (isAndroidNative) {
      console.log("[fcmUtils] 📱 Using Android Native bridge for token retrieval...");
      try {
        return await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn("[fcmUtils] ⚠️ Native FCM token timeout after 10s");
            resolve(null);
          }, 10000); // 10 saniye bekle

          window.handleNativeFCMToken = (token: string) => {
            console.log("[fcmUtils] ✅ Received token from native bridge");
            clearTimeout(timeout);
            resolve(token);
          };

          window.AndroidGoogleSignIn?.getFCMToken();
        });
      } catch (nativeError) {
        console.error("[fcmUtils] ❌ Native bridge error:", nativeError);
        // Hata olursa (nadir) web yöntemine devam et
      }
    }

    // 1. Service Worker kontrolü ve kaydı
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker not supported");
    }

    // iOS tespit - iOS Safari için farklı scope
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    const swScope = isIOSSafari ? "/" : "/firebase-cloud-messaging-push-scope";

    // iOS PWA kontrolü - iOS'ta bildirimler sadece PWA modunda çalışır
    const isPWA = typeof window !== "undefined" && (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );

    if (isIOS && !isPWA) {
      // iOS'ta PWA değilse token almayı deneyebiliriz ama bildirimler çalışmayabilir
    }
    let registration = await navigator.serviceWorker.getRegistration(swScope);

    if (!registration) {
      try {
        registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
          scope: swScope,
          type: "classic"
        });
      } catch (regError: any) {
        throw new Error(`Service Worker registration failed: ${regError.message}`);
      }

      // Service worker'ın aktif olmasını bekle
      if (registration.installing) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Service Worker activation timeout"));
          }, 10000); // 10 saniye timeout

          registration!.installing!.addEventListener("statechange", function () {
            if (this.state === "activated") {
              clearTimeout(timeout);
              resolve();
            } else if (this.state === "redundant") {
              clearTimeout(timeout);
              reject(new Error("Service Worker became redundant"));
            }
          });
        });
      }
    }

    // Service Worker durumu
    if (!registration.active) {
      throw new Error("Service Worker is not active");
    }
    // 2. Messaging instance
    const messaging = getMessagingInstance();
    if (!messaging) {
      throw new Error("Failed to create messaging instance");
    }
    // 3. VAPID key
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || defaultVapidKey;

    if (!vapidKey) {
      throw new Error("VAPID key not configured");
    }

    // 4. Token al
    try {
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        return token;
      } else {
        throw new Error("getToken returned null");
      }
    } catch (tokenError: any) {
      throw tokenError;
    }
  } catch (error: any) {
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Kullanıcının FCM token'ını Firestore'a kaydeder
 * SADECE SON TOKEN'I TUTAR - Eski token'lar silinir
 * AGGRESSIVE DUPLICATE PREVENTION
 */
export async function saveFCMTokenToUser(userId: string, token: string): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);

    // AGGRESSIVE: Önce mevcut token'ları kontrol et
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const existingTokens = (userSnap.data().fcmTokens as string[]) || [];
        // Eğer bu token zaten varsa ve tek token ise, güncelleme yapma
        if (existingTokens.length === 1 && existingTokens[0] === token) {
          return;
        }

        // Duplicate token kontrolü
        const uniqueTokens = [...new Set(existingTokens)];
        if (uniqueTokens.length !== existingTokens.length) {
        }
      }
    } catch (error) {
    }

    // SADECE YENİ TOKEN'I KAYDET - TÜM ESKİLERİ SİL
    // Bu duplicate notification sorununu %100 çözer
    await updateDoc(userRef, {
      fcmTokens: [token], // Array'e sadece yeni token'ı koy, eski tüm token'ları sil
      lastTokenUpdate: new Date(),
    });

    // Token'ın gerçekten kaydedildiğini doğrula
    try {
      const verifySnap = await getDoc(userRef);
      if (verifySnap.exists()) {
        const savedTokens = (verifySnap.data().fcmTokens as string[]) || [];
        const tokenExists = savedTokens.includes(token);
        if (!tokenExists) {
          // Tekrar kaydet
          await updateDoc(userRef, {
            fcmTokens: [token],
            lastTokenUpdate: new Date(),
          });
        }
      } else {
        throw new Error("User document not found");
      }
    } catch (verifyError) {
      // Verification hatası token kaydetmeyi başarısız yapmaz
    }
  } catch (error: any) {
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
    // 0. Android Native Bridge check - if present, bypass web Notification API check
    const isAndroidNative = typeof window !== "undefined" && !!window.AndroidGoogleSignIn;

    // Notification API kontrolü (Sadece web/iOS için zorunlu)
    if (!isAndroidNative && !("Notification" in window)) {
      throw new Error("Notification API not available");
    }

    // Mevcut izin durumu (Android native ise web durumuna bakma)
    const currentPermission = isAndroidNative ? "granted" : (typeof Notification !== 'undefined' ? Notification.permission : "default");

    // İzin zaten verilmişse (veya Android ise) direkt token al
    if (currentPermission === "granted" || isAndroidNative) {
      console.log("[fcmUtils] Silent token retrieval started...");
      const token = await getFCMToken();
      return token;
    }

    // İzin reddedilmişse (Android'de bilemeyiz ama web seviyesinde bakıyoruz)
    if (!isAndroidNative && currentPermission === "denied") {
      throw new Error("Notification permission was denied");
    }

    // İzin iste (MUTLAKA user gesture gerekli - button click içinden çağrılmalı)
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await getFCMToken();

      if (token) {
      } else {
      }

      return token;
    } else if (permission === "denied") {
      throw new Error("User denied notification permission");
    } else {
      return null;
    }
  } catch (error: any) {
    throw error; // Re-throw to let caller handle it
  }
}

