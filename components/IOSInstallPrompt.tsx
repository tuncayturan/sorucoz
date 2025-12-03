"use client";

import { useState, useEffect } from "react";

/**
 * iOS Safari için "Ana Ekrana Ekle" rehberi
 * Login ekranında gösterilir
 */
export default function IOSInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Sadece iOS Safari'de göster
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    
    // PWA kontrolü
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (navigator as any).standalone === true;
    
    // Daha önce gösterildi mi
    const dismissed = localStorage.getItem('iosInstallPromptDismissed');
    
    // iOS Safari, PWA değil, daha önce dismiss edilmemiş
    if (isIOSSafari && !isPWA && !dismissed) {
      // 2 saniye sonra göster
      setTimeout(() => setShow(true), 2000);
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('iosInstallPromptDismissed', 'true');
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-scale-in">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
          aria-label="Kapat"
        >
          ✕
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg">
            <span className="text-4xl">🍎</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-center mb-2 text-gray-900">
          iOS'ta Daha İyi Çalışır
        </h3>
        
        {/* Subtitle */}
        <p className="text-center text-gray-600 mb-6 text-sm">
          Bildirimler için uygulamayı ana ekranınıza ekleyin
        </p>

        {/* Instructions */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 mb-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow">
                1
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm text-gray-800 font-medium">
                  Alt taraftaki <strong className="text-blue-600">"Paylaş"</strong> düğmesine dokunun
                </p>
                <div className="mt-2 flex justify-center">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 14H4v-7H2v9h20v-9h-2v7z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow">
                2
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm text-gray-800 font-medium">
                  <strong className="text-blue-600">"Ana Ekrana Ekle"</strong> seçeneğini bulun ve tıklayın
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow">
                3
              </div>
              <div className="flex-1 pt-1">
                <p className="text-sm text-gray-800 font-medium">
                  Sağ üstteki <strong className="text-blue-600">"Ekle"</strong> düğmesine dokunun
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-green-50 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-green-800 mb-2">
            ✨ Neden?
          </p>
          <ul className="text-sm text-green-700 space-y-1">
            <li>🔔 <strong>Bildirimler çalışır</strong></li>
            <li>⚡ Daha hızlı açılır</li>
            <li>📱 Uygulama gibi görünür</li>
          </ul>
        </div>

        {/* Button */}
        <button
          onClick={handleDismiss}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-bold text-base hover:shadow-lg transition"
        >
          Anladım
        </button>
      </div>
    </div>
  );
}

