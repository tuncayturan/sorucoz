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
}

export default function AdminAyarlarPage() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"logo" | "icon" | "favicon" | null>(null);
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
        });
      } else {
        // Hiç ayar yoksa varsayılan değerlerle başlat
        setSettings({
          footerCopyright: `© ${new Date().getFullYear()} SoruÇöz. Tüm hakları saklıdır.`,
          footerDescription: "Açıklama Metni",
        });
      }
    } catch (error) {
      console.error("Ayarlar yüklenirken hata:", error);
      showToast("Ayarlar yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (type: "logo" | "icon" | "favicon", file: File) => {
    if (!file) return;

    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast("Dosya boyutu 5MB'dan küçük olmalıdır", "error");
      return;
    }

    // Dosya tipi kontrolü
    if (!file.type.startsWith("image/")) {
      showToast("Lütfen bir resim dosyası seçin", "error");
      return;
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
      showToast(`${type === "logo" ? "Logo" : type === "icon" ? "İkon" : "Favicon"} başarıyla güncellendi!`, "success");
    } catch (error: any) {
      console.error("Yükleme hatası:", error);
      showToast(error.message || "Yükleme başarısız", "error");
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
                      if (file) handleImageUpload("logo", file);
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
                      if (file) handleImageUpload("icon", file);
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
                      if (file) handleImageUpload("favicon", file);
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

