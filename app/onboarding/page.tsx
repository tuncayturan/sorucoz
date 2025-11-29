"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";

const slides = [
  {
    title: "SoruÇöz'e Hoş Geldin",
    desc: "Yapay zekâ ile sorularını anında çöz.",
    img: "/img/onb1.png",
  },
  {
    title: "Koç Her Zaman Yanında",
    desc: "Gerçek koç ile birebir rehberlik al.",
    img: "/img/onb2.png",
  },
  {
    title: "Premium Öğrenme Deneyimi",
    desc: "Modern, hızlı ve tamamen iOS hissi.",
    img: "/img/onb3.png",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < slides.length - 1) setStep(step + 1);
    else {
      localStorage.setItem("onboardingDone", "true");
      router.replace("/auth/login");
    }
  };

  return (
    <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] px-6 overflow-hidden relative">
      {/* Decorative gradient circles */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl"></div>

      <div className="w-full max-w-sm h-[90%] flex flex-col items-center justify-between py-10 relative z-10">
        {/* IMAGE */}
        <div key={step} className="flex-1 flex justify-center items-center animate-slideFade">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-indigo-400/30 rounded-3xl blur-2xl transform scale-110 group-hover:scale-125 transition-transform duration-500"></div>
            <Image
              src={slides[step].img}
              width={280}
              height={280}
              alt="onboarding"
              className="relative rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] transform transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </div>

        {/* TEXT */}
        <div className="text-center mb-6 px-2 animate-slideFade">
          <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
            {slides[step].title}
          </h1>
          <p className="text-gray-600 text-lg leading-relaxed">
            {slides[step].desc}
          </p>
        </div>

        {/* INDICATORS */}
        <div className="flex gap-2 mb-8 animate-slideFade">
          {slides.map((_, i) => (
            <div
              key={i}
              className={clsx(
                "h-2 rounded-full transition-all duration-300",
                step === i 
                  ? "w-8 bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg" 
                  : "w-2 bg-gray-300/60"
              )}
            />
          ))}
        </div>

        {/* BUTTON */}
        <button
          onClick={next}
          className="w-full group relative overflow-hidden py-5 rounded-3xl text-white font-bold text-lg
                   bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600
                   shadow-[0_20px_50px_rgba(59,130,246,0.4)]
                   active:scale-[0.98] transition-all duration-300
                   hover:shadow-[0_25px_60px_rgba(59,130,246,0.5)]
                   hover:scale-[1.02] animate-slideFade"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          <span className="relative z-10">{step === slides.length - 1 ? "Başla" : "İleri"}</span>
        </button>
      </div>
    </div>
  );
}
