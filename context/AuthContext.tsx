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
              console.log("[AuthContext] User authenticated, requesting FCM token...");
              
              // Token alma işlemini arka planda başlat (auth flow'u bloklamaz)
              setTimeout(async () => {
                try {
                  const token = await requestNotificationPermission();
                  if (token) {
                    console.log("[AuthContext] ✅ FCM token received, saving...");
                    await saveFCMTokenToUser(u.uid, token);
                    console.log("[AuthContext] ✅ Token saved successfully");
                  } else {
                    console.warn("[AuthContext] ⚠️ No FCM token received (permission denied or not supported)");
                  }
                } catch (error) {
                  console.error("[AuthContext] ❌ Error in FCM token process:", error);
                  // Token hatası uygulamayı durdurmamalı
                }
              }, 1000); // 1 saniye bekle - service worker'ın hazır olmasını garantile
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
