"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import { checkSubscriptionStatus, getTrialDaysLeft, getSubscriptionDaysLeft, canAskQuestion, getDailyQuestionLimit, type SubscriptionPlan } from "@/lib/subscriptionUtils";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import Toast from "@/components/ui/Toast";
import { requestNotificationPermission, getFCMToken, saveFCMTokenToUser, removeFCMTokenFromUser } from "@/lib/fcmUtils";

export default function AyarlarPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading, refresh: refreshUserData } = useUserData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current: "",
    new: "",
    confirm: "",
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    userData?.notificationsEnabled !== false // Default true
  );
  const [notificationTypes, setNotificationTypes] = useState({
    messages: userData?.notificationTypes?.messages !== false, // Default true
    questions: userData?.notificationTypes?.questions !== false, // Default true
    system: userData?.notificationTypes?.system !== false, // Default true
  });
  const [updatingNotifications, setUpdatingNotifications] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const subscriptionStatus = userData
    ? checkSubscriptionStatus(
        userData.trialEndDate || null,
        userData.subscriptionEndDate || null,
        userData.premium,
        userData.createdAt
      )
    : null;
  const trialDaysLeft = userData ? getTrialDaysLeft(userData.trialEndDate || null, userData.createdAt) : 0;
  const subscriptionDaysLeft = userData ? getSubscriptionDaysLeft(userData.subscriptionEndDate || null) : 0;
  
  // Plan'ı subscription status'e göre belirle
  let currentPlan: SubscriptionPlan = userData?.subscriptionPlan || "trial";
  if (subscriptionStatus === "trial") {
    currentPlan = "trial";
  } else if (subscriptionStatus === "active" && userData?.subscriptionPlan) {
    currentPlan = userData.subscriptionPlan;
  }
  
  // Günlük soru bilgisi
  const questionInfo = userData
    ? canAskQuestion(
        currentPlan,
        userData.dailyQuestionCount || 0,
        userData.lastQuestionDate
      )
    : { canAsk: true, remaining: Infinity };
  const dailyLimit = getDailyQuestionLimit(currentPlan);

  // Kullanıcı giriş yapmamışsa login sayfasına yönlendir
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (userData) {
      setName(userData.name || "");
      setNotificationsEnabled(userData.notificationsEnabled !== false);
      setNotificationTypes({
        messages: userData.notificationTypes?.messages !== false,
        questions: userData.notificationTypes?.questions !== false,
        system: userData.notificationTypes?.system !== false,
      });
    }
  }, [userData]);

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      setShowScrollTop(scrollPosition > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Profil resmini yükle
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast("Dosya boyutu 5MB'dan küçük olmalıdır.", "error");
      return;
    }

    // Dosya tipi kontrolü
    if (!file.type.startsWith("image/")) {
      showToast("Lütfen bir resim dosyası seçin.", "error");
      return;
    }

    try {
      setUploadingPhoto(true);

      // API route üzerinden signed upload yap
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/cloudinary/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Yükleme başarısız oldu");
      }

      const data = await response.json();
      
      if (!data.url) {
        throw new Error("Yükleme başarılı ancak URL alınamadı");
      }

      const photoURL = data.url;

      // Firestore'da güncelle
      await updateDoc(doc(db, "users", user.uid), {
        photoURL,
      });

      // Firebase Auth'da güncelle
      await updateProfile(user, {
        photoURL,
      });

      // UserData'yı yenile
      refreshUserData();

      showToast("Profil resmi başarıyla güncellendi!", "success");
    } catch (error: any) {
      console.error("Photo upload error:", error);
      const errorMessage = error?.message || "Profil resmi yüklenirken bir hata oluştu.";
      showToast(errorMessage, "error");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // İsim güncelle
  const handleUpdateName = async () => {
    if (!name.trim() || !user) return;

    try {
      await updateProfile(user, { displayName: name });
      await updateDoc(doc(db, "users", user.uid), {
        name: name.trim(),
      });

      setIsEditing(false);
      refreshUserData();
      showToast("İsim başarıyla güncellendi!", "success");
    } catch (error) {
      console.error("Error updating name:", error);
      showToast("İsim güncellenirken bir hata oluştu.", "error");
    }
  };

  // Bildirim ayarlarını güncelle
  const handleNotificationToggle = async (enabled: boolean) => {
    if (!user) return;

    try {
      setUpdatingNotifications(true);
      
      await updateDoc(doc(db, "users", user.uid), {
        notificationsEnabled: enabled,
      });

      setNotificationsEnabled(enabled);
      
      if (enabled) {
        // Bildirimleri açıyorsa izin iste ve token al
        const token = await requestNotificationPermission();
        if (token) {
          await saveFCMTokenToUser(user.uid, token);
          showToast("Bildirimler açıldı!", "success");
        } else {
          showToast("Bildirim izni verilmedi. Lütfen tarayıcı ayarlarından izin verin.", "error");
        }
      } else {
        // Bildirimleri kapatıyorsa token'ları temizle
        if (userData?.fcmTokens && userData.fcmTokens.length > 0) {
          for (const token of userData.fcmTokens) {
            await removeFCMTokenFromUser(user.uid, token).catch(console.error);
          }
        }
        showToast("Bildirimler kapatıldı!", "success");
      }
      
      refreshUserData();
    } catch (error) {
      console.error("Notification toggle error:", error);
      showToast("Bildirim ayarları güncellenirken bir hata oluştu.", "error");
    } finally {
      setUpdatingNotifications(false);
    }
  };

  // Bildirim tipi ayarlarını güncelle
  const handleNotificationTypeToggle = async (type: keyof typeof notificationTypes, enabled: boolean) => {
    if (!user) return;

    try {
      setUpdatingNotifications(true);
      
      const newTypes = {
        ...notificationTypes,
        [type]: enabled,
      };
      
      await updateDoc(doc(db, "users", user.uid), {
        notificationTypes: newTypes,
      });

      setNotificationTypes(newTypes);
      showToast("Bildirim tercihleri güncellendi!", "success");
      refreshUserData();
    } catch (error) {
      console.error("Notification type toggle error:", error);
      showToast("Bildirim tercihleri güncellenirken bir hata oluştu.", "error");
    } finally {
      setUpdatingNotifications(false);
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

      // Mevcut şifre ile yeniden kimlik doğrulama
      const credential = EmailAuthProvider.credential(user.email, passwordData.current);
      await reauthenticateWithCredential(user, credential);

      // Şifreyi güncelle
      await updatePassword(user, passwordData.new);

      setPasswordData({ current: "", new: "", confirm: "" });
      showToast("Şifre başarıyla değiştirildi!", "success");
    } catch (error: any) {
      console.error("Password change error:", error);
      if (error.code === "auth/wrong-password") {
        showToast("Mevcut şifre yanlış.", "error");
      } else if (error.code === "auth/weak-password") {
        showToast("Şifre çok zayıf. Daha güçlü bir şifre seçin.", "error");
      } else {
        showToast("Şifre değiştirilirken bir hata oluştu.", "error");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (authLoading || userDataLoading || !user || !userData) {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const displayPhoto = userData.photoURL || user.photoURL || null;
  const displayName = userData.name || user.displayName || "Öğrenci";
  
  // Kullanıcının giriş yöntemini kontrol et
  const isGoogleUser = user?.providerData?.some(
    (provider) => provider.providerId === "google.com"
  ) || false;
  const hasPasswordProvider = user?.providerData?.some(
    (provider) => provider.providerId === "password"
  ) || false;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className="flex justify-center items-start px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="w-full max-w-6xl">
          {/* Header - Premium */}
          <div className="mb-8 animate-slideFade">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Ayarlar</h1>
            <p className="text-gray-600">Hesap bilgilerinizi ve tercihlerinizi yönetin</p>
          </div>

          {/* PROFİL BİLGİLERİ CARD - Premium */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6 relative overflow-hidden animate-slideFade">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-200/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Profil Bilgileri</h2>
              </div>

              <div className="space-y-6">
                {/* Profil Resmi */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    {displayPhoto ? (
                      <div className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-white shadow-lg">
                        <Image
                          src={displayPhoto}
                          alt="Profil"
                          width={96}
                          height={96}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg ring-4 ring-white">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="px-6 py-3 rounded-xl text-gray-900 font-semibold text-sm
                               bg-white/80 backdrop-blur-xl border border-white/60 
                               shadow-sm hover:shadow-md transition
                               disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
                    >
                      {uploadingPhoto ? "Yükleniyor..." : "Resim Değiştir"}
                    </button>
                  </div>
                </div>

                {/* İsim */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">İsim</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm hover:shadow-md"
                      />
                      <button
                        onClick={handleUpdateName}
                        className="px-6 py-3 rounded-xl text-white font-semibold text-sm
                                 bg-gradient-to-r from-blue-500 to-indigo-600
                                 shadow-lg hover:shadow-xl transition active:scale-[0.98]"
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setName(userData.name || "");
                        }}
                        className="px-6 py-3 rounded-xl text-gray-700 font-semibold text-sm
                                 bg-white/80 backdrop-blur-xl border border-white/60
                                 shadow-sm hover:shadow-md transition active:scale-[0.98]"
                      >
                        İptal
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white/60 backdrop-blur-xl p-4 rounded-xl border border-white/40">
                      <span className="text-gray-900 font-medium">{displayName}</span>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-blue-600 font-semibold text-sm hover:text-blue-700 transition"
                      >
                        Düzenle
                      </button>
                    </div>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                  <div className="bg-white/60 backdrop-blur-xl p-4 rounded-xl border border-white/40">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900 font-medium">{userData.email}</span>
                      {userData.emailVerified ? (
                        <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">
                          Doğrulanmış
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold">
                          Doğrulanmamış
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ABONELİK DETAYLARI CARD - Premium */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6 relative overflow-hidden animate-slideFade">
            <div className={`absolute -top-20 -right-20 w-40 h-40 ${currentPlan === "premium" ? "bg-yellow-200/20" : "bg-indigo-200/20"} rounded-full blur-3xl`}></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 bg-gradient-to-br ${currentPlan === "premium" ? "from-yellow-500 to-orange-600" : "from-indigo-500 to-purple-600"} rounded-2xl flex items-center justify-center shadow-lg`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Abonelik Detayları</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-xl rounded-2xl p-6 shadow-[0_5px_20px_rgba(0,0,0,0.08)] border border-white/50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1 font-medium">Mevcut Plan</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {currentPlan === "trial" ? (
                          <span className="text-blue-600">🆓 Trial Plan</span>
                        ) : currentPlan === "lite" ? (
                          <span className="text-blue-600">📚 Lite Plan</span>
                        ) : (
                          <span className="text-yellow-600">⭐ Premium Plan</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {subscriptionStatus === "trial" && trialDaysLeft > 0 && (
                    <div className="bg-white/80 rounded-xl p-4 mb-4">
                      <p className="text-sm text-gray-600 mb-1 font-medium">Kalan Trial Süresi</p>
                      <p className="text-xl font-bold text-gray-900">{trialDaysLeft} gün</p>
                    </div>
                  )}

                  {subscriptionStatus === "active" && subscriptionDaysLeft > 0 && (
                    <div className="bg-white/80 rounded-xl p-4 mb-4">
                      <p className="text-sm text-gray-600 mb-1 font-medium">Kalan Abonelik Süresi</p>
                      <p className="text-xl font-bold text-gray-900">{subscriptionDaysLeft} gün</p>
                    </div>
                  )}

                  {currentPlan !== "premium" && (
                    <div className="bg-white/80 rounded-xl p-4">
                      <p className="text-sm text-gray-600 mb-1 font-medium">Bugün Kalan Soru Hakkı</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${questionInfo.remaining > 0 ? "text-green-600" : "text-red-600"}`}>
                          {questionInfo.remaining}
                        </span>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-700 font-semibold">{dailyLimit} soru</span>
                      </div>
                    </div>
                  )}

                  {currentPlan === "premium" && (
                    <div className="bg-white/80 rounded-xl p-4">
                      <p className="text-sm text-gray-600 mb-1 font-medium">Günlük Soru Limiti</p>
                      <p className="text-xl font-bold text-green-600">Sınırsız</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => router.push("/premium")}
                  className={`w-full py-4 rounded-xl text-white font-bold text-lg
                           ${
                             currentPlan === "premium"
                               ? "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"
                               : "bg-gradient-to-r from-blue-500 to-indigo-600"
                           }
                           shadow-lg hover:shadow-xl transition active:scale-[0.98]`}
                >
                  {subscriptionStatus === "active" ? "Aboneliği Yönet" : "Plan Seç"}
                </button>
              </div>
            </div>
          </div>

          {/* BİLDİRİM AYARLARI CARD - Premium */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6 relative overflow-hidden animate-slideFade">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-200/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Bildirim Ayarları</h2>
              </div>

              <div className="space-y-4">
                {/* Genel Bildirim Aç/Kapat */}
                <div className="flex items-center justify-between bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-xl rounded-2xl p-6 shadow-[0_5px_20px_rgba(0,0,0,0.08)] border border-white/50">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 mb-1 text-lg">Bildirimler</p>
                    <p className="text-sm text-gray-600 font-medium">Tüm bildirimleri aç/kapat</p>
                  </div>
                  <button
                    onClick={() => handleNotificationToggle(!notificationsEnabled)}
                    disabled={updatingNotifications}
                    className={`relative w-16 h-9 rounded-full transition-colors duration-300 ${
                      notificationsEnabled ? "bg-gradient-to-r from-purple-500 to-pink-600" : "bg-gray-300"
                    } ${updatingNotifications ? "opacity-50 cursor-not-allowed" : ""} shadow-lg`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-7 h-7 bg-white rounded-full shadow-md transition-transform duration-300 ${
                        notificationsEnabled ? "translate-x-7" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Bildirim Tipleri - Sadece bildirimler açıksa göster */}
                {notificationsEnabled && (
                  <div className="space-y-3 pt-4 border-t border-white/50">
                    <p className="text-sm font-bold text-gray-700 mb-4">Bildirim Tercihleri</p>
                    
                    <div className="flex items-center justify-between bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-xl rounded-2xl p-5 shadow-[0_5px_20px_rgba(0,0,0,0.08)] border border-white/50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Mesaj Bildirimleri</p>
                          <p className="text-sm text-gray-600 font-medium">Koçunuzdan gelen mesajlar</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleNotificationTypeToggle("messages", !notificationTypes.messages)}
                        disabled={updatingNotifications}
                        className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                          notificationTypes.messages ? "bg-gradient-to-r from-blue-500 to-indigo-600" : "bg-gray-300"
                        } ${updatingNotifications ? "opacity-50 cursor-not-allowed" : ""} shadow-md`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                            notificationTypes.messages ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-2xl p-5 shadow-[0_5px_20px_rgba(0,0,0,0.08)] border border-white/50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Soru Bildirimleri</p>
                          <p className="text-sm text-gray-600 font-medium">Sorularınızın çözümü hazır olduğunda</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleNotificationTypeToggle("questions", !notificationTypes.questions)}
                        disabled={updatingNotifications}
                        className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                          notificationTypes.questions ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-gray-300"
                        } ${updatingNotifications ? "opacity-50 cursor-not-allowed" : ""} shadow-md`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                            notificationTypes.questions ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-gradient-to-br from-orange-50 to-amber-50 backdrop-blur-xl rounded-2xl p-5 shadow-[0_5px_20px_rgba(0,0,0,0.08)] border border-white/50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Sistem Bildirimleri</p>
                          <p className="text-sm text-gray-600 font-medium">Güncellemeler ve önemli duyurular</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleNotificationTypeToggle("system", !notificationTypes.system)}
                        disabled={updatingNotifications}
                        className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                          notificationTypes.system ? "bg-gradient-to-r from-orange-500 to-amber-600" : "bg-gray-300"
                        } ${updatingNotifications ? "opacity-50 cursor-not-allowed" : ""} shadow-md`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                            notificationTypes.system ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ŞİFRE DEĞİŞTİR CARD - Premium - Sadece email/password ile giriş yapan kullanıcılar için */}
          {hasPasswordProvider && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6 relative overflow-hidden animate-slideFade">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-200/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Şifre Değiştir</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Mevcut Şifre</label>
                    <input
                      type="password"
                      value={passwordData.current}
                      onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                      className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm hover:shadow-md"
                      placeholder="Mevcut şifrenizi girin"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Yeni Şifre</label>
                    <input
                      type="password"
                      value={passwordData.new}
                      onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                      className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm hover:shadow-md"
                      placeholder="Yeni şifrenizi girin"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Yeni Şifre (Tekrar)</label>
                    <input
                      type="password"
                      value={passwordData.confirm}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                      className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm hover:shadow-md"
                      placeholder="Yeni şifrenizi tekrar girin"
                    />
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-lg"
                  >
                    {changingPassword ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GOOGLE KULLANICI BİLGİSİ CARD - Premium - Sadece Google ile giriş yapan kullanıcılar için */}
          {isGoogleUser && !hasPasswordProvider && (
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6 relative overflow-hidden animate-slideFade">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-200/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Hesap Bilgisi</h2>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-xl rounded-2xl p-6 shadow-[0_5px_20px_rgba(0,0,0,0.08)] border border-white/50">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium mb-1">Giriş Yöntemi</p>
                      <p className="text-gray-900 font-bold text-lg">Google Hesabı</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed font-medium">
                    Google hesabınızla giriş yaptınız. Şifre değiştirmek için Google hesabınızın şifresini değiştirmeniz gerekir.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-[0_10px_30px_rgba(59,130,246,0.4)] flex items-center justify-center transition-all duration-300 ${
          showScrollTop
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-90 pointer-events-none"
        } active:scale-95 hover:shadow-[0_15px_40px_rgba(59,130,246,0.5)]`}
        aria-label="Yukarı git"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>

      {/* Toast Message */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
