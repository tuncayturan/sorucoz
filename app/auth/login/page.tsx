"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signInWithCredential,
  getRedirectResult,
} from "firebase/auth";
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
// import { GoogleAuth } from '@capacitor-community/google-auth';
import { auth, db, googleProvider } from "@/lib/firebase";
import { firebaseConfig } from "@/lib/firebase/config";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";
import { createTrialData } from "@/lib/subscriptionUtils";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import IOSInstallPrompt from "@/components/IOSInstallPrompt";
import Toast from "@/components/ui/Toast";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useSiteSettings();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });
  
  const siteLogo = settings.logo && settings.logo.trim() !== "" ? settings.logo : null;
  const siteName = settings.siteName || "SoruÇöz";

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // URL'den google parametresini kontrol et ve otomatik Google Sign-In başlat
  useEffect(() => {
    // URL'den direkt parametreleri al (searchParams henüz hazır olmayabilir)
    const urlParams = new URLSearchParams(window.location.search);
    const googleParam = urlParams.get('google') || searchParams?.get('google');
    const redirectParam = urlParams.get('redirect') || searchParams?.get('redirect');
    
    console.log('Checking for google parameter:', googleParam, 'redirect:', redirectParam);
    
    // Eğer google=true parametresi varsa, otomatik Google Sign-In başlat
    // Browser plugin ile açılan sayfa normal web tarayıcısı gibi çalışır
    if (googleParam === 'true') {
      console.log('Auto-starting Google Sign-In from URL parameter, redirect:', redirectParam);
      
      // loginWithGoogle fonksiyonunu çağır
      const handleGoogleLogin = async () => {
        try {
          console.log('Starting Google Sign-In popup...');
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;

          console.log('Google Sign-In successful, user:', user.email);

          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);

          if (!snap.exists()) {
            const trialData = createTrialData();
            await setDoc(ref, {
              name: user.displayName,
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

          // Eğer redirect parametresi varsa (mobilden geldiyse), deep link ile geri dön
          if (redirectParam) {
            console.log('Redirecting to deep link:', redirectParam);
            window.location.href = redirectParam;
          } else {
            const role = snap.exists() ? snap.data().role : "student";
            if (role === "admin") router.replace("/admin");
            else if (role === "coach") router.replace("/coach");
            else router.replace("/home");
          }
        } catch (err: any) {
          console.error("Google login error:", err);
          if (redirectParam) {
            window.location.href = redirectParam + '?error=' + encodeURIComponent(err.message);
          } else {
            showToast("Google ile giriş başarısız: " + err.message, "error");
          }
        }
      };
      
      // Biraz bekle ki sayfa tam yüklensin ve Firebase hazır olsun
      setTimeout(() => {
        handleGoogleLogin();
      }, 1500);
    }
  }, [searchParams, router]);

  // Redirect sonucunu yakala (Mobil için)
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'web') {
      getRedirectResult(auth)
        .then(async (result) => {
          if (result) {
            const user = result.user;
            const ref = doc(db, "users", user.uid);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
              await setDoc(ref, {
                uid: user.uid,
                email: user.email,
                name: user.displayName || "Kullanıcı",
                role: "student",
                createdAt: serverTimestamp(),
              });
            }
            
            const role = snap.exists() ? snap.data().role : "student";
            if (role === "admin") router.replace("/admin");
            else if (role === "coach") router.replace("/coach");
            else router.replace("/home");
          }
        })
        .catch((error) => {
          console.error("Redirect Error:", error);
          showToast("Giriş hatası: " + error.message, "error");
        });
    }
  }, []);

  // ----------------------------
  // EMAIL LOGIN
  // ----------------------------
  const login = async () => {
    if (!email || !pass) {
      showToast("Tüm alanlar zorunlu.", "error");
      return;
    }

    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email, pass);

      const ref = doc(db, "users", cred.user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        showToast("Hesap bulunamadı. Lütfen kayıt olun.", "error");
        setLoading(false);
        return;
      }

      const userData = snap.data();
      const role = userData.role;
      const emailVerified = userData.emailVerified || false;

      // Email doğrulama kontrolü - sadece email ile kayıt olanlar için
      if (!emailVerified && !cred.user.providerData.some(p => p.providerId === 'google.com')) {
        showToast("⚠️ Email adresiniz doğrulanmamış! Lütfen email kutunuzu kontrol edin. Yine de giriş yapabilirsiniz.", "info");
        // Kullanıcı yine de giriş yapabilir ama uyarı almış olur
      }

      // FCM token'ı al ve kaydet (async, login'i bloklamaz)
      // NOT: Mobilde user gesture olmadan çalışmayabilir, bu yüzden FCMTokenManager buton ile çalışacak
      // Sadece izin zaten verilmişse token almayı dene
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        requestNotificationPermission()
          .then((token) => {
            if (token) {              return saveFCMTokenToUser(cred.user.uid, token);
            } else {
            }
          })
          .catch((error) => {            // Token kaydetme hatası login işlemini durdurmaz
          });
      } else {      }

      showToast("Giriş başarılı! Yönlendiriliyorsunuz...", "success");
      
      // Biraz bekle ki toast görünsün
      setTimeout(() => {
        if (role === "admin") router.replace("/admin");
        else if (role === "coach") router.replace("/coach");
        else router.replace("/home");
      }, 500);

    } catch (err: any) {      let errorMessage = "Giriş başarısız.";
      
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        errorMessage = "Email veya şifre hatalı.";
      } else if (err.code === "auth/user-not-found") {
        errorMessage = "Kullanıcı bulunamadı.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.";
      } else if (err.code === "auth/network-request-failed") {
        errorMessage = "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
      }
      
      showToast(errorMessage, "error");
      setLoading(false);
    }
  };

  // ----------------------------
  // GOOGLE LOGIN
  // ----------------------------
  const loginWithGoogle = async () => {
    try {
      let user;
      
      // Mobilde dış tarayıcıda aç (Android WebView sorununu çözmek için)
      if (Capacitor.getPlatform() !== 'web') {
        try {
          // Railway URL'ini kullanarak Google Sign-In'i web'de aç
          // Web'de çalışan Google Sign-In'i kullan, sonra deep link ile geri dön
          const webAuthUrl = `https://sorucoz-production-8e36.up.railway.app/auth/login?google=true&redirect=${encodeURIComponent('com.sorucoz.app://auth/callback')}`;
          
          console.log('Opening browser with URL:', webAuthUrl);
          
          // Browser plugin ile dış tarayıcıda aç
          await Browser.open({ 
            url: webAuthUrl
          });
          
          console.log('Browser opened successfully');
          
          // Redirect sonucu getRedirectResult ile yakalanacak
          // Deep link ile geri dönüş sağlanacak
          return;
        } catch (error: any) {
          console.error('Browser.open error:', error);
          showToast("Tarayıcı açılamadı: " + error.message, "error");
          return;
        }
      }
      
      const result = await signInWithPopup(auth, googleProvider);
      user = result.user;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        const trialData = createTrialData();
        await setDoc(ref, {
          name: user.displayName,
          email: user.email,
          role: "student", // Tüm yeni kayıtlar student rolünde
          premium: false,
          createdAt: serverTimestamp(),
          emailVerified: true, // Google ile giriş yapanlar otomatik onaylı
          photoURL: user.photoURL || null, // Google profil resmini kaydet
          fcmTokens: [], // FCM token'ları için array
          ...trialData, // 7 günlük trial başlat
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

      // FCM token'ı al ve kaydet (async, login'i bloklamaz)
      // NOT: Mobilde user gesture olmadan çalışmayabilir, bu yüzden FCMTokenManager buton ile çalışacak
      // Sadece izin zaten verilmişse token almayı dene
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        requestNotificationPermission()
          .then((token) => {
            if (token) {              return saveFCMTokenToUser(user.uid, token);
            } else {
            }
          })
          .catch((error) => {            // Token kaydetme hatası login işlemini durdurmaz
          });
      } else {      }

      const role = snap.exists() ? snap.data().role : "student";

      if (role === "admin") router.replace("/admin");
      else if (role === "coach") router.replace("/coach");
      else router.replace("/home");

    } catch (err: any) {
      // Popup kapatıldığında sessizce görmezden gel
      if (err?.code === "auth/cancelled-popup-request" || err?.code === "auth/popup-closed-by-user") {        return;
      }      showToast("Google ile giriş başarısız. Lütfen tekrar deneyin.", "error");
    }
  };

  return (
    <>
      <IOSInstallPrompt />
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] px-6 overflow-hidden relative">
        {/* Decorative gradient circles */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl"></div>

      <div className="w-full max-w-sm animate-slideFade relative z-10">
        {/* LOGO */}
        <div className="flex justify-center mb-8">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-indigo-400/30 rounded-3xl blur-xl transform scale-110"></div>
            <div className="relative w-20 h-20 rounded-3xl overflow-hidden bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
              {siteLogo ? (
                <Image
                  src={siteLogo}
                  alt={siteName}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover rounded-3xl"
                  unoptimized={siteLogo.startsWith("http")}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">{siteName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TITLE */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
            Giriş Yap
          </h1>
          <p className="text-gray-600 text-base">
            Hesabına giriş yaparak devam et.
          </p>
        </div>

        {/* INPUTS */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/80 backdrop-blur-xl p-4 rounded-2xl 
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50 
                       border border-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.08)]
                       transition-all duration-300
                       placeholder:text-gray-400"
            />
          </div>

          <div className="relative">
            <input
              type="password"
              placeholder="Şifre"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              className="w-full bg-white/80 backdrop-blur-xl p-4 rounded-2xl 
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50 
                       border border-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.08)]
                       transition-all duration-300
                       placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* LOGIN BUTTON */}
        <button
          onClick={login}
          disabled={loading}
          className="w-full group relative overflow-hidden py-4 rounded-3xl text-white font-bold text-lg
                   bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600
                   shadow-[0_20px_50px_rgba(59,130,246,0.4)]
                   active:scale-[0.98] transition-all duration-300
                   hover:shadow-[0_25px_60px_rgba(59,130,246,0.5)]
                   hover:scale-[1.02]
                   disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-[0_20px_50px_rgba(59,130,246,0.4)] mb-4"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          <span className="relative z-10">{loading ? "Giriş yapılıyor..." : "Giriş Yap"}</span>
        </button>

        {/* DIVIDER */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          <span className="text-gray-500 text-sm">veya</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        </div>

        {/* GOOGLE BUTTON */}
        <button
          onClick={loginWithGoogle}
          className="w-full py-4 rounded-2xl text-gray-900 font-semibold text-base 
                   bg-white/80 backdrop-blur-xl border border-white/60 
                   shadow-[0_10px_40px_rgba(0,0,0,0.08)]
                   active:scale-[0.98] transition-all duration-300 
                   hover:shadow-[0_15px_50px_rgba(0,0,0,0.12)]
                   hover:scale-[1.01] flex items-center justify-center gap-3 mb-6"
        >
          <Image src="/img/google.png" width={22} height={22} alt="Google" />
          Google ile Giriş Yap
        </button>

        {/* REGISTER LINK */}
        <div className="text-center text-gray-600 text-sm">
          Hesabın yok mu?{" "}
          <span
            className="text-blue-600 font-semibold cursor-pointer hover:text-blue-700 transition-colors"
            onClick={() => router.push("/auth/register")}
          >
            Kayıt Ol
          </span>
        </div>
      </div>

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
