"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Masaüstü kontrolü - ekran boyutu ve user agent
    const isMobileScreen = window.innerWidth <= 768;
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Masaüstü ise hiç gösterme
    if (!isMobileScreen && !isMobileUserAgent) {
      console.log('[PWA] Desktop detected, not showing install prompt');
      return;
    }
    
    // iOS detection
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // @ts-ignore
    const isInStandaloneMode = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    
    setIsIOS(isIOSDevice);
    
    // Android detection
    const isAndroidDevice = /Android/.test(navigator.userAgent);
    setIsAndroid(isAndroidDevice);
    
    // iOS: Eğer zaten PWA modunda değilse ve daha önce kapatılmamışsa göster
    if (isIOSDevice && !isInStandaloneMode) {
      const hasClosedBefore = localStorage.getItem('pwa-install-closed-ios');
      if (!hasClosedBefore) {
        // 1 saniye sonra otomatik göster (daha hızlı)
        setTimeout(() => {
          setShowPrompt(true);
        }, 1000);
      }
    }

    // Android: beforeinstallprompt event'ini dinle (sadece mobil ise)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA] beforeinstallprompt event fired');
      
      // Masaüstü ise event'i görmezden gel
      if (!isMobileScreen && !isMobileUserAgent) {
        console.log('[PWA] Desktop detected in event, ignoring');
        return;
      }
      
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      
      const hasClosedBefore = localStorage.getItem('pwa-install-closed-android');
      if (!hasClosedBefore) {
        // 2 saniye sonra otomatik olarak native prompt'u göster (biraz daha bekleyelim)
        setTimeout(async () => {
          console.log('[PWA] Auto-showing Android install prompt');
          try {
            // Otomatik olarak native prompt'u göster
            console.log('[PWA] Calling prompt()...');
            await promptEvent.prompt();
            console.log('[PWA] Prompt shown, waiting for user choice...');
            
            const { outcome } = await promptEvent.userChoice;
            console.log('[PWA] User choice:', outcome);
            
            if (outcome === 'accepted') {
              console.log('[PWA] ✅ User accepted Android install - app will be installed');
              // Kullanıcı kabul etti, artık prompt gösterme
              localStorage.setItem('pwa-install-closed-android', 'accepted');
              
              // Android'de uygulama ana ekrana eklendikten sonra sayfayı yenile
              // (PWA moduna geçiş için)
              setTimeout(() => {
                if (window.matchMedia('(display-mode: standalone)').matches) {
                  console.log('[PWA] ✅ App is now in standalone mode');
                } else {
                  console.log('[PWA] ⚠️ App not yet in standalone mode, may need page refresh');
                }
              }, 1000);
            } else {
              console.log('[PWA] User dismissed Android install');
              // Kullanıcı reddetti, bir sonraki sefer tekrar göster
            }
            
            setDeferredPrompt(null);
            setShowPrompt(false);
          } catch (error: any) {
            console.error('[PWA] ❌ Error showing prompt:', error);
            console.error('[PWA] Error details:', error.message, error.stack);
            // Hata olursa fallback olarak custom prompt göster
            setShowPrompt(true);
          }
        }, 2000); // 2 saniye bekle
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isAndroid && deferredPrompt) {
      // Android: Native install prompt (manuel tıklama için fallback)
      console.log('[PWA] Manually showing Android install prompt');
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User choice:', outcome);
        
        if (outcome === 'accepted') {
          console.log('[PWA] ✅ User accepted Android install - app will be installed');
          localStorage.setItem('pwa-install-closed-android', 'accepted');
        }
        
        setDeferredPrompt(null);
        setShowPrompt(false);
      } catch (error) {
        console.error('[PWA] Error showing prompt:', error);
        setShowPrompt(false);
      }
    } else if (isIOS) {
      // iOS: Sadece talimatları göster (otomatik install yok)
      console.log('[PWA] iOS - showing instructions');
      // Popup kapatılmaz, kullanıcı talimatları görsün
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem('pwa-install-closed-ios', 'true');
    } else if (isAndroid) {
      localStorage.setItem('pwa-install-closed-android', 'true');
    }
    console.log('[PWA] Install prompt closed by user');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-8 animate-slideUp">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Ana Ekrana Ekle
        </h2>
        
        <p className="text-gray-600 text-center mb-6">
          SoruÇöz'ü ana ekranınıza ekleyerek uygulama gibi kullanın!
        </p>

        {/* iOS Instructions */}
        {isIOS && (
          <div className="bg-blue-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">📱 iOS Talimatları:</p>
            <ol className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600">1.</span>
                <span>Safari'de alt menüdeki <strong>Paylaş</strong> butonuna tıklayın 
                  <svg className="inline w-4 h-4 mx-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z"/>
                  </svg>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600">2.</span>
                <span><strong>"Ana Ekrana Ekle"</strong> seçeneğini bulun</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-blue-600">3.</span>
                <span><strong>"Ekle"</strong> butonuna tıklayın</span>
              </li>
            </ol>
          </div>
        )}

        {/* Android Button */}
        {isAndroid && deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 mb-3"
          >
            📱 Ana Ekrana Ekle
          </button>
        )}

        {/* Features */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span>Hızlı erişim - Uygulama gibi kullanın</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <span>Anlık bildirimler alın</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span>Daha hızlı ve akıcı deneyim</span>
          </div>
        </div>

        {/* Later Button */}
        <button
          onClick={handleClose}
          className="w-full py-3 text-gray-600 hover:text-gray-900 font-medium transition"
        >
          Şimdi Değil
        </button>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(100px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

