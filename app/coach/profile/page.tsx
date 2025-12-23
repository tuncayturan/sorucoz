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
    } catch (error: any) {      showToast(error?.message || "Profil resmi yüklenirken bir hata oluştu.", "error");
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
    } catch (error: any) {      showToast("Profil güncellenirken bir hata oluştu.", "error");
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
    } catch (error: any) {      if (error.code === "auth/wrong-password") {
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
    </div>
  );
}


