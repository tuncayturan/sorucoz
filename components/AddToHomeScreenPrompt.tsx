"use client";

import { useState, useEffect } from "react";

/**
 * iOS Safari için "Ana Ekrana Ekle" rehberi
 * Daha iyi bildirim deneyimi için PWA kullanımını teşvik eder
 */
export default function AddToHomeScreenPrompt() {
  const [show, setShow] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // PWA kontrolü
    const isInPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone === true;
    
    setIsPWA(isInPWA);
    
    // Eğer zaten PWA değilse ve iOS Safari ise göster
    if (!isInPWA) {
      const ua = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
      
      // Daha önce gösterildi mi kontrol et
      const hasSeenPrompt = localStorage.getItem('hasSeenA2HSPrompt');
      
      if (isIOSSafari && !hasSeenPrompt) {
        // 2 saniye sonra otomatik göster (daha hızlı)
        setTimeout(() => {
          setShow(true);
        }, 2000);
      }
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('hasSeenA2HSPrompt', 'true');
  };

  const handleRemindLater = () => {
    setShow(false);
    // 1 gün sonra tekrar göster
    localStorage.setItem('hasSeenA2HSPrompt', Date.now().toString());
    setTimeout(() => {
      localStorage.removeItem('hasSeenA2HSPrompt');
    }, 24 * 60 * 60 * 1000);
  };

  // PWA'da veya gösterilmeyecekse render etme
  if (isPWA || !show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-t-3xl w-full max-w-lg mx-4 mb-0 p-6 shadow-2xl animate-slide-up">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
          aria-label="Kapat"
        >
          ✕
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-3xl">📱</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-center mb-2 text-gray-900">
          Ana Ekrana Ekleyin
        </h3>
        
        {/* Subtitle */}
        <p className="text-center text-gray-600 mb-6">
          Daha iyi bir deneyim için SoruÇöz'ü ana ekranınıza ekleyin
        </p>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-800">
                  Aşağıdaki <strong>"Paylaş"</strong> düğmesine dokunun
                  <span className="inline-block ml-1 text-blue-600">
                    <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 14H4v-7H2v9h20v-9h-2v7z"/>
                    </svg>
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-800">
                  <strong>"Ana Ekrana Ekle"</strong> seçeneğini bulun
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-800">
                  <strong>"Ekle"</strong> düğmesine dokunun
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-gray-800 mb-2">
            ✨ Avantajlar:
          </p>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>🚀 Daha hızlı erişim</li>
            <li>🔔 Daha güvenilir bildirimler</li>
            <li>📱 Uygulama gibi tam ekran deneyim</li>
            <li>⚡ Daha az pil tüketimi</li>
          </ul>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRemindLater}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
          >
            Sonra Hatırlat
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition"
          >
            Anladım
          </button>
        </div>

        {/* Note */}
        <p className="text-xs text-center text-gray-500 mt-4">
          💡 Ana ekrana eklemeden de bildirimler çalışır, ancak eklemek daha iyi deneyim sağlar
        </p>
      </div>
    </div>
  );
}

