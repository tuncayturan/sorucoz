"use client";

import { useEffect } from "react";

/**
 * Service Worker otomatik kayıt component'i
 * Uygulama başladığında service worker'ı otomatik olarak kaydeder
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Service Worker'ı kaydet
    const registerServiceWorker = async () => {
      try {
        // iOS tespit
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
        // iOS Safari için farklı scope kullan
        const swScope = isIOSSafari ? "/" : "/firebase-cloud-messaging-push-scope";
        // Önce mevcut service worker'ları kontrol et
        const existingRegistration = await navigator.serviceWorker.getRegistration(swScope);
        
        if (existingRegistration) {
          // Update kontrolü yap
          existingRegistration.update();
          return;
        }
        
        // Yeni service worker kaydet
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          {
            scope: swScope,
            type: "classic"
          }
        );
        // Service worker'ın aktif olmasını bekle
        if (registration.installing) {
          registration.installing.addEventListener("statechange", function () {
            if (this.state === "activated") {
            }
          });
        } else if (registration.waiting) {
          // Skip waiting to activate immediately
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          
          // Force page reload to use new service worker
          setTimeout(() => {
            window.location.reload();
          }, 100);
        } else if (registration.active) {
        }
        
        // Service worker state change listener
        navigator.serviceWorker.addEventListener('controllerchange', () => {
        });
        
        // Update kontrolü yap
        registration.update();
        
      } catch (error) {
      }
    };

    // Service Worker'ı kaydet (async)
    registerServiceWorker();
    
    // Sayfa yüklendiğinde kontrol et
    window.addEventListener("load", () => {
      // iOS tespit
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
      const swScope = isIOSSafari ? "/" : "/firebase-cloud-messaging-push-scope";
      
      navigator.serviceWorker.getRegistration(swScope)
        .then((registration) => {
          if (registration) {
          } else {
            registerServiceWorker();
          }
        });
    });
  }, []);

  return null; // Bu component hiçbir şey render etmez
}

