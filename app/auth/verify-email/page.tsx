"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useRouter } from "next/navigation";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

export default function VerifyEmailPage() {
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const router = useRouter();
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // Email doğrulandıysa ana sayfaya yönlendir
  useEffect(() => {
    if (authLoading || userDataLoading) return;
    
    if (!user) {
      router.replace("/landing");
      return;
    }

    // Google ile giriş yapanlar otomatik doğrulanmış
    const isGoogleUser = user.providerData?.some((p: any) => p.providerId === 'google.com');
    if (isGoogleUser) {
      router.replace("/home");
      return;
    }

    // Email doğrulanmışsa ana sayfaya yönlendir
    if (user.emailVerified || userData?.emailVerified === true) {
      router.replace("/home");
      return;
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  const resend = async () => {
    if (!user) return;
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth/verify-email?email=${encodeURIComponent(user.email || "")}`,
        handleCodeInApp: false,
      };
      
      await sendEmailVerification(user, actionCodeSettings);
      console.log("[Verify Email] ✅ Email verification resent successfully");
      showToast("Doğrulama emaili tekrar gönderildi. Email kutunuzu kontrol edin.", "success");
    } catch (error: any) {
      console.error("[Verify Email] ❌ Email verification resend error:", error);
      if (error.code === "auth/too-many-requests") {
        showToast("Çok fazla istek gönderdiniz. Lütfen birkaç dakika bekleyin.", "error");
      } else {
        showToast(`Email gönderilemedi: ${error.message || "Bilinmeyen hata"}. Lütfen tekrar deneyin.`, "error");
      }
    }
  };

  const checkVerified = async () => {
    if (!user) return;
    
    try {
      await user.reload();
      if (user.emailVerified) {
        showToast("Email doğrulandı! Ana sayfaya yönlendiriliyorsunuz...", "success");
        setTimeout(() => {
          router.replace("/home");
        }, 1000);
      } else {
        showToast("Email henüz doğrulanmamış. Lütfen email kutunuzu kontrol edin.", "info");
      }
    } catch (error) {
      showToast("Doğrulama kontrolü yapılamadı. Lütfen tekrar deneyin.", "error");
    }
  };

  return (
    <div className="h-screen flex flex-col justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] px-8">
      <div className="w-full max-w-sm text-center animate-slideFade">

        {/* Email Icon */}
        <div className="mb-8 flex justify-center">
          <div className="w-32 h-32 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-[0_20px_60px_rgba(59,130,246,0.3)]">
            <svg
              className="w-16 h-16 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Emailini Onayla
        </h1>

        <p className="text-gray-600 mb-6">
          Lütfen {user?.email} adresine gönderilen doğrulama bağlantısına tıkla.
        </p>

        <button
          onClick={checkVerified}
          className="w-full py-3 rounded-2xl bg-white/60 text-gray-900 font-medium shadow-sm mb-3"
        >
          Onaylandı mı kontrol et
        </button>

        <button
          onClick={resend}
          className="w-full py-3 rounded-2xl bg-white/40 text-gray-700 font-medium shadow-sm"
        >
          Emaili tekrar gönder
        </button>
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
