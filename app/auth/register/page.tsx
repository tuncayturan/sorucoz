"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signInWithCredential,
  getRedirectResult,
} from "firebase/auth";
import { Capacitor } from '@capacitor/core';
import { auth, db, googleProvider } from "@/lib/firebase";
import { GoogleSignIn } from "@/lib/google-sign-in";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";
import { createTrialData } from "@/lib/subscriptionUtils";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import Toast from "@/components/ui/Toast";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useSiteSettings();
  const [name, setName] = useState("");
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

  // Bu useEffect artık gerekli değil - signInWithRedirect kullanıyoruz

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
              const trialData = createTrialData();
              await setDoc(ref, {
                uid: user.uid,
                email: user.email,
                name: user.displayName || "Kullanıcı",
                role: "student",
                createdAt: serverTimestamp(),
                emailVerified: true,
                photoURL: user.photoURL || null,
                fcmTokens: [],
                ...trialData,
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
          showToast("Kayıt hatası: " + error.message, "error");
        });
    }
  }, []);

  // ----------------------------------------------------
  // GOOGLE REGISTER / LOGIN
  // ----------------------------------------------------
  const registerWithGoogle = async () => {
    try {
      // Mobilde native Google Sign-In kullan (daha hızlı ve güvenilir)
      if (Capacitor.getPlatform() !== 'web' && GoogleSignIn.isAvailable()) {
        try {
          console.log('Starting native Google Sign-In on mobile...');
          
          // Native Google Sign-In başlat
          const result = await GoogleSignIn.signIn();
          
          if (!result.idToken) {
            showToast("Google ile kayıt başarısız: Token alınamadı", "error");
            return;
          }

          // Firebase credential oluştur ve giriş yap
          const credential = GoogleAuthProvider.credential(result.idToken);
          const userCredential = await signInWithCredential(auth, credential);
          const user = userCredential.user;

          // Kullanıcı verilerini kontrol et ve gerekirse oluştur
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);

          if (!snap.exists()) {
            const trialData = createTrialData();
            await setDoc(ref, {
              name: user.displayName || result.displayName || "Kullanıcı",
              email: user.email || result.email,
              role: "student",
              premium: false,
              createdAt: serverTimestamp(),
              emailVerified: true,
              photoURL: user.photoURL || result.photoUrl || null,
              fcmTokens: [],
              ...trialData,
            });
          } else {
            // Mevcut kullanıcı için photoURL güncelle (eğer yoksa)
            const existingData = snap.data();
            if ((user.photoURL || result.photoUrl) && !existingData.photoURL) {
              await setDoc(ref, {
                photoURL: user.photoURL || result.photoUrl,
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
                // Token kaydetme hatası kayıt işlemini durdurmaz
              });
          }

          const role = snap.exists() ? snap.data().role : "student";

          if (role === "admin") router.replace("/admin");
          else if (role === "coach") router.replace("/coach");
          else router.replace("/home");

          return;
        } catch (error: any) {
          console.error('Native Google Sign-In error:', error);
          // Native Sign-In başarısız olursa, fallback olarak redirect kullan
          console.log('Falling back to signInWithRedirect...');
          try {
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirectError: any) {
            showToast("Google ile kayıt başarısız: " + error.message, "error");
            return;
          }
        }
      }
      
      // Web'de veya native Sign-In mevcut değilse redirect kullan
      if (Capacitor.getPlatform() !== 'web') {
        try {
          console.log('Starting Google Sign-In with redirect on mobile...');
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (error: any) {
          console.error('signInWithRedirect error:', error);
          showToast("Google ile kayıt başarısız: " + error.message, "error");
          return;
        }
      }
      
      // Web'de popup kullan
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Web'de popup sonucunu işle
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      // İlk giriş ise Firestore'a kaydet
      if (!snap.exists()) {
        const trialData = createTrialData();
        await setDoc(ref, {
          name: user.displayName,
          email: user.email,
          role: "student", // Tüm yeni kayıtlar student rolünde
          premium: false,
          createdAt: serverTimestamp(),
          emailVerified: true, // Google verified
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

      // FCM token'ı al ve kaydet (async, register'i bloklamaz)
      // NOT: Mobilde user gesture olmadan çalışmayabilir, bu yüzden FCMTokenManager buton ile çalışacak
      // Sadece izin zaten verilmişse token almayı dene
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        requestNotificationPermission()
          .then((token) => {
            if (token) {              return saveFCMTokenToUser(user.uid, token);
            } else {
            }
          })
          .catch((error) => {            // Token kaydetme hatası kayıt işlemini durdurmaz
          });
      } else {      }

      const role = snap.exists() ? snap.data().role : "student";

      if (role === "admin") router.replace("/admin");
      else if (role === "coach") router.replace("/coach");
      else router.replace("/home");
    } catch (err: any) {
      // Popup kapatıldığında sessizce görmezden gel
      if (err?.code === "auth/cancelled-popup-request" || err?.code === "auth/popup-closed-by-user") {        return;
      }      showToast("Google ile kayıt başarısız. Lütfen tekrar deneyin.", "error");
    }
  };

  // ----------------------------------------------------
  // EMAIL REGISTER + VERIFICATION
  // ----------------------------------------------------
  const register = async () => {
    if (!name || !email || !pass) {
      showToast("Tüm alanlar zorunlu.", "error");
      return;
    }

    try {
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      // profil adı
      await updateProfile(cred.user, { displayName: name });

      // EMAIL DOĞRULAMA GÖNDER
      try {
        const actionCodeSettings = {
          url: `${window.location.origin}/auth/verify-email?email=${encodeURIComponent(email)}`,
          handleCodeInApp: false,
        };
        
        await sendEmailVerification(cred.user, actionCodeSettings);
      } catch (emailError: any) {
        // Email gönderim hatası kayıt işlemini durdurmaz, sadece log'lar
        if (emailError.code === "auth/too-many-requests") {
          // Too many requests
        } else {
          // Diğer hatalar için de log
        }
      }

      // Firestore kaydı
      const trialData = createTrialData();
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        role: "student", // Tüm yeni kayıtlar student rolünde
        premium: false,
        createdAt: serverTimestamp(),
        emailVerified: false,
        fcmTokens: [], // FCM token'ları için array
        ...trialData, // 7 günlük trial başlat
      });

      // FCM token'ı al ve kaydet (async, register'i bloklamaz)
      // NOT: Mobilde user gesture olmadan çalışmayabilir, bu yüzden FCMTokenManager buton ile çalışacak
      // Sadece izin zaten verilmişse token almayı dene
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        requestNotificationPermission()
          .then((token) => {
            if (token) {              return saveFCMTokenToUser(cred.user.uid, token);
            } else {
            }
          })
          .catch((error) => {            // Token kaydetme hatası kayıt işlemini durdurmaz
          });
      } else {      }

      showToast("Kayıt başarılı! Email doğrulama sayfasına yönlendiriliyorsunuz...", "success");
      
      setTimeout(() => {
        router.replace("/auth/verify-email");
      }, 500);

    } catch (err: any) {      let errorMessage = "Kayıt başarısız.";
      
      if (err.code === "auth/email-already-in-use") {
        errorMessage = "Bu email adresi zaten kullanılıyor.";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Şifre çok zayıf. En az 6 karakter olmalıdır.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Geçersiz email adresi.";
      } else if (err.code === "auth/network-request-failed") {
        errorMessage = "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
      }
      
      showToast(errorMessage, "error");
      setLoading(false);
    }
  };

  return (
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
            Kayıt Ol
          </h1>
          <p className="text-gray-600 text-base">
            SoruÇöz hesabını oluştur, koç ve yapay zekâ ile çalışmaya başla.
          </p>
        </div>

        {/* GOOGLE BUTTON */}
        <button
          onClick={registerWithGoogle}
          className="w-full py-4 rounded-2xl text-gray-900 font-semibold text-base 
                   bg-white/80 backdrop-blur-xl border border-white/60 
                   shadow-[0_10px_40px_rgba(0,0,0,0.08)]
                   active:scale-[0.98] transition-all duration-300 
                   hover:shadow-[0_15px_50px_rgba(0,0,0,0.12)]
                   hover:scale-[1.01] flex items-center justify-center gap-3 mb-6"
        >
          <Image src="/img/google.png" width={22} height={22} alt="Google" />
          Google ile Kayıt Ol
        </button>

        {/* DIVIDER */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
          <span className="text-gray-500 text-sm">veya</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
        </div>

        {/* INPUTS */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Ad Soyad"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/80 backdrop-blur-xl p-4 rounded-2xl 
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50 
                       border border-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.08)]
                       transition-all duration-300
                       placeholder:text-gray-400"
            />
          </div>

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
              onKeyDown={(e) => e.key === "Enter" && register()}
              className="w-full bg-white/80 backdrop-blur-xl p-4 rounded-2xl 
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50 
                       border border-white/60 shadow-[0_10px_40px_rgba(0,0,0,0.08)]
                       transition-all duration-300
                       placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* REGISTER BUTTON */}
        <button
          onClick={register}
          disabled={loading}
          className="w-full group relative overflow-hidden py-4 rounded-3xl text-white font-bold text-lg
                   bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600
                   shadow-[0_20px_50px_rgba(59,130,246,0.4)]
                   active:scale-[0.98] transition-all duration-300
                   hover:shadow-[0_25px_60px_rgba(59,130,246,0.5)]
                   hover:scale-[1.02]
                   disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-[0_20px_50px_rgba(59,130,246,0.4)] mb-6"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          <span className="relative z-10">{loading ? "Kaydediliyor..." : "Kayıt Ol"}</span>
        </button>

        {/* LOGIN LINK */}
        <div className="text-center text-gray-600 text-sm">
          Zaten hesabın var mı?{" "}
          <span
            className="text-blue-600 font-semibold cursor-pointer hover:text-blue-700 transition-colors"
            onClick={() => router.push("/auth/login")}
          >
            Giriş Yap
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
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
