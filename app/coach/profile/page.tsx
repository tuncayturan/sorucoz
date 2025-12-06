"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { doc, updateDoc, getDoc } from "firebase/firestore";
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
  
  // WhatsApp bağlantı akışı için ref'ler (memory leak önleme)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isConnectingRef = useRef(false);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // Component unmount kontrolü ve cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Tüm interval ve timeout'ları temizle
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, []);

  // Role check - redirect if not coach
  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (!user) {
        router.replace("/landing");
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

  // WhatsApp durumunu sadece kontrol et (otomatik bağlanma yapma)
  useEffect(() => {
    if (!user || !userData || userData.role !== "coach") return;
    if (whatsappConnecting) return; // Bağlanma işlemi devam ediyorsa kontrol etme

    const checkWhatsAppStatus = async () => {
      try {
        // Firestore'dan durumu kontrol et
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          // Sadece durumu güncelle, bağlantı başlatma
          if (data.whatsappConnected) {
            setWhatsappConnected(true);
            setWhatsappConnecting(false);
            setWhatsappQRCode(null); // QR kod gösterme
          }
        }
        
        // API'den güncel durumu kontrol et (sadece durum kontrolü, bağlantı başlatma)
        const response = await fetch(`/api/whatsapp/connect?coachId=${user.uid}`);
        if (response.ok) {
          const data = await response.json();
          // Sadece zaten bağlıysa durumu güncelle
          if (data.isReady) {
            setWhatsappConnected(true);
            setWhatsappConnecting(false);
            setWhatsappQRCode(null); // QR kod gösterme
          } else {
            // Bağlı değilse ve bağlanmıyorsa durumu sıfırla
            if (!data.isInitializing) {
              setWhatsappConnected(false);
              setWhatsappConnecting(false);
              setWhatsappQRCode(null);
            }
          }
        }
      } catch (error) {
        console.error("WhatsApp durum kontrolü hatası:", error);
      }
    };

    checkWhatsAppStatus();
    
    // Sadece bağlı değilse ve bağlanmıyorsa durumu kontrol et (10 saniyede bir)
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
              Bildirimleri Aç <span className="text-gray-500 font-normal">(Opsiyonel)</span>
            </label>
            <button
              onClick={async () => {
                // Race condition önleme: Eğer zaten bağlanıyorsa, yeni isteği engelle
                if (isConnectingRef.current) {
                  console.warn("⚠️ WhatsApp bağlantı işlemi zaten devam ediyor, yeni istek engellendi");
                  return;
                }
                
                if (!user) {
                  showToast("Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.", "error");
                  return;
                }
                
                if (whatsappConnected) {
                  showToast("Bildirimler zaten açık!", "info");
                  return;
                }
                
                // Önceki interval ve timeout'ları temizle (güvenlik için)
                if (checkIntervalRef.current) {
                  clearInterval(checkIntervalRef.current);
                  checkIntervalRef.current = null;
                }
                if (timeoutIdRef.current) {
                  clearTimeout(timeoutIdRef.current);
                  timeoutIdRef.current = null;
                }
                
                // Bağlantı durumunu ayarla
                isConnectingRef.current = true;
                setWhatsappConnecting(true);
                setWhatsappQRCode(null);
                
                // Cleanup fonksiyonu
                const cleanup = () => {
                  if (checkIntervalRef.current) {
                    clearInterval(checkIntervalRef.current);
                    checkIntervalRef.current = null;
                  }
                  if (timeoutIdRef.current) {
                    clearTimeout(timeoutIdRef.current);
                    timeoutIdRef.current = null;
                  }
                  if (isMountedRef.current) {
                    isConnectingRef.current = false;
                  }
                };
                
                try {
                  // Başlatma zamanını Firestore'a kaydet
                  try {
                    const { db } = await import("@/lib/firebase");
                    const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
                    await updateDoc(doc(db, "users", user.uid), {
                      whatsappConnectingStartTime: serverTimestamp(),
                    });
                  } catch (error) {
                    console.error("Başlatma zamanı kaydetme hatası:", error);
                  }
                  
                  // İlk bağlantı isteği - Modal zaten açık (whatsappConnecting = true)
                  console.log("🚀 Bildirimler açılıyor...");
                  
                  // Network timeout kontrolü (10 saniye)
                  const controller = new AbortController();
                  const networkTimeout = setTimeout(() => controller.abort(), 10000);
                  
                  let response: Response;
                  try {
                    response = await fetch(`/api/whatsapp/connect?coachId=${user.uid}`, {
                      signal: controller.signal,
                    });
                    clearTimeout(networkTimeout);
                  } catch (fetchError: any) {
                    clearTimeout(networkTimeout);
                    if (fetchError.name === 'AbortError') {
                      console.error("❌ Network timeout: API yanıt vermedi");
                      cleanup();
                      if (isMountedRef.current) {
                        setWhatsappConnecting(false);
                        setWhatsappQRCode(null);
                        showToast("Bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.", "error");
                      }
                      return;
                    }
                    throw fetchError;
                  }
                  
                  if (!response.ok) {
                    let errorData: any = {};
                    try {
                      errorData = await response.json();
                    } catch (e) {
                      // JSON parse hatası
                      errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
                    }
                    console.error("❌ WhatsApp bağlantı hatası:", errorData);
                    const errorMessage = errorData.error || "WhatsApp bağlantısı başlatılamadı";
                    cleanup();
                    if (isMountedRef.current) {
                      setWhatsappConnecting(false);
                      setWhatsappQRCode(null);
                      showToast(errorMessage, "error");
                    }
                    return;
                  }
                  
                  let data: any;
                  try {
                    data = await response.json();
                  } catch (e) {
                    console.error("❌ JSON parse hatası:", e);
                    cleanup();
                    if (isMountedRef.current) {
                      setWhatsappConnecting(false);
                      setWhatsappQRCode(null);
                      showToast("Sunucu yanıtı işlenemedi. Lütfen tekrar deneyin.", "error");
                    }
                    return;
                  }
                  
                  console.log("📊 İlk API yanıtı:", {
                    isReady: data.isReady,
                    isInitializing: data.isInitializing,
                    hasQRCode: !!data.qrCode,
                    qrCodeLength: data.qrCode ? data.qrCode.length : 0,
                    warning: data.warning,
                  });
                  
                  // Component unmount kontrolü
                  if (!isMountedRef.current) {
                    cleanup();
                    return;
                  }
                  
                  // Eğer session temizlendi uyarısı varsa
                  if (data.warning) {
                    cleanup();
                    if (isMountedRef.current) {
                      setWhatsappConnecting(false);
                      setWhatsappQRCode(null);
                      showToast(data.warning, "info");
                    }
                    return;
                  }
                  
                  if (data.isReady) {
                    // Zaten bağlıysa
                    console.log("✅ Zaten bağlı!");
                    cleanup();
                    if (isMountedRef.current) {
                      setWhatsappConnected(true);
                      setWhatsappConnecting(false);
                      setWhatsappQRCode(null);
                      showToast("Artık bildirimleri WhatsApp'tan alabileceksiniz!", "success");
                    }
                    return;
                  }
                  
                  // İlk QR kod kontrolü - eğer varsa hemen göster
                  if (data.qrCode) {
                    console.log("✅ İlk QR kod alındı! (uzunluk:", data.qrCode.length, ")");
                    console.log("✅ QR kod preview:", data.qrCode.substring(0, 50) + "...");
                    console.log("✅ QR kod base64 başlangıcı:", data.qrCode.startsWith("data:image") ? "Evet" : "Hayır");
                    if (isMountedRef.current) {
                      // QR kodun base64 formatında olduğundan emin ol
                      const qrCodeToSet = data.qrCode.startsWith("data:image") 
                        ? data.qrCode 
                        : `data:image/png;base64,${data.qrCode}`;
                      setWhatsappQRCode(qrCodeToSet);
                      console.log("✅ QR kod state'e set edildi");
                    }
                  } else {
                    console.log("⏳ QR kod henüz hazır değil, polling başlatılıyor... (isInitializing:", data.isInitializing, ")");
                  }
                          
                  // QR kod güncellemelerini dinle (500ms'de bir)
                  let attempts = 0;
                  const maxAttempts = 120; // 60 saniye için (120 * 500ms)
                  
                  checkIntervalRef.current = setInterval(async () => {
                    // Component unmount kontrolü
                    if (!isMountedRef.current) {
                      cleanup();
                      return;
                    }
                    
                    attempts++;
                    try {
                      const statusResponse = await fetch(`/api/whatsapp/connect?coachId=${user.uid}`);
                      
                      if (!statusResponse.ok) {
                        const errorText = await statusResponse.text().catch(() => "");
                        const errorData = await statusResponse.json().catch(() => ({}));
                        console.error(`❌ [${attempts}] Durum kontrolü başarısız:`, statusResponse.status, errorText, errorData);
                        
                        // Eğer serverless hatası varsa, kullanıcıya bildir
                        if (errorData.isServerless || errorData.error?.includes("serverless")) {
                          cleanup();
                          if (isMountedRef.current) {
                            setWhatsappConnecting(false);
                            setWhatsappQRCode(null);
                            showToast("WhatsApp bağlantısı bu ortamda desteklenmemektedir.", "error");
                          }
                          return;
                        }
                        
                        if (attempts > 15) {
                          cleanup();
                          if (isMountedRef.current) {
                            setWhatsappConnecting(false);
                            setWhatsappQRCode(null);
                            showToast("WhatsApp bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin.", "error");
                          }
                          return;
                        }
                        return; // Hata durumunda bir sonraki denemeye devam et
                      }
                      
                      const statusData = await statusResponse.json();
                      
                      // Her 10 denemede bir log (spam önlemek için)
                      if (attempts % 10 === 0 || statusData.qrCode || statusData.isReady) {
                        console.log(`📊 [${attempts}] Durum kontrolü:`, {
                          isReady: statusData.isReady,
                          isInitializing: statusData.isInitializing,
                          hasQRCode: !!statusData.qrCode,
                          qrCodeLength: statusData.qrCode ? statusData.qrCode.length : 0,
                          error: statusData.error || null,
                        });
                      }
                      
                      // Hata mesajı varsa göster
                      if (statusData.error && !statusData.isInitializing) {
                        console.error(`❌ [${attempts}] API hatası:`, statusData.error);
                        if (attempts > 20) {
                          cleanup();
                          if (isMountedRef.current) {
                            setWhatsappConnecting(false);
                            setWhatsappQRCode(null);
                            showToast(statusData.error || "WhatsApp bağlantısı kurulamadı.", "error");
                          }
                          return;
                        }
                      }
                      
                      // Firestore'dan da kontrol et (bağlantı kurulmuş mu?)
                      let firestoreConnected = false;
                      try {
                        const { db } = await import("@/lib/firebase");
                        const { doc, getDoc } = await import("firebase/firestore");
                        const userDoc = await getDoc(doc(db, "users", user.uid));
                        if (userDoc.exists()) {
                          const userData = userDoc.data();
                          firestoreConnected = !!(userData.whatsappConnected && userData.whatsappConnectedAt);
                          if (firestoreConnected) {
                            console.log(`✅ [${attempts}] Firestore'da bağlantı bilgileri kaydedilmiş!`);
                          }
                        }
                      } catch (error) {
                        console.error("Firestore kontrol hatası:", error);
                      }
                      
                      if (statusData.isReady || firestoreConnected) {
                        console.log(`✅ [${attempts}] Bağlantı kuruldu! (isReady: ${statusData.isReady}, Firestore: ${firestoreConnected})`);
                        
                        cleanup();
                        
                        // State'leri güncelle - modal kapanacak
                        if (isMountedRef.current) {
                          setWhatsappConnected(true);
                          setWhatsappConnecting(false);
                          setWhatsappQRCode(null);
                          
                          // UserData'yı yenile (Firestore'daki güncel bilgileri al)
                          try {
                            await refreshUserData();
                          } catch (error) {
                            console.error("UserData yenileme hatası:", error);
                          }
                          
                          showToast("Artık bildirimleri WhatsApp'tan alabileceksiniz!", "success");
                        }
                        return;
                      }
                      
                      if (statusData.qrCode) {
                        // QR kod geldiğinde güncelle (yeni veya güncellenmiş)
                        console.log(`✅ [${attempts}] QR kod alındı! (uzunluk: ${statusData.qrCode.length})`);
                        console.log(`✅ [${attempts}] QR kod preview: ${statusData.qrCode.substring(0, 50)}...`);
                        console.log(`✅ [${attempts}] QR kod base64 başlangıcı: ${statusData.qrCode.startsWith("data:image") ? "Evet" : "Hayır"}`);
                        if (isMountedRef.current) {
                          // QR kodun base64 formatında olduğundan emin ol
                          const qrCodeToSet = statusData.qrCode.startsWith("data:image") 
                            ? statusData.qrCode 
                            : `data:image/png;base64,${statusData.qrCode}`;
                          setWhatsappQRCode(qrCodeToSet);
                          console.log(`✅ [${attempts}] QR kod state'e set edildi`);
                        }
                        // QR kod geldiğinde connecting durumunu koru ama modal açık kalsın
                      } else if (attempts > 10 && attempts % 5 === 0) {
                        // 10 denemeden sonra her 5 denemede bir logla
                        console.warn(`⚠️ [${attempts}] QR kod henüz gelmedi, bekleniyor... (isInitializing: ${statusData.isInitializing})`);
                      }
                      
                      // Eğer başlatma işlemi durduysa ve QR kod yoksa
                      if (!statusData.isInitializing && !statusData.isReady && !statusData.qrCode && attempts > 40) {
                        console.warn(`⚠️ [${attempts}] Başlatma durdu ve QR kod yok`);
                        console.warn(`⚠️ Detaylar:`, {
                          isReady: statusData.isReady,
                          isInitializing: statusData.isInitializing,
                          hasQRCode: !!statusData.qrCode,
                          error: statusData.error,
                        });
                        
                        // Auth failure durumunda hata mesajı göster
                        if (statusData.error && (statusData.error.includes("auth") || statusData.error.includes("session"))) {
                          cleanup();
                          if (isMountedRef.current) {
                            setWhatsappConnecting(false);
                            setWhatsappQRCode(null);
                            showToast("Session hatası tespit edildi. Lütfen sayfayı yenileyip tekrar deneyin.", "error");
                          }
                          return;
                        }
                        
                        // 80 denemeden sonra hala QR kod yoksa, hata mesajı göster
                        if (attempts > 80) {
                          cleanup();
                          if (isMountedRef.current) {
                            setWhatsappConnecting(false);
                            setWhatsappQRCode(null);
                            showToast("QR kod oluşturulamadı. Lütfen sayfayı yenileyip tekrar deneyin.", "error");
                          }
                          return;
                        }
                      }
                      
                      // Timeout kontrolü
                      if (attempts >= maxAttempts) {
                        console.error(`❌ [${attempts}] Timeout: QR kod oluşturulamadı`);
                        cleanup();
                        if (isMountedRef.current) {
                          setWhatsappConnecting(false);
                          setWhatsappQRCode(null);
                          showToast("QR kod oluşturulamadı. Lütfen sayfayı yenileyip tekrar deneyin.", "error");
                        }
                        return;
                      }
                    } catch (error) {
                      console.error(`❌ [${attempts}] Durum kontrolü hatası:`, error);
                      // Hata durumunda da devam et, sadece logla
                      if (attempts > 20) {
                        console.warn("❌ Çok fazla hata, durduruluyor...");
                        cleanup();
                        if (isMountedRef.current) {
                          setWhatsappConnecting(false);
                          setWhatsappQRCode(null);
                          showToast("WhatsApp bağlantısı kurulamadı. Lütfen daha sonra tekrar deneyin.", "error");
                        }
                        return;
                      }
                    }
                  }, 500); // 500ms'de bir kontrol et
                  
                  // 60 saniye sonra timeout (bağlantı kurulamazsa)
                  timeoutIdRef.current = setTimeout(() => {
                    cleanup();
                    if (isMountedRef.current) {
                      setWhatsappConnecting(false);
                      setWhatsappQRCode(null);
                      showToast("QR kod oluşturulamadı. Lütfen sayfayı yenileyip tekrar deneyin veya destek ekibiyle iletişime geçin.", "error");
                    }
                  }, 60000); // 60 saniye (maxAttempts ile uyumlu)
                } catch (error: any) {
                  console.error("WhatsApp bağlantı hatası:", error);
                  cleanup();
                  if (isMountedRef.current) {
                    setWhatsappConnecting(false);
                    setWhatsappQRCode(null);
                    const errorMessage = error?.message || "WhatsApp bağlantısı kurulamadı. Lütfen tekrar deneyin.";
                    showToast(errorMessage, "error");
                  }
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
      {whatsappConnecting && !whatsappConnected && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex justify-end items-center mb-4">
              <button
                onClick={() => {
                  // Cleanup işlemleri
                  if (checkIntervalRef.current) {
                    clearInterval(checkIntervalRef.current);
                    checkIntervalRef.current = null;
                  }
                  if (timeoutIdRef.current) {
                    clearTimeout(timeoutIdRef.current);
                    timeoutIdRef.current = null;
                  }
                  isConnectingRef.current = false;
                  
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
                  <div className="p-4 bg-white rounded-xl border-2 border-gray-200 flex items-center justify-center">
                    <img
                      src={whatsappQRCode}
                      alt="QR Code"
                      className="w-64 h-64 object-contain"
                      onError={(e) => {
                        console.error("QR kod yüklenemedi, QR kod:", whatsappQRCode?.substring(0, 100));
                        console.error("QR kod uzunluğu:", whatsappQRCode?.length);
                        e.currentTarget.style.display = "none";
                      }}
                      onLoad={() => {
                        console.log("✅ QR kod başarıyla yüklendi");
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    QR kodu WhatsApp uygulamanızla tarayın
                  </p>
                  <p className="text-xs text-gray-400 text-center mt-1">
                    WhatsApp → Ayarlar → Bağlı Cihazlar → Cihaz Bağla
                  </p>
                </>
              ) : (
                <>
                  <div className="w-64 h-64 flex items-center justify-center bg-gray-100 rounded-xl border-2 border-gray-200">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-600 font-medium">QR kod hazırlanıyor...</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Lütfen bekleyin, QR kod oluşturuluyor
                  </p>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Bu işlem 10-30 saniye sürebilir
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


