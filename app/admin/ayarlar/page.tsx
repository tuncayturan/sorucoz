"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";
import Image from "next/image";

interface SiteSettings {
  logo?: string;
  icon?: string;
  favicon?: string;
  siteName?: string;
  footerCopyright?: string;
  footerDescription?: string;
  notificationSound?: string; // Bildirim sesi URL'si
  landingVideoUrl?: string; // Landing sayfası video background URL'si
  litePlanPrice?: number; // Lite plan fiyatı (₺/ay)
  premiumPlanPrice?: number; // Premium plan fiyatı (₺/ay)
  yearlyDiscountPercent?: number; // Yıllık plan indirim oranı (%)
}

export default function AdminAyarlarPage() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"logo" | "icon" | "favicon" | "notificationSound" | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const settingsRef = doc(db, "siteSettings", "main");
      const snapshot = await getDoc(settingsRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as SiteSettings;
        // Varsayılan değerleri ekle (eğer yoksa)
        setSettings({
          ...data,
          footerCopyright: data.footerCopyright || `© ${new Date().getFullYear()} ${data.siteName || "SoruÇöz"}. Tüm hakları saklıdır.`,
          footerDescription: data.footerDescription || "Açıklama Metni",
          litePlanPrice: data.litePlanPrice || 99,
          premiumPlanPrice: data.premiumPlanPrice || 399,
          yearlyDiscountPercent: data.yearlyDiscountPercent || 15,
        });
      } else {
        // Hiç ayar yoksa varsayılan değerlerle başlat
        setSettings({
          footerCopyright: `© ${new Date().getFullYear()} SoruÇöz. Tüm hakları saklıdır.`,
          footerDescription: "Açıklama Metni",
          litePlanPrice: 99,
          premiumPlanPrice: 399,
          yearlyDiscountPercent: 15,
        });
      }
    } catch (error) {      showToast("Ayarlar yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (type: "logo" | "icon" | "favicon" | "notificationSound", file: File) => {
    if (!file) return;

    const isAudioUpload = type === "notificationSound";

    // Dosya boyutu kontrolü
    const maxSize = isAudioUpload ? 2 * 1024 * 1024 : 5 * 1024 * 1024; // Ses: 2MB, Resim: 5MB
    if (file.size > maxSize) {
      const maxSizeMB = isAudioUpload ? 2 : 5;
      showToast(`Dosya boyutu ${maxSizeMB}MB'dan küçük olmalıdır`, "error");
      return;
    }

    // Dosya tipi kontrolü
    if (isAudioUpload) {
      const validAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];
      if (!validAudioTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm)$/i)) {
        showToast("Lütfen geçerli bir ses dosyası seçin (MP3, WAV, OGG, WebM)", "error");
        return;
      }
    } else {
      if (!file.type.startsWith("image/")) {
        showToast("Lütfen bir resim dosyası seçin", "error");
        return;
      }
    }

    try {
      setUploading(type);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/cloudinary/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Yükleme başarısız");
      }

      const data = await response.json();
      const imageUrl = data.url;

      // Firestore'a kaydet
      const settingsRef = doc(db, "siteSettings", "main");
      await setDoc(
        settingsRef,
        {
          [type]: imageUrl,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setSettings((prev) => ({ ...prev, [type]: imageUrl }));
      
      const typeLabel = 
        type === "logo" ? "Logo" : 
        type === "icon" ? "İkon" : 
        type === "favicon" ? "Favicon" : 
        "Bildirim Sesi";
      
      showToast(`${typeLabel} başarıyla güncellendi!`, "success");
    } catch (error: any) {      showToast(error.message || "Yükleme başarısız", "error");
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
          <div className="w-16 h-16 border-4 border-gray-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Site Ayarları</h1>
        <p className="text-gray-600 mb-4">Logo, ikon, favicon ve site bilgileri yönetimi</p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-gray-700">
          <p className="font-semibold mb-2">ℹ️ Bilgi:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>Logo: Ana sayfa, giriş ekranı ve uygulama içinde görünen ana logo</li>
            <li>İkon: Uygulama ikonu - mobil cihazlarda ve masaüstüne ekleme sırasında görünen ikon</li>
            <li>Favicon: Tarayıcı sekmesinde görünen küçük ikon</li>
            <li>Değişikliklerin görünmesi için sayfayı yenilemeniz gerekebilir</li>
          </ul>
        </div>
      </div>

      {/* Settings Cards */}
      <div className="space-y-6">
        {/* Site Adı */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🏷️</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Site Adı</h2>
                <p className="text-sm text-gray-600">Header'da görünen site adı</p>
                <p className="text-xs text-gray-500 mt-1">Logo yanında görünen site/marka adı. Boş bırakılırsa varsayılan "SoruÇöz" kullanılır.</p>
              </div>
            </div>
            <div>
              <input
                type="text"
                value={settings.siteName || ""}
                onChange={(e) => setSettings((prev) => ({ ...prev, siteName: e.target.value }))}
                onBlur={async () => {
                  try {
                    const settingsRef = doc(db, "siteSettings", "main");
                    await setDoc(
                      settingsRef,
                      {
                        siteName: settings.siteName || null,
                        updatedAt: new Date(),
                      },
                      { merge: true }
                    );
                    showToast("Site adı güncellendi!", "success");
                  } catch (error: any) {
                    showToast(error.message || "Güncelleme başarısız", "error");
                  }
                }}
                placeholder="SoruÇöz"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🖼️</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Logo</h2>
                <p className="text-sm text-gray-600">Ana sayfa ve uygulama logosu</p>
                <p className="text-xs text-gray-500 mt-1">Giriş ekranı, ana sayfa ve uygulama içinde görünen ana marka logosu. Önerilen boyut: 512x512px veya daha büyük, kare format.</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {settings.logo && (
                <div className="relative w-32 h-32 bg-gray-100 rounded-2xl overflow-hidden border-2 border-gray-200">
                  <Image
                    src={settings.logo}
                    alt="Logo"
                    fill
                    className="object-contain"
                  />
                </div>
              )}
              <div className="flex-1">
                <label className="block mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload("logo", file);
                    }}
                    className="hidden"
                    disabled={uploading === "logo"}
                  />
                  <div className="cursor-pointer">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 hover:shadow-lg transition text-center">
                      {uploading === "logo" ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-sm text-gray-600">Yükleniyor...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">📤</span>
                          <p className="text-sm font-semibold text-gray-700">Logo Yükle</p>
                          <p className="text-xs text-gray-500">PNG, JPG (Max 5MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Icon */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🎨</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">İkon</h2>
                <p className="text-sm text-gray-600">Uygulama ikonu (app icon)</p>
                <p className="text-xs text-gray-500 mt-1">Mobil cihazlarda ve masaüstüne "Ana Ekrana Ekle" özelliği ile eklendiğinde görünen ikon. Önerilen boyut: 512x512px, kare format, şeffaf arka plan tercih edilir.</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {settings.icon && (
                <div className="relative w-32 h-32 bg-gray-100 rounded-2xl overflow-hidden border-2 border-gray-200">
                  <Image
                    src={settings.icon}
                    alt="Icon"
                    fill
                    className="object-contain"
                  />
                </div>
              )}
              <div className="flex-1">
                <label className="block mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload("icon", file);
                    }}
                    className="hidden"
                    disabled={uploading === "icon"}
                  />
                  <div className="cursor-pointer">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100 hover:shadow-lg transition text-center">
                      {uploading === "icon" ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-sm text-gray-600">Yükleniyor...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">📤</span>
                          <p className="text-sm font-semibold text-gray-700">İkon Yükle</p>
                          <p className="text-xs text-gray-500">PNG, JPG (Max 5MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Favicon */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-yellow-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">⭐</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Favicon</h2>
                <p className="text-sm text-gray-600">Tarayıcı sekmesi ikonu</p>
                <p className="text-xs text-gray-500 mt-1">Web tarayıcısının sekme başlığında görünen küçük ikon. Önerilen boyut: 32x32px veya 64x64px, kare format. Değişikliklerin görünmesi için tarayıcı önbelleğini temizlemeniz gerekebilir.</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {settings.favicon && (
                <div className="relative w-32 h-32 bg-gray-100 rounded-2xl overflow-hidden border-2 border-gray-200">
                  <Image
                    src={settings.favicon}
                    alt="Favicon"
                    fill
                    className="object-contain"
                  />
                </div>
              )}
              <div className="flex-1">
                <label className="block mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload("favicon", file);
                    }}
                    className="hidden"
                    disabled={uploading === "favicon"}
                  />
                  <div className="cursor-pointer">
                    <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-100 hover:shadow-lg transition text-center">
                      {uploading === "favicon" ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-sm text-gray-600">Yükleniyor...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">📤</span>
                          <p className="text-sm font-semibold text-gray-700">Favicon Yükle</p>
                          <p className="text-xs text-gray-500">PNG, JPG (Max 5MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Sound */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-pink-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🔔</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Bildirim Sesi</h2>
                <p className="text-sm text-gray-600">Push bildirimlerde çalacak özel ses</p>
                <p className="text-xs text-gray-500 mt-1">Kullanıcılara gönderilen bildirimlerde çalacak ses dosyası. Önerilen format: MP3, WAV (Max 2MB). Boş bırakılırsa sistem varsayılan sesi kullanılır.</p>
              </div>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {settings.notificationSound && (
                <div className="w-full md:w-auto">
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-pink-100 to-rose-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🎵</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 mb-1">Mevcut Ses</p>
                        <audio controls className="w-full max-w-xs">
                          <source src={settings.notificationSound} type="audio/mpeg" />
                          Tarayıcınız ses oynatmayı desteklemiyor.
                        </audio>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex-1 w-full">
                <label className="block mb-2">
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,.mp3,.wav,.ogg,.webm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload("notificationSound", file);
                    }}
                    className="hidden"
                    disabled={uploading === "notificationSound"}
                  />
                  <div className="cursor-pointer">
                    <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-6 border border-pink-100 hover:shadow-lg transition text-center">
                      {uploading === "notificationSound" ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-sm text-gray-600">Yükleniyor...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">📤</span>
                          <p className="text-sm font-semibold text-gray-700">Bildirim Sesi Yükle</p>
                          <p className="text-xs text-gray-500">MP3, WAV, OGG, WebM (Max 2MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </label>
                {settings.notificationSound && (
                  <button
                    onClick={async () => {
                      if (!confirm("Bildirim sesini kaldırmak istediğinize emin misiniz? Varsayılan ses kullanılacaktır.")) return;
                      try {
                        const settingsRef = doc(db, "siteSettings", "main");
                        await setDoc(
                          settingsRef,
                          {
                            notificationSound: null,
                            updatedAt: new Date(),
                          },
                          { merge: true }
                        );
                        setSettings((prev) => ({ ...prev, notificationSound: undefined }));
                        showToast("Bildirim sesi kaldırıldı. Varsayılan ses kullanılacak.", "success");
                      } catch (error: any) {
                        showToast(error.message || "Silme başarısız", "error");
                      }
                    }}
                    className="mt-3 w-full px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition font-medium text-sm"
                  >
                    🗑️ Özel Sesi Kaldır (Varsayılana Dön)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Paket Fiyatları */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Paket Fiyatları</h2>
                <p className="text-sm text-gray-600">Premium sayfasında gösterilecek fiyatlar</p>
                <p className="text-xs text-gray-500 mt-1">Fiyatlar TL cinsinden girilmelidir</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lite Plan Fiyatı (₺/ay)
                </label>
                <input
                  type="number"
                  value={settings.litePlanPrice || ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, litePlanPrice: parseInt(e.target.value) || 0 }))}
                  onBlur={async () => {
                    try {
                      const settingsRef = doc(db, "siteSettings", "main");
                      await setDoc(
                        settingsRef,
                        {
                          litePlanPrice: settings.litePlanPrice || 99,
                          updatedAt: new Date(),
                        },
                        { merge: true }
                      );
                      showToast("Lite plan fiyatı güncellendi!", "success");
                    } catch (error: any) {
                      showToast(error.message || "Güncelleme başarısız", "error");
                    }
                  }}
                  placeholder="99"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Varsayılan: ₺99</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Premium Plan Fiyatı (₺/ay)
                </label>
                <input
                  type="number"
                  value={settings.premiumPlanPrice || ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, premiumPlanPrice: parseInt(e.target.value) || 0 }))}
                  onBlur={async () => {
                    try {
                      const settingsRef = doc(db, "siteSettings", "main");
                      await setDoc(
                        settingsRef,
                        {
                          premiumPlanPrice: settings.premiumPlanPrice || 399,
                          updatedAt: new Date(),
                        },
                        { merge: true }
                      );
                      showToast("Premium plan fiyatı güncellendi!", "success");
                    } catch (error: any) {
                      showToast(error.message || "Güncelleme başarısız", "error");
                    }
                  }}
                  placeholder="399"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Varsayılan: ₺399</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Yıllık Plan İndirim Oranı (%)
              </label>
              <input
                type="number"
                value={settings.yearlyDiscountPercent || ""}
                onChange={(e) => setSettings((prev) => ({ ...prev, yearlyDiscountPercent: parseInt(e.target.value) || 0 }))}
                onBlur={async () => {
                  try {
                    const settingsRef = doc(db, "siteSettings", "main");
                    await setDoc(
                      settingsRef,
                      {
                        yearlyDiscountPercent: settings.yearlyDiscountPercent || 15,
                        updatedAt: new Date(),
                      },
                      { merge: true }
                    );
                    showToast("Yıllık indirim oranı güncellendi!", "success");
                  } catch (error: any) {
                    showToast(error.message || "Güncelleme başarısız", "error");
                  }
                }}
                placeholder="15"
                min="0"
                max="100"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Yıllık plan seçildiğinde uygulanacak indirim oranı. Varsayılan: %15
              </p>
              <div className="mt-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs text-yellow-800">
                  <strong>Örnek:</strong> Lite aylık ₺{settings.litePlanPrice || 99}, yıllık indirim %{settings.yearlyDiscountPercent || 15} → 
                  Yıllık fiyat: ₺{Math.round((settings.litePlanPrice || 99) * 12 * (1 - (settings.yearlyDiscountPercent || 15) / 100))}
                  {' '}(₺{Math.round((settings.litePlanPrice || 99) * 12 * (1 - (settings.yearlyDiscountPercent || 15) / 100) / 12)}/ay)
                </p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm text-blue-800 font-semibold mb-2">💡 Bilgi:</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Fiyatlar değiştirildiğinde otomatik olarak kaydedilir</li>
                <li>Premium sayfasında öğrencilere bu fiyatlar gösterilir</li>
                <li>Fiyat değişiklikleri tüm kullanıcılar için geçerlidir</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Landing Video Background */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🎬</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Landing Video Background</h2>
                <p className="text-sm text-gray-600">Ana sayfa arka plan videosu</p>
                <p className="text-xs text-gray-500 mt-1">Landing sayfasında arka planda oynatılacak video URL'si. MP4, WebM formatları desteklenir. Boş bırakılırsa gradient background kullanılır.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video URL
                </label>
                <input
                  type="url"
                  value={settings.landingVideoUrl || ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, landingVideoUrl: e.target.value }))}
                  onBlur={async () => {
                    try {
                      const settingsRef = doc(db, "siteSettings", "main");
                      await setDoc(
                        settingsRef,
                        {
                          landingVideoUrl: settings.landingVideoUrl || null,
                          updatedAt: new Date(),
                        },
                        { merge: true }
                      );
                      showToast("Video URL güncellendi!", "success");
                    } catch (error: any) {
                      showToast(error.message || "Güncelleme başarısız", "error");
                    }
                  }}
                  placeholder="https://example.com/video.mp4"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Video URL'si (MP4, WebM). Örnek: Cloudinary, Vimeo, veya başka bir CDN linki
                </p>
              </div>
              {settings.landingVideoUrl && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Video Önizleme:</p>
                  <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
                    <video
                      src={settings.landingVideoUrl}
                      controls
                      className="w-full h-full object-contain"
                      onError={(e) => {                      }}
                    >
                      Tarayıcınız video oynatmayı desteklemiyor.
                    </video>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Video otomatik oynatma, döngü ve sessiz modda çalışacaktır.
                  </p>
                </div>
              )}
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-800 font-semibold mb-2">💡 Video Önerileri:</p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>Önerilen format: MP4 (H.264 codec)</li>
                  <li>Dosya boyutu: 5-10 MB (daha küçük = daha hızlı yükleme)</li>
                  <li>Çözünürlük: 1080p veya 720p</li>
                  <li>Süre: 10-30 saniye (döngüye uygun)</li>
                  <li>İçerik: Minimal, yavaş hareket eden, eğitim temalı</li>
                  <li>CDN önerileri: Cloudinary, Vimeo, YouTube (embed), veya kendi sunucunuz</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Ayarları */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">📄</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Footer Ayarları</h2>
                <p className="text-sm text-gray-600">Alt bilgi metinleri</p>
                <p className="text-xs text-gray-500 mt-1">Öğrenci sayfalarının altında görünen footer bilgileri</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Copyright Metni
                </label>
                <input
                  type="text"
                  value={settings.footerCopyright || ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, footerCopyright: e.target.value }))}
                  onBlur={async () => {
                    try {
                      const settingsRef = doc(db, "siteSettings", "main");
                      await setDoc(
                        settingsRef,
                        {
                          footerCopyright: settings.footerCopyright || null,
                          updatedAt: new Date(),
                        },
                        { merge: true }
                      );
                      showToast("Copyright metni güncellendi!", "success");
                    } catch (error: any) {
                      showToast(error.message || "Güncelleme başarısız", "error");
                    }
                  }}
                  placeholder={`© ${new Date().getFullYear()} ${settings.siteName || "SoruÇöz"}. Tüm hakları saklıdır.`}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Boş bırakılırsa varsayılan metin kullanılır</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama Metni
                </label>
                <input
                  type="text"
                  value={settings.footerDescription || ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, footerDescription: e.target.value }))}
                  onBlur={async () => {
                    try {
                      const settingsRef = doc(db, "siteSettings", "main");
                      await setDoc(
                        settingsRef,
                        {
                          footerDescription: settings.footerDescription || null,
                          updatedAt: new Date(),
                        },
                        { merge: true }
                      );
                      showToast("Açıklama metni güncellendi!", "success");
                    } catch (error: any) {
                      showToast(error.message || "Güncelleme başarısız", "error");
                    }
                  }}
                  placeholder="AI destekli soru çözme platformu"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Boş bırakılırsa varsayılan metin kullanılır</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}

