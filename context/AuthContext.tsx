"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Runtime'da auth instance'ını düzgün al
    let unsub: (() => void) | null = null;
    
    const initAuth = async () => {
      try {
        // Browser'da çalıştığımızdan emin ol
        if (typeof window === "undefined") {
          setLoading(false);
          return;
        }

        const app = getFirebaseApp();
        
        // App'in düzgün initialize edildiğini kontrol et
        if (!app || !('options' in app)) {
          console.error("Firebase app not properly initialized");
          setLoading(false);
          return;
        }

        const authInstance = getAuth(app);
        
        // Auth instance'ın düzgün olduğunu kontrol et
        if (!authInstance) {
          console.error("Firebase auth instance not available");
          setLoading(false);
          return;
        }
        
        // onAuthStateChanged'in var olduğunu ve fonksiyon olduğunu kontrol et
        if (typeof onAuthStateChanged === 'function' && authInstance) {
          unsub = onAuthStateChanged(authInstance, async (u) => {
            setUser(u);
            setLoading(false);

            // ✅ MOBIL TOKEN FIX: Kullanıcı giriş yaptığında token'ı otomatik al
            if (u) {
              console.log("[AuthContext] 🔐 User authenticated:", u.email);
              console.log("[AuthContext] 📱 Starting FCM token process...");
              
              // Service worker'ın hazır olmasını garantilemek için bekleme ve retry mekanizması
              // Mobil cihazlar için daha uzun süre ve daha fazla deneme
              const waitForServiceWorkerAndGetToken = async (maxRetries = 8, delayMs = 3000) => {
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                  try {
                    console.log(`[AuthContext] 🔄 Attempt ${attempt}/${maxRetries} - Checking service worker...`);
                    
                    // Service worker kontrolü
                    if ('serviceWorker' in navigator) {
                      const registration = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
                      
                      if (registration && registration.active) {
                        console.log("[AuthContext] ✅ Service worker is active");
                        
                        // Token alma işlemi
                        console.log("[AuthContext] 📞 Requesting notification permission...");
                        const token = await requestNotificationPermission();
                        
                        if (token) {
                          console.log("[AuthContext] ✅ FCM token received!");
                          console.log("[AuthContext] 💾 Saving token to Firestore...");
                          await saveFCMTokenToUser(u.uid, token);
                          console.log("[AuthContext] ✅ Token saved successfully to Firestore!");
                          return; // Başarılı, döngüyü kır
                        } else {
                          console.warn(`[AuthContext] ⚠️ No token received on attempt ${attempt}`);
                          console.warn("[AuthContext] Possible reasons: permission denied, VAPID key missing, or network error");
                        }
                      } else {
                        console.warn(`[AuthContext] ⏳ Service worker not ready yet (attempt ${attempt}/${maxRetries})`);
                      }
                    } else {
                      console.error("[AuthContext] ❌ Service worker not supported in this browser");
                      return; // Service worker desteklenmiyor, çık
                    }
                    
                    // Son denemede değilse bekle
                    if (attempt < maxRetries) {
                      console.log(`[AuthContext] ⏱️ Waiting ${delayMs}ms before retry...`);
                      await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                  } catch (error) {
                    console.error(`[AuthContext] ❌ Error on attempt ${attempt}:`, error);
                    
                    // Son denemede değilse bekle ve tekrar dene
                    if (attempt < maxRetries) {
                      await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                  }
                }
                
                console.error("[AuthContext] ❌ Failed to get FCM token after all retries");
                console.error("[AuthContext] Please check:");
                console.error("  1. Notification permission granted?");
                console.error("  2. VAPID key set in environment variables?");
                console.error("  3. Service worker registered correctly?");
                console.error("  4. Network connection stable?");
              };
              
              // Arka planda token alma işlemini başlat
              waitForServiceWorkerAndGetToken().catch(err => {
                console.error("[AuthContext] ❌ Fatal error in token process:", err);
              });
            }
          });
        } else {
          console.error("onAuthStateChanged is not available or authInstance is invalid");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (unsub) {
        unsub();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
