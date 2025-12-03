"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";

export default function TestFCMPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [swStatus, setSwStatus] = useState<string>("Checking...");
  const [permission, setPermission] = useState<string>("unknown");

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[FCM Test] ${message}`);
  };

  // Service Worker durumunu kontrol et
  useEffect(() => {
    const checkServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) {
        setSwStatus("❌ Service Worker desteklenmiyor");
        addLog("Service Worker bu tarayıcıda desteklenmiyor");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
        
        if (registration) {
          if (registration.active) {
            setSwStatus("✅ Service Worker aktif");
            addLog("Service Worker aktif ve çalışıyor");
          } else if (registration.installing) {
            setSwStatus("⏳ Service Worker yükleniyor...");
            addLog("Service Worker yükleniyor");
          } else if (registration.waiting) {
            setSwStatus("⏸️ Service Worker bekliyor");
            addLog("Service Worker beklemede");
          }
        } else {
          setSwStatus("❌ Service Worker kayıtlı değil");
          addLog("Service Worker kayıtlı değil");
        }
      } catch (error) {
        setSwStatus("❌ Hata: " + error);
        addLog("Service Worker kontrolünde hata: " + error);
      }
    };

    checkServiceWorker();

    // Bildirim iznini kontrol et
    if ('Notification' in window) {
      setPermission(Notification.permission);
      addLog(`Bildirim izni: ${Notification.permission}`);
    }
  }, []);

  const handleGetToken = async () => {
    setLoading(true);
    setLogs([]);
    
    try {
      addLog("🚀 Token alma işlemi başlatılıyor...");
      addLog(`👤 Kullanıcı: ${user?.email || 'Giriş yapılmamış'}`);
      
      // Service Worker kontrolü
      addLog("🔍 Service Worker kontrol ediliyor...");
      if (!('serviceWorker' in navigator)) {
        addLog("❌ Service Worker desteklenmiyor");
        alert("Service Worker bu tarayıcıda desteklenmiyor");
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
      if (!registration) {
        addLog("❌ Service Worker kayıtlı değil");
        addLog("⏳ Service Worker kaydediliyor...");
        
        // Service Worker'ı kaydet
        const newReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/firebase-cloud-messaging-push-scope'
        });
        
        addLog("✅ Service Worker kaydedildi");
        
        // Aktif olmasını bekle
        if (newReg.installing) {
          addLog("⏳ Service Worker aktif olması bekleniyor...");
          await new Promise<void>((resolve) => {
            newReg.installing!.addEventListener('statechange', function() {
              if (this.state === 'activated') {
                addLog("✅ Service Worker aktif");
                resolve();
              }
            });
          });
        }
      } else {
        addLog("✅ Service Worker kayıtlı");
        if (registration.active) {
          addLog("✅ Service Worker aktif");
        } else {
          addLog("⚠️ Service Worker henüz aktif değil");
        }
      }

      // Bildirim izni kontrolü
      addLog("🔔 Bildirim izni kontrol ediliyor...");
      const currentPermission = Notification.permission;
      addLog(`📋 Mevcut izin: ${currentPermission}`);

      if (currentPermission === 'denied') {
        addLog("❌ Bildirim izni reddedilmiş!");
        alert("Bildirim izni reddedilmiş. Lütfen tarayıcı ayarlarından izin verin.");
        setLoading(false);
        return;
      }

      // Token al
      addLog("🎯 Token alınıyor...");
      const fcmToken = await requestNotificationPermission();
      
      if (fcmToken) {
        addLog("✅ Token alındı!");
        addLog(`Token (ilk 50 karakter): ${fcmToken.substring(0, 50)}...`);
        setToken(fcmToken);
        
        if (user) {
          addLog("💾 Token Firestore'a kaydediliyor...");
          await saveFCMTokenToUser(user.uid, fcmToken);
          addLog("✅ Token Firestore'a kaydedildi!");
          alert("✅ Token başarıyla alındı ve kaydedildi!");
        } else {
          addLog("⚠️ Kullanıcı giriş yapmamış, token kaydedilmedi");
          alert("Token alındı ancak kullanıcı giriş yapmamış");
        }
      } else {
        addLog("❌ Token alınamadı");
        alert("Token alınamadı. Lütfen logları kontrol edin.");
      }
      
    } catch (error: any) {
      addLog(`❌ HATA: ${error.message || error}`);
      console.error("FCM Test Error:", error);
      alert("Hata: " + (error.message || error));
    } finally {
      setLoading(false);
    }
  };

  const checkEnvironment = () => {
    addLog("🔍 Ortam kontrolleri yapılıyor...");
    addLog(`📱 User Agent: ${navigator.userAgent}`);
    
    // iOS version detection
    const ua = navigator.userAgent;
    const iOSMatch = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    if (iOSMatch) {
      const iOSVersion = `${iOSMatch[1]}.${iOSMatch[2]}${iOSMatch[3] ? '.' + iOSMatch[3] : ''}`;
      addLog(`🍎 iOS Version: ${iOSVersion}`);
      
      const majorVersion = parseInt(iOSMatch[1]);
      const minorVersion = parseInt(iOSMatch[2]);
      
      if (majorVersion < 16 || (majorVersion === 16 && minorVersion < 4)) {
        addLog(`❌ UYARI: iOS ${iOSVersion} - Web Push için iOS 16.4+ gerekli!`);
        addLog(`⚠️ Lütfen iOS'unuzu güncelleyin: Ayarlar > Genel > Yazılım Güncelleme`);
      } else {
        addLog(`✅ iOS ${iOSVersion} - Web Push destekleniyor`);
      }
    }
    
    // Browser detection
    const isIOSSafari = /iPhone|iPad|iPod/i.test(ua) && /Version\/[\d.]+/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
    const isIOSChrome = /iPhone|iPad|iPod/i.test(ua) && /CriOS/i.test(ua);
    
    if (isIOSSafari) {
      addLog(`🌐 Tarayıcı: Safari (iOS)`);
    } else if (isIOSChrome) {
      addLog(`🌐 Tarayıcı: Chrome (iOS) - ❌ Web Push desteklenmiyor`);
    } else {
      addLog(`🌐 Tarayıcı: ${ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Bilinmiyor'}`);
    }
    
    // Private mode detection (iOS Safari)
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      addLog(`🔓 Tarayıcı Modu: Normal`);
    } catch (e) {
      addLog(`🔒 Tarayıcı Modu: Özel/Gizli - ❌ Bildirimler çalışmaz!`);
      addLog(`⚠️ Lütfen normal modda açın`);
    }
    
    // PWA detection
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    addLog(`📱 PWA Modu: ${isPWA ? 'Evet (Ana ekrandan açıldı)' : 'Hayır (Tarayıcıdan açıldı)'}`);
    
    addLog(`🌐 Online: ${navigator.onLine ? 'Evet' : 'Hayır'}`);
    addLog(`🔔 Notification API: ${('Notification' in window) ? 'Var ✅' : 'Yok ❌'}`);
    addLog(`👷 Service Worker: ${('serviceWorker' in navigator) ? 'Var ✅' : 'Yok ❌'}`);
    addLog(`🔒 HTTPS: ${window.location.protocol === 'https:' ? 'Evet ✅' : 'Hayır ❌ (gerekli!)'}`);
    addLog(`🔐 Secure Context: ${window.isSecureContext ? 'Evet ✅' : 'Hayır ❌'}`);
    
    if ('Notification' in window) {
      addLog(`📋 Bildirim İzni: ${Notification.permission}`);
    } else {
      addLog(`❌ Notification API bulunamadı! Olası sebepler:`);
      addLog(`  1. iOS versiyonu 16.4'ten eski`);
      addLog(`  2. Özel/Gizli mod kullanılıyor`);
      addLog(`  3. Safari dışı tarayıcı (iOS'ta)`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">🧪 FCM Token Test Sayfası</h1>
          
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm"><strong>Kullanıcı:</strong> {user?.email || "Giriş yapılmamış"}</p>
            <p className="text-sm"><strong>Service Worker:</strong> {swStatus}</p>
            <p className="text-sm"><strong>Bildirim İzni:</strong> {permission}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGetToken}
              disabled={loading || !user}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700 transition"
            >
              {loading ? "⏳ İşlem Yapılıyor..." : "🚀 Token Al ve Kaydet"}
            </button>

            <button
              onClick={checkEnvironment}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              🔍 Ortam Kontrolü Yap
            </button>

            <button
              onClick={() => setLogs([])}
              className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition"
            >
              🗑️ Logları Temizle
            </button>
          </div>

          {!user && (
            <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800">
              <p className="font-semibold">⚠️ Giriş Yapılmamış</p>
              <p className="text-sm">Token test etmek için önce giriş yapmalısınız.</p>
            </div>
          )}
        </div>

        {token && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-lg">
            <p className="font-semibold text-green-800 mb-2">✅ Token Başarıyla Alındı!</p>
            <p className="text-sm text-green-700 break-all font-mono bg-white p-3 rounded">
              {token}
            </p>
          </div>
        )}

        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold">📋 Console Logs</h2>
            <span className="text-xs text-gray-500">{logs.length} log</span>
          </div>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <p className="text-gray-500 italic">Henüz log yok...</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="text-xs">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
          <p className="font-semibold text-blue-800 mb-2">💡 Sorun Giderme İpuçları</p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>HTTPS bağlantısı gereklidir (localhost hariç)</li>
            <li>Bildirim izni verilmiş olmalı</li>
            <li>Service Worker başarıyla kayıtlı olmalı</li>
            <li>VAPID key environment variables'da tanımlı olmalı</li>
            <li>Mobil cihazlarda izin isteme popup'ı görmek için sayfayı yenileyin</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

