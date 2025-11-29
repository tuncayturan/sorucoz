"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import Toast from "@/components/ui/Toast";

export default function CoachProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading, refresh: refreshUserData } = useUserData();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [whatsappConnecting, setWhatsappConnecting] = useState(false);
  const [whatsappQRCode, setWhatsappQRCode] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // Role check - redirect if not coach
  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (!user) {
        router.replace("/auth/login");
      } else if (userData?.role !== "coach") {
        if (userData?.role === "admin") {
          router.replace("/admin");
        } else {
          router.replace("/home");
        }
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  useEffect(() => {
    if (userData) {
      setName(userData.name || "");
      setEmail(userData.email || user?.email || "");
    }
  }, [userData, user]);

  // WhatsApp durumunu kontrol et (sadece bağlı değilse ve bağlanmıyorsa)
  useEffect(() => {
    if (!user || !userData || userData.role !== "coach") return;
    if (whatsappConnecting) return; // Bağlanma işlemi devam ediyorsa kontrol etme

    const checkWhatsAppStatus = async () => {
      try {
        const response = await fetch(`/api/whatsapp/connect?coachId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          setWhatsappConnected(data.isReady);
          // Eğer bağlıysa veya bağlanmıyorsa, connecting durumunu false yap
          if (data.isReady || !data.isInitializing) {
            setWhatsappConnecting(false);
          }
          if (data.qrCode) {
            setWhatsappQRCode(data.qrCode);
          }
        }
      } catch (error) {
        console.error("WhatsApp durum kontrolü hatası:", error);
      }
    };

    checkWhatsAppStatus();
    // Sadece bağlı değilse ve bağlanmıyorsa kontrol et (10 saniyede bir)
    if (!whatsappConnected && !whatsappConnecting) {
      const interval = setInterval(checkWhatsAppStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [user, userData, whatsappConnected, whatsappConnecting]);

  // İptal butonuna tıklandığında değerleri sıfırla
  const handleCancel = () => {
    setName(userData?.name || "");
  };

  // Profil resmini yükle
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Dosya boyutu 5MB'dan küçük olmalıdır.", "error");
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("Lütfen bir resim dosyası seçin.", "error");
      return;
    }

    try {
      setUploadingPhoto(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/cloudinary/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Yükleme başarısız oldu");
      }

      const data = await response.json();
      const photoURL = data.url;

      // Firestore'da güncelle
      await updateDoc(doc(db, "users", user.uid), {
        photoURL,
      });

      // Firebase Auth'da güncelle
      await updateProfile(user, {
        photoURL,
      });

      refreshUserData();
      showToast("Profil resmi başarıyla güncellendi!", "success");
    } catch (error: any) {
      console.error("Photo upload error:", error);
      showToast(error?.message || "Profil resmi yüklenirken bir hata oluştu.", "error");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Profil bilgilerini güncelle (sadece ad soyad)
  const handleSaveProfile = async () => {
    if (!name.trim() || !user) {
      showToast("Ad soyad boş olamaz.", "error");
      return;
    }

    // Değişiklik yoksa kaydetme
    if (name.trim() === (userData?.name || user?.displayName || "")) {
      return;
    }

    try {
      setSaving(true);

      // İsim güncelle - Firebase Auth'da
      await updateProfile(user, { displayName: name.trim() });

      // Firestore'da güncelle (sadece name)
      await updateDoc(doc(db, "users", user.uid), {
        name: name.trim(),
      });

      refreshUserData();
      showToast("Profil başarıyla güncellendi!", "success");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      showToast("Profil güncellenirken bir hata oluştu.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Şifre değiştir
  const handleChangePassword = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      showToast("Tüm alanları doldurun.", "error");
      return;
    }

    if (passwordData.new !== passwordData.confirm) {
      showToast("Yeni şifreler eşleşmiyor.", "error");
      return;
    }

    if (passwordData.new.length < 6) {
      showToast("Yeni şifre en az 6 karakter olmalıdır.", "error");
      return;
    }

    if (!user || !user.email) return;

    try {
      setChangingPassword(true);

      const credential = EmailAuthProvider.credential(user.email, passwordData.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordData.new);

      setPasswordData({ current: "", new: "", confirm: "" });
      showToast("Şifre başarıyla değiştirildi!", "success");
    } catch (error: any) {
      console.error("Password change error:", error);
      if (error.code === "auth/wrong-password") {
        showToast("Mevcut şifre yanlış.", "error");
      } else if (error.code === "auth/weak-password") {
        showToast("Yeni şifre çok zayıf.", "error");
      } else {
        showToast("Şifre değiştirilirken bir hata oluştu.", "error");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading || userDataLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/coach/chat")}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Geri Dön
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Profil Ayarları</h1>
          <p className="text-gray-600 mt-2">Profil bilgilerinizi düzenleyin</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50 p-6 mb-6">
          {/* Profile Photo */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              {userData?.photoURL || user?.photoURL ? (
                <img
                  src={userData?.photoURL || user?.photoURL || ""}
                  alt="Profil"
                  className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center border-4 border-white shadow-lg">
                  <span className="text-white text-4xl font-bold">
                    {(userData?.name || user?.displayName || "C").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-0 right-0 w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition disabled:opacity-50"
              >
                {uploadingPhoto ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <p className="text-sm text-gray-500 mt-2">Profil resmini değiştir</p>
          </div>

          {/* Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Ad Soyad</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ad Soyad"
            />
          </div>

          {/* Email (Read-only) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">E-posta</label>
            <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
              {userData?.email || user?.email || "E-posta yok"}
            </div>
            <p className="text-xs text-gray-500 mt-1">E-posta adresi değiştirilemez</p>
          </div>

          {/* WhatsApp Connection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bildirimleri WhatsApp'tan Al <span className="text-gray-500 font-normal">(Opsiyonel)</span>
            </label>
            <button
              onClick={async () => {
                if (!user || whatsappConnected) return; // Zaten bağlıysa işlem yapma
                
                setWhatsappConnecting(true);
                setWhatsappQRCode(null);
                
                let checkInterval: NodeJS.Timeout | null = null;
                let timeoutId: NodeJS.Timeout | null = null;
                
                try {
                      // İlk bağlantı isteği
                        const response = await fetch(`/api/whatsapp/connect?coachId=${user.uid}`);
                        if (response.ok) {
                          const data = await response.json();
                          if (data.isReady) {
                            // Zaten bağlıysa
                            setWhatsappConnected(true);
                            setWhatsappConnecting(false);
                            showToast("Artık bildirimleri WhatsApp'tan alabileceksiniz!", "success");
                            return;
                          }
                          
                          // İlk QR kod kontrolü
                          if (data.qrCode) {
                            setWhatsappQRCode(data.qrCode);
                          }
                          
                          // QR kod güncellemelerini dinle (500ms'de bir)
                          let attempts = 0;
                          const maxAttempts = 120; // 60 saniye için (120 * 500ms)
                          
                          checkInterval = setInterval(async () => {
                            attempts++;
                            try {
                              const statusResponse = await fetch(`/api/whatsapp/connect?coachId=${user.uid}`);
                              if (statusResponse.ok) {
                                const statusData = await statusResponse.json();
                                
                                console.log(`[${attempts}] Durum kontrolü:`, {
                                  isReady: statusData.isReady,
                                  isInitializing: statusData.isInitializing,
                                  hasQRCode: !!statusData.qrCode,
                                });
                                
                                if (statusData.isReady) {
                                  setWhatsappConnected(true);
                                  setWhatsappConnecting(false);
                                  setWhatsappQRCode(null);
                                  if (checkInterval) clearInterval(checkInterval);
                                  if (timeoutId) clearTimeout(timeoutId);
                                  showToast("Artık bildirimleri WhatsApp'tan alabileceksiniz!", "success");
                                  return;
                                }
                                
                                if (statusData.qrCode) {
                                  // QR kod geldiğinde güncelle (yeni veya güncellenmiş)
                                  console.log("✅ QR kod alındı!");
                                  setWhatsappQRCode(statusData.qrCode);
                                }
                                
                                // Eğer başlatma işlemi durduysa ve QR kod yoksa
                                if (!statusData.isInitializing && !statusData.isReady && !statusData.qrCode && attempts > 10) {
                                  console.warn("⚠️ Başlatma durdu ve QR kod yok");
                                  // Devam et, belki QR kod henüz gelmedi
                                }
                                
                                // Timeout kontrolü
                                if (attempts >= maxAttempts) {
                                  if (checkInterval) clearInterval(checkInterval);
                                  if (timeoutId) clearTimeout(timeoutId);
                                  setWhatsappConnecting(false);
                                  setWhatsappQRCode(null);
                                  showToast("QR kod oluşturulamadı. Lütfen tekrar deneyin.", "error");
                                  return;
                                }
                              } else {
                                const errorText = await statusResponse.text();
                                console.error("Durum kontrolü başarısız:", statusResponse.status, errorText);
                                // Hata durumunda uyarı göster
                                if (statusResponse.status === 500 && attempts > 5) {
                                  if (checkInterval) clearInterval(checkInterval);
                                  if (timeoutId) clearTimeout(timeoutId);
                                  setWhatsappConnecting(false);
                                  setWhatsappQRCode(null);
                                  showToast("WhatsApp bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin.", "error");
                                  return;
                                }
                              }
                            } catch (error) {
                              console.error("Durum kontrolü hatası:", error);
                              // Hata durumunda da devam et, sadece logla
                            }
                          }, 500); // 500ms'de bir kontrol et
                          
                          // 60 saniye sonra timeout (bağlantı kurulamazsa)
                          timeoutId = setTimeout(() => {
                            if (checkInterval) clearInterval(checkInterval);
                            setWhatsappConnecting(false);
                            setWhatsappQRCode(null);
                            showToast("WhatsApp bağlantısı zaman aşımına uğradı. Lütfen tekrar deneyin.", "error");
                          }, 60000); // 60 saniye
                        } else {
                          const errorData = await response.json().catch(() => ({}));
                          console.error("WhatsApp bağlantı hatası:", errorData);
                          const errorMessage = errorData.error || "WhatsApp bağlantısı başlatılamadı";
                          showToast(errorMessage, "error");
                          setWhatsappConnecting(false);
                        }
                } catch (error: any) {
                  console.error("WhatsApp bağlantı hatası:", error);
                  showToast(error?.message || "WhatsApp bağlantısı kurulamadı. Lütfen tekrar deneyin.", "error");
                  setWhatsappConnecting(false);
                  if (checkInterval) clearInterval(checkInterval);
                  if (timeoutId) clearTimeout(timeoutId);
                }
              }}
              disabled={whatsappConnecting || whatsappConnected}
              className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {whatsappConnecting ? "Bağlanıyor..." : whatsappConnected ? "Bildirimler Açık" : "Bildirimleri Aç"}
            </button>
          </div>

          {/* Role (Read-only) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rol</label>
            <div className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Coach
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveProfile}
              disabled={
                saving ||
                !name.trim() ||
                name.trim() === (userData?.name || user?.displayName || "")
              }
              className="flex-1 px-6 py-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            {name.trim() !== (userData?.name || user?.displayName || "") && (
              <button
                onClick={handleCancel}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                İptal
              </button>
            )}
          </div>
        </div>

        {/* Password Change Card */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Şifre Değiştir</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mevcut Şifre</label>
              <input
                type="password"
                value={passwordData.current}
                onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Mevcut şifrenizi girin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Yeni Şifre</label>
              <input
                type="password"
                value={passwordData.new}
                onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Yeni şifrenizi girin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Yeni Şifre (Tekrar)</label>
              <input
                type="password"
                value={passwordData.confirm}
                onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Yeni şifrenizi tekrar girin"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="w-full px-6 py-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50"
            >
              {changingPassword ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
            </button>
          </div>
        </div>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* QR Code Popup Modal */}
      {whatsappConnecting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-end items-center mb-4">
              <button
                onClick={() => {
                  setWhatsappConnecting(false);
                  setWhatsappQRCode(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              {whatsappQRCode ? (
                <>
                  <p className="text-sm text-gray-600 text-center">
                    WhatsApp uygulamanızı açın → Bağlı Cihazlar → Cihaz Bağla
                  </p>
                  <div className="p-4 bg-white rounded-xl border-2 border-gray-200">
                    <img
                      src={whatsappQRCode}
                      alt="WhatsApp QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    QR kodu taradıktan sonra bağlantı otomatik olarak kurulacaktır
                  </p>
                </>
              ) : (
                <>
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded-xl border-2 border-gray-200">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-600">QR kod hazırlanıyor...</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Lütfen bekleyin, QR kod oluşturuluyor
                  </p>
                </>
              )}
              <button
                onClick={() => {
                  setWhatsappConnecting(false);
                  setWhatsappQRCode(null);
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


