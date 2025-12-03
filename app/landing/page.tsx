"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import Image from "next/image";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { settings, loading: settingsLoading } = useSiteSettings();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const siteName = settings.siteName || "SoruÇöz";
  const siteLogo = settings.logo;

  // Giriş yapmış kullanıcıları yönlendir
  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [user, loading, router]);

  // Mouse position tracking for parallax and scroll button
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      setShowScrollTop(scrollPosition > 300);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-purple-500 border-r-transparent rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }}></div>
        </div>
      </div>
    );
  }

  const handleGetStarted = () => {
    router.push("/auth/login");
  };

  const features = [
    {
      icon: "🤖",
      title: "AI Destekli Soru Çözümü",
      description: "Yapay zeka ile sorularınızı anında çözün. Detaylı açıklamalar ve adım adım çözümler.",
      gradient: "from-blue-500 via-cyan-500 to-teal-500",
      bgGradient: "from-blue-50 via-cyan-50 to-teal-50",
    },
    {
      icon: "👨‍🏫",
      title: "Uzman Eğitim Koçları",
      description: "Gerçek eğitim koçları ile birebir rehberlik. Her zaman yanınızda profesyonel destek.",
      gradient: "from-purple-500 via-pink-500 to-rose-500",
      bgGradient: "from-purple-50 via-pink-50 to-rose-50",
    },
    {
      icon: "📊",
      title: "Detaylı İstatistikler",
      description: "Gelişiminizi takip edin. Performans analizi ve kişiselleştirilmiş öneriler.",
      gradient: "from-indigo-500 via-blue-500 to-cyan-500",
      bgGradient: "from-indigo-50 via-blue-50 to-cyan-50",
    },
    {
      icon: "📅",
      title: "Etkinlik Takvimi",
      description: "Önemli sınav tarihleri ve etkinlikler. Hiçbir şeyi kaçırmayın.",
      gradient: "from-orange-500 via-amber-500 to-yellow-500",
      bgGradient: "from-orange-50 via-amber-50 to-yellow-50",
    },
    {
      icon: "💬",
      title: "Anlık Mesajlaşma",
      description: "Eğitim koçlarınızla doğrudan iletişim. Sorularınız anında yanıtlanır.",
      gradient: "from-green-500 via-emerald-500 to-teal-500",
      bgGradient: "from-green-50 via-emerald-50 to-teal-50",
    },
    {
      icon: "⭐",
      title: "Premium Deneyim",
      description: "Modern, hızlı ve tamamen iOS hissi. Premium öğrenme deneyimi.",
      gradient: "from-yellow-500 via-orange-500 to-red-500",
      bgGradient: "from-yellow-50 via-orange-50 to-red-50",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#16213e] overflow-x-hidden relative">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Floating gradient orbs */}
        <div
          className="absolute w-96 h-96 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse"
          style={{
            top: `${mousePosition.y * 0.5}%`,
            left: `${mousePosition.x * 0.5}%`,
            transform: `translate(-50%, -50%)`,
            transition: "all 0.3s ease-out",
          }}
        />
        <div
          className="absolute w-96 h-96 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse"
          style={{
            top: `${100 - mousePosition.y * 0.3}%`,
            left: `${100 - mousePosition.x * 0.3}%`,
            transform: `translate(-50%, -50%)`,
            transition: "all 0.4s ease-out",
            animationDelay: "1s",
          }}
        />
        <div
          className="absolute w-96 h-96 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse"
          style={{
            top: `${mousePosition.y * 0.7}%`,
            left: `${100 - mousePosition.x * 0.5}%`,
            transform: `translate(-50%, -50%)`,
            transition: "all 0.5s ease-out",
            animationDelay: "2s",
          }}
        />

        {/* Geometric shapes */}
        <div className="absolute top-20 left-10 w-72 h-72 border border-white/5 rounded-full animate-spin" style={{ animationDuration: "20s" }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 border border-white/5 rounded-full animate-spin" style={{ animationDuration: "25s", animationDirection: "reverse" }} />
      </div>

      {/* Hero Section */}
      <div className="relative pt-32 pb-40 px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            {/* Animated Logo/Brand - Premium iOS Style */}
            <div className="mb-12">
              <div
                className="inline-flex items-center justify-center w-28 h-28 mb-8 relative group cursor-pointer"
                style={{
                  transform: `translate(${(mousePosition.x - 50) * 0.02}px, ${(mousePosition.y - 50) * 0.02}px)`,
                }}
              >
                {/* Outer Glow Rings - Premium Effect */}
                <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-pink-500/30 blur-2xl animate-pulse" />
                <div className="absolute -inset-2 rounded-[2.5rem] bg-gradient-to-r from-blue-400/20 via-indigo-400/20 to-purple-400/20 blur-xl" />
                
                {/* Main Logo Container - Glassmorphism Premium */}
                <div className="relative w-28 h-28 rounded-[2.5rem] overflow-hidden">
                  {/* Gradient Background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-indigo-600 via-purple-600 to-pink-500" />
                  
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-50" />
                  
                  {/* Inner Border Glow */}
                  <div className="absolute inset-[2px] rounded-[2.5rem] border-2 border-white/30" />
                  
                  {/* Logo Content */}
                  <div className="relative w-full h-full flex items-center justify-center z-10">
                    {siteLogo ? (
                      <Image
                        src={siteLogo}
                        alt={siteName}
                        width={112}
                        height={112}
                        className="w-full h-full object-cover rounded-[2.5rem]"
                      />
                    ) : (
                      <span className="text-6xl font-black text-white drop-shadow-lg">{siteName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  
                  {/* Hover Glow Effect */}
                  <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10" />
                  
                  {/* Animated Ring */}
                  <div className="absolute -inset-1 rounded-[2.5rem] border-2 border-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                
                {/* Floating Particles Effect */}
                <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-blue-400/60 blur-sm animate-pulse" style={{ animationDelay: '0s' }} />
                <div className="absolute -bottom-2 -left-2 w-2 h-2 rounded-full bg-purple-400/60 blur-sm animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-0 -left-3 w-2.5 h-2.5 rounded-full bg-pink-400/60 blur-sm animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>
            </div>

            {/* Main Headline with animated gradient */}
            <h1
              className="text-6xl sm:text-7xl lg:text-8xl font-black text-white mb-8 leading-tight relative"
              style={{
                transform: `translateY(${scrollY * 0.1}px)`,
              }}
            >
              <span className="block mb-2">{siteName}</span>
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
                ile Başarıya
              </span>
              <style jsx>{`
                @keyframes gradient {
                  0%, 100% {
                    background-position: 0% 50%;
                  }
                  50% {
                    background-position: 100% 50%;
                  }
                }
                .animate-gradient {
                  animation: gradient 3s ease infinite;
                }
              `}</style>
            </h1>

            {/* Subheadline */}
            <p
              className="text-xl sm:text-2xl lg:text-3xl text-gray-300 mb-16 max-w-3xl mx-auto leading-relaxed"
              style={{
                transform: `translateY(${scrollY * 0.05}px)`,
              }}
            >
              <span className="bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent font-semibold">
                Yapay zeka ve uzman eğitim koçları
              </span>
              <br />
              <span className="text-gray-400">ile öğrenme deneyiminizi bir üst seviyeye taşıyın</span>
            </p>

            {/* Premium CTA Button */}
            <div className="mb-16">
              <button
                onClick={handleGetStarted}
                className="group relative inline-flex items-center justify-center px-12 py-6 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 text-white text-xl font-bold rounded-[2rem] overflow-hidden transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_20px_60px_rgba(59,130,246,0.5)] hover:shadow-[0_25px_80px_rgba(59,130,246,0.7)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="relative z-10 flex items-center gap-3">
                  Başlayın
                  <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
            </div>

            {/* Trust Indicators - Premium Modern Design (Text Only) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 max-w-4xl mx-auto">
              {[
                { 
                  text: "Güvenli Platform", 
                  gradient: "from-green-400 to-emerald-500",
                  bgGradient: "from-green-500/10 to-emerald-500/10",
                  glow: "shadow-[0_0_30px_rgba(34,197,94,0.3)]"
                },
                { 
                  text: "Premium Kalite", 
                  gradient: "from-yellow-400 to-amber-500",
                  bgGradient: "from-yellow-500/10 to-amber-500/10",
                  glow: "shadow-[0_0_30px_rgba(250,204,21,0.3)]"
                },
                { 
                  text: "Anında Çözüm", 
                  gradient: "from-blue-400 to-cyan-500",
                  bgGradient: "from-blue-500/10 to-cyan-500/10",
                  glow: "shadow-[0_0_30px_rgba(59,130,246,0.3)]"
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="group relative w-full sm:w-auto flex-1 sm:flex-none"
                  style={{
                    animationDelay: `${index * 0.15}s`,
                  }}
                >
                  {/* Glow effect */}
                  <div className={`absolute -inset-0.5 bg-gradient-to-r ${item.gradient} rounded-2xl opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-500 ${item.glow}`} />
                  
                  {/* Card */}
                  <div className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4 sm:px-8 sm:py-5 hover:border-white/20 transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 ${item.bgGradient}`}>
                    {/* Text */}
                    <div className="text-center">
                      <span className="font-bold text-white text-base sm:text-lg group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-200 group-hover:bg-clip-text transition-all duration-500">
                        {item.text}
                      </span>
                    </div>
                    
                    {/* Decorative corner accent */}
                    <div className={`absolute top-0 right-0 w-8 h-8 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-20 rounded-bl-2xl rounded-tr-2xl transition-opacity duration-500`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid with 3D effects */}
      <div className="relative py-32 px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl sm:text-6xl font-black text-white mb-6">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Neden {siteName}?
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Öğrenme deneyiminizi dönüştüren özellikler
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                onClick={handleGetStarted}
                className="group relative bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-white/10 hover:border-white/20 transition-all duration-500 cursor-pointer transform hover:scale-105 hover:-translate-y-2"
                style={{
                  animationDelay: `${index * 0.1}s`,
                  transform: `perspective(1000px) rotateY(${(mousePosition.x - 50) * 0.01}deg) rotateX(${(mousePosition.y - 50) * -0.01}deg)`,
                }}
              >
                {/* Gradient background on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.bgGradient} opacity-0 group-hover:opacity-10 rounded-[2.5rem] transition-opacity duration-500`} />
                
                {/* Glow effect */}
                <div className={`absolute -inset-1 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-20 blur-xl rounded-[2.5rem] transition-opacity duration-500`} />

                <div className="relative z-10">
                  <div className={`text-6xl mb-6 transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 inline-block`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:to-purple-400 group-hover:bg-clip-text transition-all duration-500">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section with animated counters */}
      <div className="relative py-32 px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { number: "10K+", label: "Çözülen Soru", gradient: "from-blue-400 to-cyan-400" },
              { number: "5K+", label: "Mutlu Öğrenci", gradient: "from-purple-400 to-pink-400" },
              { number: "50+", label: "Uzman Koç", gradient: "from-pink-400 to-rose-400" },
            ].map((stat, index) => (
              <div
                key={index}
                className="group relative bg-white/5 backdrop-blur-2xl rounded-[2.5rem] p-12 border border-white/10 hover:border-white/20 text-center transform hover:scale-105 transition-all duration-500"
              >
                <div className={`text-7xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-4 transform group-hover:scale-110 transition-transform duration-500`}>
                  {stat.number}
                </div>
                <div className="text-gray-400 font-semibold text-lg group-hover:text-white transition-colors">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Premium CTA Section */}
      <div className="relative py-40 px-4 sm:px-6 lg:px-8 z-10">
        <div className="max-w-5xl mx-auto">
          <div className="relative group">
            {/* Animated gradient background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-75 transition-opacity duration-500 animate-pulse" />
            
            <div className="relative bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-2xl rounded-[3rem] p-16 border border-white/20">
              <div className="text-center">
                <h2 className="text-5xl sm:text-6xl font-black text-white mb-6">
                  Hemen Başlayın
                </h2>
                <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
                  Öğrenme yolculuğunuzu bugün başlatın.{" "}
                  <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent font-bold">
                    Premium deneyim
                  </span>{" "}
                  sizi bekliyor.
                </p>
                <button
                  onClick={handleGetStarted}
                  className="group relative inline-flex items-center justify-center px-14 py-6 bg-white text-gray-900 text-xl font-black rounded-[2rem] overflow-hidden transform hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_20px_60px_rgba(255,255,255,0.3)] hover:shadow-[0_25px_80px_rgba(255,255,255,0.4)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <span className="relative z-10 flex items-center gap-3">
                    Ücretsiz Başlayın
                    <svg className="w-6 h-6 transform group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10 z-10">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            © 2024 {siteName}. {settings.footerCopyright || "Tüm hakları saklıdır."}
          </p>
        </div>
      </div>

      {/* Scroll to Top Button - Premium Style */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl shadow-[0_10px_40px_rgba(59,130,246,0.6)] flex items-center justify-center transition-all duration-300 ${
          showScrollTop
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-90 pointer-events-none"
        } active:scale-95 hover:shadow-[0_15px_50px_rgba(139,92,246,0.7)]`}
        aria-label="Yukarı git"
      >
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-2xl opacity-0 hover:opacity-50 blur-xl transition-opacity duration-500" />
        
        {/* Icon */}
        <svg
          className="w-7 h-7 text-white relative z-10"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}
