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
    // Bildirim iznini kontrol et
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
      
      // Eğer izin verilmemişse (default), butonu göster
      if (Notification.permission === "default" && user) {
        // Mobil cihaz kontrolü
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // Mobilde hemen göster
          setShow(true);
        } else {
          // Masaüstünde 2 saniye sonra göster
          setTimeout(() => setShow(true), 2000);
        }
      }
    }
  }, [user]);

  const handleRequestPermission = async () => {
    if (!user) {
      alert("Lütfen önce giriş yapın");
      return;
    }

    try {
      setLoading(true);
      console.log("[FCMTokenManager] 📱 User clicked - requesting permission...");
      console.log("[FCMTokenManager] 👤 User:", user.email);
      
      // MOBIL FIX: Bu user gesture (button click) içinde çağrıldığı için mobilde çalışır
      const token = await requestNotificationPermission();
      
      if (token) {
        console.log("[FCMTokenManager] ✅ Token received:", token.substring(0, 30) + "...");
        console.log("[FCMTokenManager] 💾 Saving to Firestore...");
        
        await saveFCMTokenToUser(user.uid, token);
        
        console.log("[FCMTokenManager] ✅ Token saved successfully!");
        setPermission("granted");
        setShow(false);
        
        // Başarı mesajı
        alert("✅ Bildirimler aktif edildi! Artık mesaj ve soru yanıtlarını anında alacaksınız.");
      } else {
        console.warn("[FCMTokenManager] ⚠️ Token could not be retrieved");
        console.warn("[FCMTokenManager] Possible reasons:");
        console.warn("  - User denied permission");
        console.warn("  - Service worker not ready");
        console.warn("  - VAPID key missing/invalid");
        
        alert("Bildirim izni alınamadı. Lütfen:\n1. Tarayıcı bildirim iznini kontrol edin\n2. Sayfayı yenileyin\n3. Tekrar deneyin");
      }
    } catch (error: any) {
      console.error("[FCMTokenManager] ❌ Error:", error);
      console.error("[FCMTokenManager] Error details:", error.message || error);
      alert("Bir hata oluştu: " + (error.message || "Bilinmeyen hata"));
    } finally {
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
                className="flex-1 bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-100 transition disabled:opacity-50"
              >
                {loading ? "⏳ İşleniyor..." : "✅ İzin Ver"}
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 rounded-lg font-semibold text-sm hover:bg-white/20 transition"
              >
                Sonra
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

