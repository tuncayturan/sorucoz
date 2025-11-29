"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Image from "next/image";

export default function VerifyEmailPage() {
  const { user } = useAuth();
  const router = useRouter();

  const resend = async () => {
    if (!user) return;
    await sendEmailVerification(user);
    alert("Doğrulama emaili tekrar gönderildi.");
  };

  const checkVerified = async () => {
    await user.reload();
    if (user.emailVerified) {
      router.replace("/home");
    } else {
      alert("Email henüz doğrulanmamış.");
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
    </div>
  );
}
