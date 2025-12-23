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
      <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] flex items-center justify-center">
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
    <div className="min-h-screen overflow-x-hidden relative bg-black">
      {/* Video Background - Full Visibility */}
      {settings.landingVideoUrl ? (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: "brightness(0.95) saturate(1.1)",
            }}
          >
            <source src={settings.landingVideoUrl} type="video/mp4" />
            <source src={settings.landingVideoUrl} type="video/webm" />
          </video>
          {/* Minimal dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/30" />
        </div>
      ) : (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 z-0" />
      )}

      {/* Hero Section - iOS Premium Design */}
      <div className="relative pt-20 sm:pt-28 pb-24 sm:pb-32 px-4 sm:px-6 lg:px-8 z-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center">
            {/* iOS-Style Logo/Brand */}
            <div className="mb-8 sm:mb-10">
              <div
                className="inline-flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 mb-6 sm:mb-8 relative group"
                style={{
                  transform: `translate(${(mousePosition.x - 50) * 0.02}px, ${(mousePosition.y - 50) * 0.02}px)`,
                  transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {/* Soft glow */}
                <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-blue-400/10 via-indigo-400/10 to-purple-400/10 blur-2xl" />
                
                {/* Main Logo Container - Enhanced Glassmorphism for Video BG */}
                <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-[1.8rem] sm:rounded-[2.2rem] overflow-hidden backdrop-blur-xl bg-white/90 border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                  {/* Subtle gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/90 via-indigo-600/90 to-purple-600/90" />
                  
                  {/* iOS-style shine */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                  
                  {/* Logo Content */}
                  <div className="relative w-full h-full flex items-center justify-center z-10">
                    {siteLogo ? (
                      <Image
                        src={siteLogo}
                        alt={siteName}
                        width={112}
                        height={112}
                        className="w-full h-full object-cover rounded-[1.8rem] sm:rounded-[2.2rem]"
                        unoptimized
                        onError={(e) => {                          // Fallback to initial
                          const target = e.target as HTMLImageElement;
                          if (target) {
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-4xl sm:text-5xl font-black text-white drop-shadow-lg">${siteName.charAt(0).toUpperCase()}</span>`;
                            }
                          }
                        }}
                      />
                    ) : (
                      <span className="text-4xl sm:text-5xl font-black text-white drop-shadow-lg">{siteName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modern Headline with Video Background - Premium */}
            <h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-4 sm:mb-6 leading-tight"
              style={{
                transform: `translateY(${scrollY * 0.05}px)`,
                transition: "transform 0.1s ease-out",
                textShadow: "0 6px 30px rgba(0,0,0,0.5), 0 3px 15px rgba(0,0,0,0.4), 0 1px 5px rgba(0,0,0,0.3)",
              }}
            >
              <span className="block mb-2 text-white">{siteName}</span>
              <span className="block bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent" style={{ textShadow: "0 4px 20px rgba(59,130,246,0.4), 0 2px 10px rgba(139,92,246,0.3)" }}>
                ile Başarıya
              </span>
            </h1>

            {/* Modern Subheadline - Premium */}
            <p
              className="text-xl sm:text-2xl md:text-3xl text-white mb-8 max-w-3xl mx-auto leading-relaxed font-bold"
              style={{
                transform: `translateY(${scrollY * 0.03}px)`,
                transition: "transform 0.1s ease-out",
                textShadow: "0 4px 20px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.5), 0 1px 5px rgba(0,0,0,0.4)",
              }}
            >
              <span className="text-white">Yapay zeka ve uzman eğitim koçları</span>
              <br className="hidden sm:block" />
              <span className="text-white sm:ml-2">ile öğrenme deneyiminizi bir üst seviyeye taşıyın</span>
            </p>

            {/* Modern Sınav Türleri with Video BG */}
            <div
              className="mb-10 sm:mb-12 max-w-5xl mx-auto"
              style={{
                transform: `translateY(${scrollY * 0.01}px)`,
                transition: "transform 0.1s ease-out",
              }}
            >
              <p className="text-center text-white mb-5 font-black text-xl sm:text-2xl drop-shadow-2xl" style={{ textShadow: "0 4px 20px rgba(0,0,0,0.6), 0 2px 10px rgba(0,0,0,0.5)" }}>
                Tüm Sınavlara Hazırlık
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
                {[
                  { name: "LGS", color: "from-blue-100 to-cyan-100", textColor: "text-blue-700", icon: "📚", fullName: "Liselere Geçiş Sınavı" },
                  { name: "TYT", color: "from-purple-100 to-pink-100", textColor: "text-purple-700", icon: "🎯", fullName: "Temel Yeterlilik Testi" },
                  { name: "AYT", color: "from-indigo-100 to-purple-100", textColor: "text-indigo-700", icon: "📖", fullName: "Alan Yeterlilik Testi" },
                  { name: "YKS", color: "from-violet-100 to-purple-100", textColor: "text-violet-700", icon: "🎓", fullName: "Yükseköğretim Kurumları Sınavı" },
                  { name: "KPSS", color: "from-green-100 to-emerald-100", textColor: "text-green-700", icon: "💼", fullName: "Kamu Personeli Seçme Sınavı" },
                  { name: "TUS", color: "from-red-100 to-rose-100", textColor: "text-red-700", icon: "⚕️", fullName: "Tıpta Uzmanlık Sınavı" },
                  { name: "DUS", color: "from-pink-100 to-rose-100", textColor: "text-pink-700", icon: "🦷", fullName: "Diş Hekimliği Uzmanlık Sınavı" },
                  { name: "YDS", color: "from-orange-100 to-red-100", textColor: "text-orange-700", icon: "🌍", fullName: "Yabancı Dil Bilgisi Seviye Tespit" },
                  { name: "YÖKDİL", color: "from-amber-100 to-yellow-100", textColor: "text-amber-700", icon: "🗣️", fullName: "Yükseköğretim Kurumları Yabancı Dil" },
                  { name: "ALES", color: "from-teal-100 to-cyan-100", textColor: "text-teal-700", icon: "📝", fullName: "Akademik Personel ve Lisansüstü Eğitimi" },
                  { name: "DGS", color: "from-cyan-100 to-blue-100", textColor: "text-cyan-700", icon: "🔄", fullName: "Dikey Geçiş Sınavı" },
                  { name: "MSÜ", color: "from-gray-100 to-gray-200", textColor: "text-gray-700", icon: "🎖️", fullName: "Milli Savunma Üniversitesi" },
                  { name: "STS", color: "from-emerald-100 to-green-100", textColor: "text-emerald-700", icon: "🏥", fullName: "Sağlık Bilimleri Testi" },
                  { name: "EUS", color: "from-lime-100 to-green-100", textColor: "text-lime-700", icon: "💊", fullName: "Eczacılık Uzmanlık Sınavı" },
                ].map((sinav, index) => (
                  <div
                    key={index}
                    className="group relative bg-white/60 backdrop-blur-2xl rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 border border-white/30 hover:border-white/50 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl overflow-hidden animate-fadeInUp"
                    title={sinav.fullName}
                    style={{
                      animationDelay: `${index * 0.03}s`,
                    }}
                  >
                    {/* Soft gradient background on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${sinav.color} opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300`} />
                    
                    <div className="relative z-10 flex items-center gap-2">
                      <span className="text-lg sm:text-xl">{sinav.icon}</span>
                      <span className={`font-semibold text-gray-700 group-hover:${sinav.textColor} transition-colors duration-300 text-xs sm:text-sm`}>
                        {sinav.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-base text-white mt-5 font-bold drop-shadow-2xl" style={{ textShadow: "0 3px 15px rgba(0,0,0,0.5), 0 1px 5px rgba(0,0,0,0.4)" }}>
                ve daha birçok sınavın müfredatına uygun içerikler
              </p>
              <p className="text-center text-sm text-white/95 mt-2 max-w-2xl mx-auto leading-relaxed px-4 font-semibold drop-shadow-lg" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.4), 0 1px 5px rgba(0,0,0,0.3)" }}>
                Türkiye Yüzyılı Maarif Modeli kapsamında, Milli Eğitim Bakanlığı müfredatına tam uyumlu, 
                güncel ve kapsamlı soru çözüm desteği
              </p>
            </div>

            {/* Modern Badge/Trust indicators with Video BG */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-12 max-w-3xl mx-auto">
              {[
                { text: "4.9/5 Puan", icon: "⭐", bgColor: "bg-yellow-50", borderColor: "border-yellow-200/50" },
                { text: "Anında Çözüm", icon: "🚀", bgColor: "bg-blue-50", borderColor: "border-blue-200/50" },
                { text: "Güvenilir Platform", icon: "✅", bgColor: "bg-green-50", borderColor: "border-green-200/50" },
              ].map((badge, index) => (
                <div
                  key={index}
                  className={`group relative bg-white/60 backdrop-blur-2xl px-4 py-2.5 rounded-xl border border-white/30 hover:border-white/50 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl overflow-hidden animate-fadeInUp`}
                  style={{
                    animationDelay: `${index * 0.08 + 0.2}s`,
                  }}
                >
                  {/* Soft background on hover */}
                  <div className={`absolute inset-0 ${badge.bgColor} opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300`} />
                  
                  <div className="relative z-10 flex items-center gap-2">
                    <span className="text-base sm:text-lg">{badge.icon}</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">
                      {badge.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Premium CTA Button with Video BG */}
            <div className="mb-10 sm:mb-12">
              <div className="relative inline-block group">
                {/* Enhanced pulsing glow effect */}
                <div className="absolute -inset-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-[2.8rem] opacity-40 group-hover:opacity-60 blur-2xl animate-pulse" />
                <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-[2.6rem] opacity-20 group-hover:opacity-30 blur-xl" />
                
                <button
                  onClick={handleGetStarted}
                  className="relative inline-flex items-center justify-center px-8 sm:px-12 py-4 sm:py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-base sm:text-lg font-black rounded-[2rem] overflow-hidden transform hover:scale-110 active:scale-95 transition-all duration-500 shadow-[0_8px_30px_rgba(59,130,246,0.6)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.8)] border-2 border-white/30"
                >
                  {/* Multiple gradient layers */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                  
                  <span className="relative z-10 flex items-center gap-2.5">
                    <span className="relative">
                      Ücretsiz Başlayın
                      <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-white/80 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                    </span>
                    <svg className="w-5 h-5 transform group-hover:translate-x-2 group-hover:rotate-12 transition-all duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  
                  {/* Advanced shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1500 skew-x-12" />
                  
                  {/* Enhanced sparkle effects */}
                  <div className="absolute top-3 right-6 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 animate-ping shadow-lg shadow-white/50" />
                  <div className="absolute bottom-3 left-6 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 animate-ping shadow-lg shadow-white/50" style={{ animationDelay: "0.2s" }} />
                  <div className="absolute top-1/2 left-1/4 w-1.5 h-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 animate-pulse" style={{ animationDelay: "0.4s" }} />
                </button>
              </div>
            </div>

            {/* Modern Trust Indicators with Video BG */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
              {[
                { 
                  text: "Güvenli Platform", 
                  icon: "🔒",
                  bgColor: "bg-green-50",
                  borderColor: "border-green-200/50"
                },
                { 
                  text: "Premium Kalite", 
                  icon: "⭐",
                  bgColor: "bg-yellow-50",
                  borderColor: "border-yellow-200/50"
                },
                { 
                  text: "Anında Çözüm", 
                  icon: "⚡",
                  bgColor: "bg-blue-50",
                  borderColor: "border-blue-200/50"
                },
              ].map((item, index) => (
                <div
                key={index}
                className={`group relative w-full sm:w-auto flex-1 sm:flex-none bg-white/60 backdrop-blur-2xl border border-white/30 rounded-2xl px-5 py-4 hover:border-white/50 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl overflow-hidden animate-fadeInUp`}
                style={{
                  animationDelay: `${index * 0.1 + 0.3}s`,
                }}
                >
                  {/* Content */}
                  <div className="relative z-10 text-center">
                    <div className="text-2xl sm:text-3xl mb-2">
                      {item.icon}
                    </div>
                    <span className="font-semibold text-gray-900 text-sm sm:text-base block">
                      {item.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modern Features Grid with Video BG */}
      <div className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 z-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-3 sm:mb-4 drop-shadow-2xl" style={{ textShadow: "0 6px 30px rgba(0,0,0,0.6), 0 3px 15px rgba(0,0,0,0.5)" }}>
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent" style={{ textShadow: "0 4px 20px rgba(59,130,246,0.4)" }}>
                Neden {siteName}?
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-white font-bold max-w-2xl mx-auto drop-shadow-2xl" style={{ textShadow: "0 4px 20px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.4)" }}>
              Öğrenme deneyiminizi dönüştüren özellikler
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                onClick={handleGetStarted}
                className="group relative bg-white/60 backdrop-blur-2xl rounded-2xl p-5 sm:p-6 border border-white/30 hover:border-white/50 transition-all duration-300 cursor-pointer transform hover:scale-[1.02] hover:-translate-y-1 shadow-lg hover:shadow-xl overflow-hidden animate-fadeInUp"
                style={{
                  animationDelay: `${index * 0.08 + 0.1}s`,
                }}
              >
                {/* Soft gradient background on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.bgGradient} opacity-0 group-hover:opacity-30 rounded-2xl transition-opacity duration-300`} />

                <div className="relative z-10">
                  {/* Icon */}
                  <div className="text-4xl sm:text-5xl mb-4">
                    {feature.icon}
                  </div>
                  
                  <h3 className="text-lg sm:text-xl font-black text-gray-900 mb-2 sm:mb-3 drop-shadow-sm">
                    {feature.title}
                  </h3>
                  <p className="text-gray-800 leading-relaxed text-sm sm:text-base font-semibold drop-shadow-sm">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modern Stats Section with Video BG */}
      <div className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 z-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { number: "10K+", label: "Çözülen Soru", gradient: "from-blue-500 to-cyan-500", icon: "📊", bgColor: "bg-blue-50" },
              { number: "5K+", label: "Mutlu Öğrenci", gradient: "from-purple-500 to-pink-500", icon: "🎓", bgColor: "bg-purple-50" },
              { number: "50+", label: "Uzman Koç", gradient: "from-pink-500 to-rose-500", icon: "👨‍🏫", bgColor: "bg-pink-50" },
            ].map((stat, index) => (
              <div
                key={index}
                className="group relative bg-white/60 backdrop-blur-2xl rounded-2xl p-6 sm:p-8 border border-white/30 hover:border-white/50 text-center transform hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-xl overflow-hidden animate-fadeInUp"
                style={{
                  animationDelay: `${index * 0.1 + 0.2}s`,
                }}
              >
                {/* Soft gradient background */}
                <div className={`absolute inset-0 ${stat.bgColor} opacity-0 group-hover:opacity-50 rounded-2xl transition-opacity duration-300`} />
                
                <div className="relative z-10">
                  <div className="text-3xl sm:text-4xl mb-3">
                    {stat.icon}
                  </div>
                  <div className={`text-4xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-2 sm:mb-3 drop-shadow-lg`}>
                    {stat.number}
                  </div>
                  <div className="text-gray-900 font-black text-sm sm:text-base drop-shadow-sm">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modern Testimonials Section with Video BG */}
      <div className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 z-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-3 sm:mb-4 drop-shadow-2xl" style={{ textShadow: "0 6px 30px rgba(0,0,0,0.6), 0 3px 15px rgba(0,0,0,0.5)" }}>
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent" style={{ textShadow: "0 4px 20px rgba(168,85,247,0.4)" }}>
                Öğrencilerimiz Ne Diyor?
              </span>
            </h2>
            <p className="text-lg sm:text-xl text-white font-bold max-w-2xl mx-auto drop-shadow-2xl" style={{ textShadow: "0 4px 20px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.4)" }}>
              Binlerce öğrencinin güvendiği platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                name: "Ayşe Yılmaz",
                role: "Lise Öğrencisi",
                content: "AI ile soru çözme artık çok kolay! Koçlarımın desteği sayesinde sınavlarda çok başarılı oldum. Kesinlikle tavsiye ederim!",
                rating: 5,
                bgColor: "bg-blue-50",
                avatar: "👩‍🎓",
              },
              {
                name: "Mehmet Demir",
                role: "Üniversite Hazırlık",
                content: "Premium planı aldığım günden beri soru limitim sınırsız. Her soruma anında cevap alıyorum ve çok memnunum!",
                rating: 5,
                bgColor: "bg-purple-50",
                avatar: "👨‍🎓",
              },
              {
                name: "Elif Kaya",
                role: "Ortaokul Öğrencisi",
                content: "Koçumla mesajlaşma özelliği harika! Takıldığım her konuda yardım alabiliyorum. Ailem de çok beğendi.",
                rating: 5,
                bgColor: "bg-pink-50",
                avatar: "👧",
              },
            ].map((testimonial, index) => (
              <div
                key={index}
                className="group relative bg-white/60 backdrop-blur-2xl rounded-2xl p-5 sm:p-6 border border-white/30 hover:border-white/50 transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl overflow-hidden animate-fadeInUp"
                style={{
                  animationDelay: `${index * 0.1 + 0.2}s`,
                }}
              >
                {/* Soft background */}
                <div className={`absolute inset-0 ${testimonial.bgColor} opacity-0 group-hover:opacity-40 rounded-2xl transition-opacity duration-300`} />
                
                <div className="relative z-10">
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>

                  {/* Content */}
                  <p className="text-gray-900 leading-relaxed mb-4 text-sm sm:text-base italic font-semibold drop-shadow-sm">
                    "{testimonial.content}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xl shadow-sm">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-black text-gray-900 text-sm sm:text-base drop-shadow-sm">{testimonial.name}</div>
                      <div className="text-xs text-gray-700 font-semibold">{testimonial.role}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modern CTA Section with Video BG */}
      <div className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 z-20">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-white/60 backdrop-blur-2xl rounded-3xl p-8 sm:p-12 border border-white/30 shadow-2xl overflow-hidden">
            <div className="relative z-10 text-center">
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 mb-4 sm:mb-6 drop-shadow-lg">
                Hemen Başlayın
              </h2>
              <p className="text-lg sm:text-xl text-gray-900 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed font-bold drop-shadow-sm">
                Öğrenme yolculuğunuzu bugün başlatın.{" "}
                <span className="font-black text-gray-900">
                  Premium deneyim
                </span>{" "}
                sizi bekliyor.
              </p>
              <div className="relative inline-block group">
                {/* Enhanced pulsing glow effect */}
                <div className="absolute -inset-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-[2.8rem] opacity-40 group-hover:opacity-60 blur-2xl animate-pulse" />
                <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-[2.6rem] opacity-20 group-hover:opacity-30 blur-xl" />
                
                <button
                  onClick={handleGetStarted}
                  className="relative inline-flex items-center justify-center px-8 sm:px-12 py-4 sm:py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-base sm:text-lg font-black rounded-[2rem] overflow-hidden transform hover:scale-110 active:scale-95 transition-all duration-500 shadow-[0_8px_30px_rgba(59,130,246,0.6)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.8)] border-2 border-white/30"
                >
                  {/* Multiple gradient layers */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                  
                  <span className="relative z-10 flex items-center gap-2.5">
                    <span className="relative">
                      Ücretsiz Başlayın
                      <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-white/80 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                    </span>
                    <svg className="w-5 h-5 transform group-hover:translate-x-2 group-hover:rotate-12 transition-all duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                  
                  {/* Advanced shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1500 skew-x-12" />
                  
                  {/* Enhanced sparkle effects */}
                  <div className="absolute top-3 right-6 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 animate-ping shadow-lg shadow-white/50" />
                  <div className="absolute bottom-3 left-6 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 animate-ping shadow-lg shadow-white/50" style={{ animationDelay: "0.2s" }} />
                  <div className="absolute top-1/2 left-1/4 w-1.5 h-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 animate-pulse" style={{ animationDelay: "0.4s" }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Türkiye Yüzyılı Maarif Modeli Badge - Alt Bölüm with Video BG */}
      <div className="relative py-16 sm:py-20 px-4 sm:px-6 lg:px-8 z-20">
        <div className="max-w-4xl mx-auto">
          <div className="group relative bg-white/60 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/30 overflow-hidden hover:shadow-[0_12px_48px_rgba(0,0,0,0.3)] transition-all duration-500">
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Soft accent border */}
            <div className="absolute inset-0 rounded-3xl border border-blue-200/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center border border-blue-200/50 shadow-sm group-hover:scale-105 transition-transform duration-300">
                  <span className="text-2xl sm:text-3xl">🇹🇷</span>
                </div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 tracking-tight drop-shadow-sm">Türkiye Yüzyılı Maarif Modeli</h3>
                  </div>
                  <p className="text-center text-sm sm:text-base md:text-lg text-gray-900 leading-relaxed max-w-2xl mx-auto font-bold drop-shadow-sm">
                    Milli Eğitim Bakanlığı müfredatına uygun, çağdaş eğitim anlayışıyla hazırlanmış içerikler
                  </p>
            </div>
            
            {/* Subtle shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </div>
        </div>
      </div>

      {/* Footer with Video BG */}
      <div className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-white/20 z-20">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-white/80 text-sm drop-shadow-md" style={{ textShadow: "0 1px 5px rgba(0,0,0,0.3)" }}>
            © 2025 {siteName}. {settings.footerCopyright || "Tüm hakları saklıdır."}
          </p>
        </div>
      </div>

      {/* Premium Scroll to Top Button with Gradient */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-2xl shadow-[0_15px_50px_rgba(59,130,246,0.7)] flex items-center justify-center transition-all duration-500 ${
          showScrollTop
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-90 pointer-events-none"
        } active:scale-90 hover:scale-110 hover:shadow-[0_20px_60px_rgba(139,92,246,0.8)]`}
        aria-label="Yukarı git"
      >
        {/* Enhanced glow effect */}
        <div className="absolute -inset-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-2xl opacity-0 hover:opacity-60 blur-2xl transition-opacity duration-700" />
        
        {/* Premium shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-2xl" />
        
        {/* Icon */}
        <svg
          className="w-6 h-6 sm:w-7 sm:h-7 text-white relative z-10 transform transition-transform duration-500 hover:translate-y-[-2px]"
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
