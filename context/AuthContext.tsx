"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";
import { autoCleanupUserTokens } from "@/lib/autoCleanupTokens";

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

            // ✅ MOBIL TOKEN FIX + AUTO CLEANUP
            if (u) {
              console.log("[AuthContext] 🔐 User authenticated:", u.email);
              
              // 1. ÖNCE: Otomatik token cleanup (duplicate'leri temizle)
              setTimeout(() => {
                autoCleanupUserTokens(u.uid).catch(err => {
                  console.error("[AuthContext] Auto cleanup error:", err);
                });
              }, 1000);
              
              // 2. SONRA: Notification permission kontrol
              // Mobilde Notification.requestPermission() user gesture gerektirir
              // Eğer Android Native Bridge varsa, web iznine bakmadan sessizce token almayı dene
              const isAndroidNative = typeof window !== "undefined" && !!(window as any).AndroidGoogleSignIn;
              const hasNotificationPermission = 'Notification' in window && Notification.permission === 'granted';

              if (isAndroidNative || hasNotificationPermission) {
                if (isAndroidNative) {
                  console.log("[AuthContext] 📱 Android Native bridge detected, triggered silent registration");
                } else {
                  console.log("[AuthContext] ✅ Notification permission already granted");
                }
                
                // Arka planda token almayı dene
                setTimeout(async () => {
                  try {
                    const token = await requestNotificationPermission();
                    if (token) {
                      console.log("[AuthContext] ✅ Token received silently:", token.substring(0, 10) + "...");
                      await saveFCMTokenToUser(u.uid, token);
                      console.log("[AuthContext] ✅ Token saved to Firestore");
                    }
                  } catch (error) {
                    console.log("[AuthContext] ⚠️ Silent token fetch failed:", error);
                  }
                }, 2000);
              } else {
                console.log("[AuthContext] ℹ️ Permission not granted, and no native bridge found.");
              }
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
