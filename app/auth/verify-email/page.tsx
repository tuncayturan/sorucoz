"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Image from "next/image";
import Toast from "@/components/ui/Toast";

export default function VerifyEmailPage() {
  const { user } = useAuth();
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

  const resend = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      showToast("Doğrulama emaili tekrar gönderildi. Email kutunuzu kontrol edin.", "success");
    } catch (error: any) {
      if (error.code === "auth/too-many-requests") {
        showToast("Çok fazla istek gönderdiniz. Lütfen birkaç dakika bekleyin.", "error");
      } else {
        showToast("Email gönderilemedi. Lütfen tekrar deneyin.", "error");
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

        <Image
          src="/img/email.png"
          alt="Email Verify"
          width={120}
          height={120}
          className="mb-8 opacity-90"
        />

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
