"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface PopupMesaj {
  enabled: boolean;
  title: string;
  message: string;
  buttonText: string;
  buttonColor: string;
  showOnce: boolean; // Kullanıcı kapatınca bir daha gösterme
  imageUrl?: string; // Popup'ta gösterilecek resim URL'i
}

export default function AdminPopupMesajPage() {
  const [popup, setPopup] = useState<PopupMesaj>({
    enabled: false,
    title: "",
    message: "",
    buttonText: "",
    buttonColor: "green",
    showOnce: true,
    imageUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
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
    fetchPopup();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const fetchPopup = async () => {
    try {
      setLoading(true);
      const popupRef = doc(db, "adminSettings", "popupMessage");
      const snapshot = await getDoc(popupRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as PopupMesaj;
        setPopup({
          ...data,
          // Eğer Firestore'da boş değerler varsa, boş string olarak ayarla
          title: data.title || "",
          message: data.message || "",
          buttonText: data.buttonText || "",
        });
      } else {
        // Eğer hiç kayıt yoksa, tamamen boş başlat
        setPopup({
          enabled: false,
          title: "",
          message: "",
          buttonText: "",
          buttonColor: "green",
          showOnce: true,
          imageUrl: "",
        });
      }
    } catch (error) {
      console.error("Popup mesaj yüklenirken hata:", error);
      showToast("Popup mesaj yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // En az bir içerik olmalı (başlık, mesaj veya resim)
    if (!popup.title.trim() && !popup.message.trim() && !popup.imageUrl) {
      showToast("En az bir içerik eklemelisiniz (başlık, mesaj veya resim).", "error");
      return;
    }

    try {
      setSaving(true);
      const popupRef = doc(db, "adminSettings", "popupMessage");
      await setDoc(popupRef, {
        ...popup,
        updatedAt: new Date(),
      });

      showToast("Popup mesaj başarıyla kaydedildi!", "success");
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      showToast("Kaydetme başarısız!", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header - iOS Style */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">Popup Mesaj Yönetimi</h1>
        <p className="text-lg text-gray-500 font-medium">Öğrencilere gösterilecek popup mesajı yönetin</p>
      </div>

      {/* Settings Card - iOS Premium Style */}
      <div className="bg-gradient-to-br from-white via-white to-gray-50/50 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-gray-100/80 relative overflow-hidden mb-6">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-gradient-to-br from-blue-400/10 via-purple-400/10 to-pink-400/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-gradient-to-br from-green-400/10 via-emerald-400/10 to-teal-400/10 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          {/* Enable/Disable - iOS Toggle Style */}
          <div className="mb-8 bg-gray-50/50 rounded-3xl p-6 border border-gray-100/50">
            <label className="flex items-center justify-between cursor-pointer group">
              <div>
                <span className="text-xl font-bold text-gray-900 block mb-1">Popup Mesajı Aktif Et</span>
                <p className="text-sm text-gray-500 font-medium">
                  Aktif edildiğinde öğrenciler siteye giriş yaptığında bu mesajı görecek
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={popup.enabled}
                  onChange={(e) => setPopup({ ...popup, enabled: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-14 h-8 rounded-full transition-all duration-300 ${
                  popup.enabled ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-gray-300"
                }`}>
                  <div className={`w-7 h-7 bg-white rounded-full shadow-lg transform transition-transform duration-300 mt-0.5 ${
                    popup.enabled ? "translate-x-6" : "translate-x-0.5"
                  }`}></div>
                </div>
              </div>
            </label>
          </div>

          {/* Title - iOS Style */}
          <div className="mb-6 bg-gray-50/50 rounded-3xl p-5 border border-gray-100/50">
            <label className="block text-base font-bold text-gray-900 mb-3">
              Başlık <span className="text-gray-400 text-sm font-normal">(Opsiyonel)</span>
            </label>
            <input
              type="text"
              value={popup.title}
              onChange={(e) => setPopup({ ...popup, title: e.target.value })}
              className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200/80 bg-white/90 backdrop-blur-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all text-base font-medium"
              placeholder=""
            />
          </div>

          {/* Message - iOS Style */}
          <div className="mb-6 bg-gray-50/50 rounded-3xl p-5 border border-gray-100/50">
            <label className="block text-base font-bold text-gray-900 mb-3">
              Mesaj <span className="text-gray-400 text-sm font-normal">(Opsiyonel)</span>
            </label>
            <textarea
              value={popup.message}
              onChange={(e) => setPopup({ ...popup, message: e.target.value })}
              rows={6}
              className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200/80 bg-white/90 backdrop-blur-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all resize-none text-base font-medium"
              placeholder=""
            />
            <p className="text-sm text-gray-500 mt-2 font-medium">
              Satır atlamak için Enter tuşunu kullanabilirsiniz
            </p>
          </div>

          {/* Button Text - iOS Style */}
          <div className="mb-6 bg-gray-50/50 rounded-3xl p-5 border border-gray-100/50">
            <label className="block text-base font-bold text-gray-900 mb-3">
              Buton Metni <span className="text-gray-400 text-sm font-normal">(Opsiyonel)</span>
            </label>
            <input
              type="text"
              value={popup.buttonText}
              onChange={(e) => setPopup({ ...popup, buttonText: e.target.value })}
              className="w-full px-5 py-4 rounded-2xl border-2 border-gray-200/80 bg-white/90 backdrop-blur-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all text-base font-medium"
              placeholder=""
            />
          </div>

          {/* Button Color - iOS Style */}
          <div className="mb-6 bg-gray-50/50 rounded-3xl p-5 border border-gray-100/50">
            <label className="block text-base font-bold text-gray-900 mb-4">
              Buton Rengi
            </label>
            <div className="flex gap-3 flex-wrap">
              {[
                { value: "green", label: "Yeşil", gradient: "from-green-500 to-emerald-600" },
                { value: "blue", label: "Mavi", gradient: "from-blue-500 to-indigo-600" },
                { value: "red", label: "Kırmızı", gradient: "from-red-500 to-rose-600" },
                { value: "purple", label: "Mor", gradient: "from-purple-500 to-violet-600" },
              ].map((color) => (
                <button
                  key={color.value}
                  onClick={() => setPopup({ ...popup, buttonColor: color.value })}
                  className={`px-6 py-3 rounded-2xl font-bold text-base transition-all transform active:scale-95 ${
                    popup.buttonColor === color.value
                      ? `bg-gradient-to-r ${color.gradient} text-white shadow-lg shadow-${color.value}-500/30`
                      : "bg-white/80 text-gray-700 hover:bg-white border-2 border-gray-200/80"
                  }`}
                >
                  {color.label}
                </button>
              ))}
            </div>
          </div>

          {/* Image Upload - iOS Style */}
          <div className="mb-6 bg-gray-50/50 rounded-3xl p-5 border border-gray-100/50">
            <label className="block text-base font-bold text-gray-900 mb-4">
              Resim (Opsiyonel)
            </label>
            {popup.imageUrl && (
              <div className="mb-4 relative w-full max-w-md">
                <img
                  src={popup.imageUrl}
                  alt="Popup resmi"
                  className="w-full h-56 object-cover rounded-2xl border-2 border-gray-200/80 shadow-lg"
                />
                <button
                  onClick={() => setPopup({ ...popup, imageUrl: "" })}
                  className="absolute top-3 right-3 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if (file.size > 5 * 1024 * 1024) {
                    showToast("Dosya boyutu 5MB'dan küçük olmalıdır", "error");
                    return;
                  }

                  if (!file.type.startsWith("image/")) {
                    showToast("Lütfen bir resim dosyası seçin", "error");
                    return;
                  }

                  try {
                    setUploadingImage(true);
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
                    setPopup({ ...popup, imageUrl: data.url });
                    showToast("Resim başarıyla yüklendi!", "success");
                  } catch (error: any) {
                    console.error("Resim yükleme hatası:", error);
                    showToast(error.message || "Resim yüklenirken bir hata oluştu", "error");
                  } finally {
                    setUploadingImage(false);
                  }
                }}
                className="hidden"
                disabled={uploadingImage}
              />
              <div className="cursor-pointer">
                <div className="bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm rounded-2xl p-8 border-2 border-purple-200/50 hover:border-purple-300/80 hover:shadow-lg transition-all text-center transform active:scale-[0.98]">
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-base font-medium text-gray-700">Yükleniyor...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-5xl">🖼️</span>
                      <p className="text-base font-bold text-gray-900">Resim Yükle</p>
                      <p className="text-sm text-gray-500 font-medium">PNG, JPG (Max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>
            </label>
            <p className="text-sm text-gray-500 mt-3 font-medium">
              Bayram mesajları, önemli duyurular için resim ekleyebilirsiniz
            </p>
          </div>

          {/* Show Once */}
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={popup.showOnce}
                onChange={(e) => setPopup({ ...popup, showOnce: e.target.checked })}
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
              <div>
                <span className="text-sm font-semibold text-gray-900">Sadece Bir Kez Göster</span>
                <p className="text-xs text-gray-500 mt-1">
                  Aktif edildiğinde kullanıcı popup'ı kapattıktan sonra bir daha gösterilmez
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button
              onClick={handlePreview}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              Önizleme
            </button>
          </div>
        </div>
      </div>

      {/* Info Card - iOS Style */}
      <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/70 to-purple-50/90 backdrop-blur-xl rounded-[2.5rem] p-6 border border-blue-100/50 shadow-[0_10px_30px_rgba(59,130,246,0.1)]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-gray-900 mb-3 text-lg">Bilgi</h4>
            <ul className="text-sm text-gray-700 space-y-2 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Popup mesajı sadece öğrenci rolündeki kullanıcılara gösterilir</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Mesaj öğrenci ana sayfasına giriş yaptığında gösterilir</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Başlık, mesaj ve buton alanları opsiyoneldir. En az bir içerik (başlık, mesaj veya resim) eklemelisiniz</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Sadece resim ekleyerek de popup oluşturabilirsiniz</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>"Sadece Bir Kez Göster" aktifse, kullanıcı kapatınca localStorage'da saklanır</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>Popup'ı kapatmak için X butonuna tıklanabilir veya buton ile kapatılabilir</span>
              </li>
            </ul>
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

      {/* Preview Popup - iOS Style */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-gradient-to-br from-white via-white to-gray-50/50 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.25)] p-8 max-w-md w-full border border-gray-100/80 animate-slideUp">
            <div className="flex justify-between items-center mb-6">
              {popup.title ? (
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{popup.title}</h3>
              ) : (
                <div></div>
              )}
              <button
                onClick={closePreview}
                className="w-10 h-10 rounded-full bg-gray-100/80 hover:bg-gray-200/80 flex items-center justify-center transition transform active:scale-95"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {popup.imageUrl && (
              <div className="mb-6 rounded-2xl overflow-hidden shadow-lg">
                <img
                  src={popup.imageUrl}
                  alt="Popup resmi"
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
            {popup.message && (
              <p className="text-gray-700 mb-8 whitespace-pre-wrap text-base leading-relaxed font-medium">{popup.message}</p>
            )}
            {popup.buttonText ? (
              <button
                onClick={closePreview}
                className={`w-full px-6 py-4 bg-gradient-to-r ${
                  popup.buttonColor === "green" ? "from-green-500 to-emerald-600 shadow-[0_10px_30px_rgba(34,197,94,0.4)]" :
                  popup.buttonColor === "blue" ? "from-blue-500 to-indigo-600 shadow-[0_10px_30px_rgba(59,130,246,0.4)]" :
                  popup.buttonColor === "red" ? "from-red-500 to-rose-600 shadow-[0_10px_30px_rgba(239,68,68,0.4)]" :
                  "from-purple-500 to-violet-600 shadow-[0_10px_30px_rgba(168,85,247,0.4)]"
                } text-white rounded-2xl font-bold text-lg hover:shadow-xl transition-all transform active:scale-[0.98]`}
              >
                {popup.buttonText}
              </button>
            ) : (
              <button
                onClick={closePreview}
                className="w-full px-6 py-4 bg-gray-100/80 text-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-200/80 transition-all transform active:scale-[0.98]"
              >
                Kapat
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

