"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getRedirectResult, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";
import { createTrialData } from "@/lib/subscriptionUtils";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Browser'ı kapat (eğer açıksa)
        if (Capacitor.isNativePlatform()) {
          try {
            await Browser.close();
          } catch (e) {
            // Browser zaten kapalı olabilir
          }
        }

        // URL'den Firebase auth token'larını kontrol et
        const apiKey = searchParams?.get('apiKey');
        const accessToken = searchParams?.get('access_token');
        const idToken = searchParams?.get('id_token');
        
        // Eğer URL'de token varsa, onu kullan
        if (idToken && accessToken) {
          try {
            const credential = GoogleAuthProvider.credential(idToken, accessToken);
            const result = await signInWithCredential(auth, credential);
            const user = result.user;
            
            const ref = doc(db, "users", user.uid);
            const snap = await getDoc(ref);

            if (!snap.exists()) {
              const trialData = createTrialData();
              await setDoc(ref, {
                name: user.displayName || "Kullanıcı",
                email: user.email,
                role: "student",
                premium: false,
                createdAt: serverTimestamp(),
                emailVerified: true,
                photoURL: user.photoURL || null,
                fcmTokens: [],
                ...trialData,
              });
            } else {
              const existingData = snap.data();
              if (user.photoURL && !existingData.photoURL) {
                await setDoc(ref, {
                  photoURL: user.photoURL,
                }, { merge: true });
              }
            }

            const role = snap.exists() ? snap.data().role : "student";
            if (role === "admin") {
              router.replace("/admin");
            } else if (role === "coach") {
              router.replace("/coach");
            } else {
              router.replace("/home");
            }
            return;
          } catch (error: any) {
            console.error("Credential sign-in error:", error);
          }
        }

        // Firebase redirect sonucunu yakala
        const result = await getRedirectResult(auth);
        
        if (result) {
          const user = result.user;
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);

          // İlk giriş ise Firestore'a kaydet
          if (!snap.exists()) {
            const trialData = createTrialData();
            await setDoc(ref, {
              name: user.displayName || "Kullanıcı",
              email: user.email,
              role: "student",
              premium: false,
              createdAt: serverTimestamp(),
              emailVerified: true,
              photoURL: user.photoURL || null,
              fcmTokens: [],
              ...trialData,
            });
          } else {
            // Mevcut kullanıcı için photoURL güncelle (eğer yoksa)
            const existingData = snap.data();
            if (user.photoURL && !existingData.photoURL) {
              await setDoc(ref, {
                photoURL: user.photoURL,
              }, { merge: true });
            }
          }

          // FCM token'ı al ve kaydet
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            requestNotificationPermission()
              .then((token) => {
                if (token) {
                  return saveFCMTokenToUser(user.uid, token);
                }
              })
              .catch((error) => {
                // Token kaydetme hatası login işlemini durdurmaz
              });
          }

          const role = snap.exists() ? snap.data().role : "student";

          // Kullanıcıyı uygun sayfaya yönlendir
          if (role === "admin") {
            router.replace("/admin");
          } else if (role === "coach") {
            router.replace("/coach");
          } else {
            router.replace("/home");
          }
        } else {
          // Redirect sonucu yoksa, URL'den hata parametresini kontrol et
          const errorParam = searchParams?.get('error');
          if (errorParam) {
            console.error("Auth error from redirect:", errorParam);
          }
          
          // Mobildeyse login sayfasına yönlendir, web'deyse ana sayfaya
          if (Capacitor.isNativePlatform()) {
            router.replace("/auth/login");
          } else {
            router.replace("/");
          }
        }
      } catch (error: any) {
        console.error("Auth callback error:", error);
        // Hata durumunda login sayfasına yönlendir
        router.replace("/auth/login");
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Giriş yapılıyor...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}

