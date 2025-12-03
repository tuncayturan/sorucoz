"use client";

import { useEffect } from "react";

/**
 * Service Worker otomatik kayıt component'i
 * Uygulama başladığında service worker'ı otomatik olarak kaydeder
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      console.log("[Service Worker] Not supported in this environment");
      return;
    }

    // Service Worker'ı kaydet
    const registerServiceWorker = async () => {
      try {
        console.log("[Service Worker] 🔄 Starting registration...");
        
        // iOS tespit
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
        
        console.log("[Service Worker] Device:", { isIOS, isIOSSafari });
        
        // iOS Safari için farklı scope kullan
        const swScope = isIOSSafari ? "/" : "/firebase-cloud-messaging-push-scope";
        
        console.log("[Service Worker] Using scope:", swScope);
        
        // Önce mevcut service worker'ları kontrol et
        const existingRegistration = await navigator.serviceWorker.getRegistration(swScope);
        
        if (existingRegistration) {
          console.log("[Service Worker] ✅ Already registered:", existingRegistration.scope);
          
          // Update kontrolü yap
          existingRegistration.update()
            .then(() => console.log("[Service Worker] ✅ Update check completed"))
            .catch((error) => console.warn("[Service Worker] ⚠️ Update check failed:", error));
          
          return;
        }
        
        // Yeni service worker kaydet
        console.log("[Service Worker] Registering new SW with scope:", swScope);
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          {
            scope: swScope,
            type: "classic"
          }
        );
        
        console.log("[Service Worker] ✅ Registered successfully:", registration.scope);
        
        // Service worker'ın aktif olmasını bekle
        if (registration.installing) {
          console.log("[Service Worker] 🔄 Installing...");
          registration.installing.addEventListener("statechange", function () {
            console.log(`[Service Worker] State changed to: ${this.state}`);
            if (this.state === "activated") {
              console.log("[Service Worker] ✅ Activated");
            }
          });
        } else if (registration.waiting) {
          console.log("[Service Worker] ⏳ Waiting, activating immediately...");
          // Skip waiting to activate immediately
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          
          // Force page reload to use new service worker
          setTimeout(() => {
            console.log("[Service Worker] 🔄 Reloading to use new service worker...");
            window.location.reload();
          }, 100);
        } else if (registration.active) {
          console.log("[Service Worker] ✅ Already active and running");
        }
        
        // Service worker state change listener
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log("[Service Worker] 🔄 Controller changed, new service worker active");
        });
        
        // Update kontrolü yap
        registration.update()
          .then(() => console.log("[Service Worker] ✅ Update check completed"))
          .catch((error) => console.warn("[Service Worker] ⚠️ Update check failed:", error));
        
      } catch (error) {
        console.error("[Service Worker] ❌ Registration failed:", error);
      }
    };

    // Service Worker'ı kaydet (async)
    registerServiceWorker();
    
    // Sayfa yüklendiğinde kontrol et
    window.addEventListener("load", () => {
      console.log("[Service Worker] 🔄 Page loaded, checking registration...");
      
      // iOS tespit
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
      const swScope = isIOSSafari ? "/" : "/firebase-cloud-messaging-push-scope";
      
      navigator.serviceWorker.getRegistration(swScope)
        .then((registration) => {
          if (registration) {
            console.log("[Service Worker] ✅ Active on page load, scope:", registration.scope);
          } else {
            console.log("[Service Worker] ⚠️ Not registered on page load, re-registering...");
            registerServiceWorker();
          }
        });
    });
  }, []);

  return null; // Bu component hiçbir şey render etmez
}

