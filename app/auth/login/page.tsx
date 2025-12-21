"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";
import { createTrialData } from "@/lib/subscriptionUtils";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import IOSInstallPrompt from "@/components/IOSInstallPrompt";
import Toast from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
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
            if (token) {
              console.log("[Login] FCM token received, saving to Firestore...");
              return saveFCMTokenToUser(cred.user.uid, token);
            } else {
              console.warn("[Login] No FCM token received (permission granted but token null)");
            }
          })
          .catch((error) => {
            console.error("[Login] Error in FCM token process:", error);
            // Token kaydetme hatası login işlemini durdurmaz
          });
      } else {
        console.log("[Login] Notification permission not granted, FCMTokenManager will handle it");
      }

      showToast("Giriş başarılı! Yönlendiriliyorsunuz...", "success");
      
      // Biraz bekle ki toast görünsün
      setTimeout(() => {
        if (role === "admin") router.replace("/admin");
        else if (role === "coach") router.replace("/coach");
        else router.replace("/home");
      }, 500);

    } catch (err: any) {
      console.error(err);
      let errorMessage = "Giriş başarısız.";
      
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
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

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
            if (token) {
              console.log("[Google Login] FCM token received, saving to Firestore...");
              return saveFCMTokenToUser(user.uid, token);
            } else {
              console.warn("[Google Login] No FCM token received (permission granted but token null)");
            }
          })
          .catch((error) => {
            console.error("[Google Login] Error in FCM token process:", error);
            // Token kaydetme hatası login işlemini durdurmaz
          });
      } else {
        console.log("[Google Login] Notification permission not granted, FCMTokenManager will handle it");
      }

      const role = snap.exists() ? snap.data().role : "student";

      if (role === "admin") router.replace("/admin");
      else if (role === "coach") router.replace("/coach");
      else router.replace("/home");

    } catch (err: any) {
      // Popup kapatıldığında sessizce görmezden gel
      if (err?.code === "auth/cancelled-popup-request" || err?.code === "auth/popup-closed-by-user") {
        console.log("Google popup kapatıldı");
        return;
      }
      
      console.error("Google Login Error:", err);
      showToast("Google ile giriş başarısız. Lütfen tekrar deneyin.", "error");
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
