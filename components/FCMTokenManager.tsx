"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";

/**
 * FCM Token yönetim component'i
 * Mobil cihazlarda bildirim izni almak için kullanılır
 */
export default function FCMTokenManager() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    // iOS browser tespit
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    
    // iOS'ta Safari: "Version/" içerir ve CriOS/FxiOS/EdgiOS içermez
    const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    
    // iOS'ta diğer tarayıcılar
    const isIOSChrome = isIOS && /CriOS/i.test(ua);
    const isIOSFirefox = isIOS && /FxiOS/i.test(ua);
    const isIOSEdge = isIOS && /EdgiOS/i.test(ua);
    const isIOSNonSafari = isIOSChrome || isIOSFirefox || isIOSEdge;    // iOS'ta Safari olmayan tarayıcıda Notification API yok
    if (isIOSNonSafari) {      // iOS'ta Safari dışı tarayıcı uyarısı göster
      if (user) {
        setShow(true);
      }
      return;
    }
    
    // Bildirim iznini kontrol et
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
      
      // iOS PWA kontrolü
      const ua = navigator.userAgent;
      const isIOS = /iPhone|iPad|iPod/i.test(ua);
      const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone === true;
      
      // iOS'ta bildirimler sadece PWA modunda çalışır
      if (isIOS && !isPWA && isIOSSafari) {        // iOS PWA uyarısı göster (AddToHomeScreenPrompt zaten gösteriyor)
        return;
      }
      
      // Eğer izin verilmemişse (default), butonu göster
      if (Notification.permission === "default" && user) {
        // Mobil cihaz kontrolü
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // Mobilde hemen göster ve 1.5 saniye sonra otomatik olarak izin iste
          setShow(true);
          // Popup gösterildikten 1.5 saniye sonra otomatik olarak izin iste
          // NOT: User gesture gerekli ama popup gösterildikten sonra kısa bir süre bekleyip otomatik isteyebiliriz
          setTimeout(async () => {
            // Otomatik izin iste (sadece popup gösterildikten sonra)            try {
              // Direkt olarak izin iste
              if ('Notification' in window && Notification.permission === 'default') {
                const permission = await Notification.requestPermission();                if (permission === 'granted') {
                  // İzin verildi, token al
                  const { requestNotificationPermission, saveFCMTokenToUser } = await import("@/lib/fcmUtils");
                  const token = await requestNotificationPermission();
                  if (token && user) {
                    await saveFCMTokenToUser(user.uid, token);
                    setPermission("granted");
                    setShow(false);                  }
                }
              }
            } catch (autoError) {              // Hata olsa bile popup açık kalsın, kullanıcı manuel tıklayabilir
            }
          }, 1500);
        } else {
          // Masaüstünde 2 saniye sonra göster
          setTimeout(() => setShow(true), 2000);
        }
      }
      
      // İzin verilmişse ama token yoksa da göster (token yenileme için)
      if (Notification.permission === "granted" && user) {
        // Token kontrolü yapılabilir ama şimdilik sadece izin kontrolü yeterli      }
    } else if (user) {
      // Notification API yok - muhtemelen iOS non-Safari      setShow(true);
    }
  }, [user]);

  const handleRequestPermission = async () => {
    if (!user) {
      alert("Lütfen önce giriş yapın");
      return;
    }

    try {
      setLoading(true);
      
      // İlk kontrol: Notification API var mı?
      if (!('Notification' in window)) {        alert("❌ Bu tarayıcıda bildirimler desteklenmiyor.\n\niOS kullanıyorsanız Safari tarayıcısını kullanın.");
        setLoading(false);
        return;
      }
      
      // İkinci kontrol: Service Worker var mı?
      if (!('serviceWorker' in navigator)) {        alert("❌ Service Worker desteklenmiyor.\n\nLütfen tarayıcınızı güncelleyin.");
        setLoading(false);
        return;
      }      // MOBIL FIX: Bu user gesture (button click) içinde çağrıldığı için mobilde çalışır      const token = await requestNotificationPermission();
      
      if (token) {
        try {
          await saveFCMTokenToUser(user.uid, token);          // Firestore'da token'ın gerçekten kaydedildiğini doğrula
          const { doc, getDoc } = await import("firebase/firestore");
          const { db } = await import("@/lib/firebase");
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const savedTokens = userSnap.data().fcmTokens || [];
            const tokenSaved = savedTokens.includes(token);            if (!tokenSaved) {              // Tekrar kaydetmeyi dene
              await saveFCMTokenToUser(user.uid, token);            }
          }
          
          setPermission("granted");
          setShow(false);
          setLoading(false);
          
          // Başarı mesajı
          alert("✅ Bildirimler aktif edildi!\n\nArtık mesaj ve soru yanıtlarını anında alacaksınız.");
        } catch (saveError: any) {          setLoading(false);
          alert(`❌ Token kaydedilemedi\n\nHata: ${saveError.message}\n\nLütfen sayfayı yenileyin ve tekrar deneyin.`);
        }
      } else {        // Detaylı hata debug
        const debugInfo = {
          notificationPermission: Notification.permission,
          swReady: 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.then(() => true).catch(() => false) : false
        };        setLoading(false);
        alert(`❌ Token alınamadı\n\nHata detayları:\n- İzin durumu: ${debugInfo.notificationPermission}\n- Service Worker: ${debugInfo.swReady ? 'Hazır' : 'Hazır değil'}\n\nLütfen sayfayı yenileyin ve tekrar deneyin.`);
      }
    } catch (error: any) {      // Hata mesajını daha detaylı göster
      let errorMsg = "Bir hata oluştu:\n\n";
      errorMsg += error.message || error.toString();
      
      if (error.code) {
        errorMsg += `\n\nHata kodu: ${error.code}`;
      }
      
      errorMsg += "\n\nLütfen:\n1. Sayfayı yenileyin\n2. Tarayıcı ayarlarından bildirimlere izin verin\n3. Tekrar deneyin";
      
      // CRITICAL: Her durumda loading state'i temizle
      setLoading(false);
      alert(errorMsg);
    } finally {
      // EXTRA SAFETY: finally bloğunda da loading state'i temizle
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    // 1 dakika sonra tekrar göster
    setTimeout(() => setShow(true), 60000);
  };

  // İzin verilmişse veya kullanıcı yoksa gösterme
  if (!show || !user || permission === "granted") {
    return null;
  }

  // iOS browser tespit (render içinde)
  const ua = typeof window !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isIOSSafari = isIOS && /Version\/[\d.]+/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  const isIOSChrome = isIOS && /CriOS/i.test(ua);
  const isIOSFirefox = isIOS && /FxiOS/i.test(ua);
  const isIOSEdge = isIOS && /EdgiOS/i.test(ua);
  const isIOSNonSafari = isIOSChrome || isIOSFirefox || isIOSEdge;
  const notificationNotSupported = typeof window !== "undefined" && !("Notification" in window);

  // iOS'ta Safari olmayan tarayıcı uyarısı (Safari değilse VE Notification yoksa)
  if (isIOSNonSafari && notificationNotSupported) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-slide-up">
        <div className="bg-orange-500 text-white rounded-lg shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🍎</div>
            <div className="flex-1">
              <p className="font-bold text-base mb-1">
                iOS'ta Safari Kullanın
              </p>
              <p className="text-sm opacity-90 mb-2">
                iPhone'da bildirimler sadece <strong>Safari tarayıcısında</strong> çalışır.
                {isIOSChrome && " Chrome'da "}
                {isIOSFirefox && " Firefox'ta "}
                {isIOSEdge && " Edge'de "}
                web bildirimleri desteklenmez.
              </p>
              <p className="text-xs opacity-80 mb-3">
                💡 Safari'yi açın ve giriş yapın, bildirimleri aktif edin.
              </p>
              <button
                onClick={() => setShow(false)}
                className="w-full bg-white text-orange-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-100 transition"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // İzin reddedilmişse farklı bir mesaj
  if (permission === "denied") {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
        <div className="bg-yellow-500 text-white rounded-lg shadow-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1">
                Bildirimler Kapalı
              </p>
              <p className="text-xs opacity-90">
                Bildirimleri aktif etmek için tarayıcı ayarlarından izin vermelisiniz.
              </p>
            </div>
            <button
              onClick={() => setShow(false)}
              className="text-white hover:bg-yellow-600 rounded p-1"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-slide-up">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🔔</div>
          <div className="flex-1">
            <p className="font-bold text-base mb-1">
              Bildirimleri Aktif Et
            </p>
            <p className="text-sm opacity-90 mb-3">
              Mesajlarınızı ve soru yanıtlarınızı anında almak için bildirimlere izin verin.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRequestPermission}
                disabled={loading}
                className="flex-1 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "⏳ İşleniyor..." : "✅ İzin Ver"}
              </button>
              <button
                onClick={handleDismiss}
                disabled={loading}
                className="px-4 py-2 rounded-lg font-semibold text-sm hover:bg-white/20 transition disabled:opacity-50"
              >
                Sonra
              </button>
            </div>
            {loading && (
              <p className="text-xs text-center text-white/80 mt-2">
                Lütfen bekleyin, izin isteniyor...
              </p>
            )}
            {loading && (
              <p className="text-xs text-center text-white/80 mt-2">
                Lütfen bekleyin, izin isteniyor...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

