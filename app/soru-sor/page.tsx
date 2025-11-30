"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { doc, collection, addDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import StudentFooter from "@/components/StudentFooter";
import Toast from "@/components/ui/Toast";
import { canAskQuestion, getDailyQuestionLimit, type SubscriptionPlan } from "@/lib/subscriptionUtils";
import { checkSubscriptionStatus } from "@/lib/subscriptionUtils";
import { shouldRedirectToPremium } from "@/lib/subscriptionGuard";

export default function SoruSorPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading, refresh: refreshUserData } = useUserData();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detectingSubject, setDetectingSubject] = useState(false);
  const [detectedSubject, setDetectedSubject] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  // Subscription kontrolü
  const subscriptionStatus = userData
    ? checkSubscriptionStatus(
        userData.trialEndDate || null,
        userData.subscriptionEndDate || null,
        userData.premium,
        userData.createdAt
      )
    : null;

  let currentPlan: SubscriptionPlan = userData?.subscriptionPlan || "trial";
  if (subscriptionStatus === "trial") {
    currentPlan = "trial";
  } else if (subscriptionStatus === "active" && userData?.subscriptionPlan) {
    currentPlan = userData.subscriptionPlan;
  }

  const questionInfo = userData
    ? canAskQuestion(
        currentPlan,
        userData.dailyQuestionCount || 0,
        userData.lastQuestionDate
      )
    : { canAsk: true, remaining: Infinity };
  const dailyLimit = getDailyQuestionLimit(currentPlan);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/landing");
    }
  }, [user, authLoading, router]);

  // Abonelik süresi dolmuşsa premium sayfasına yönlendir
  useEffect(() => {
    if (!authLoading && !userDataLoading && user && userData && userData.role === "student") {
      if (shouldRedirectToPremium(userData)) {
        router.replace("/premium");
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  // Soru sorma limiti kontrolü - sadece bir kez göster
  const hasShownLimitToast = useRef(false);
  useEffect(() => {
    if (userData && !questionInfo.canAsk && !hasShownLimitToast.current) {
      hasShownLimitToast.current = true;
      setToast({
        message: `Günlük soru limitiniz doldu. Bugün ${dailyLimit === Infinity ? "sınırsız" : dailyLimit} soru sorma hakkınız var.`,
        type: "info",
        isVisible: true,
      });
    } else if (userData && questionInfo.canAsk) {
      // Limit yoksa flag'i sıfırla
      hasShownLimitToast.current = false;
    }
  }, [userData, questionInfo.canAsk, dailyLimit]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // Dosya seçme
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        showToast("Lütfen bir resim dosyası seçin.", "error");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("Dosya boyutu 5MB'dan küçük olmalıdır.", "error");
        return;
      }
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setCapturedImage(null);
    }
  };

  // Kamerayı aç
  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Kamera hatası:", error);
      showToast("Kameraya erişim izni verilmedi.", "error");
    }
  };

  // Kamerayı kapat
  const handleCloseCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
    setCapturedImage(null);
  };

  // Fotoğraf çek
  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "captured-image.jpg", { type: "image/jpeg" });
            setSelectedImage(file);
            setPreviewUrl(URL.createObjectURL(blob));
            setCapturedImage(URL.createObjectURL(blob));
            handleCloseCamera();
          }
        }, "image/jpeg");
      }
    }
  };

  // Ders tespit et (AI)
  const detectSubject = async (imageUrl: string): Promise<string> => {
    try {
      setDetectingSubject(true);
      const response = await fetch("/api/ai/detect-subject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error("Ders tespit edilemedi");
      }

      const data = await response.json();
      return data.subject || "Bilinmeyen";
    } catch (error) {
      console.error("Ders tespit hatası:", error);
      return "Bilinmeyen";
    } finally {
      setDetectingSubject(false);
    }
  };

  // Soruyu yükle
  const handleUpload = async () => {
    if (!user || !userData) {
      showToast("Lütfen giriş yapın.", "error");
      return;
    }

    if (!selectedImage) {
      showToast("Lütfen bir soru resmi seçin veya çekin.", "error");
      return;
    }

    if (!questionInfo.canAsk) {
      showToast(
        `Günlük soru limitiniz doldu. Bugün ${dailyLimit === Infinity ? "sınırsız" : dailyLimit} soru sorma hakkınız var.`,
        "error"
      );
      return;
    }

    try {
      setUploading(true);

      // Cloudinary'ye yükle
      const formData = new FormData();
      formData.append("file", selectedImage);

      const uploadResponse = await fetch("/api/cloudinary/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Resim yükleme başarısız");
      }

      const uploadData = await uploadResponse.json();
      const imageUrl = uploadData.url;

      // AI ile ders tespit et
      const subject = await detectSubject(imageUrl);
      setDetectedSubject(subject);

      // Firestore'a kaydet
      const questionsRef = collection(db, "users", user.uid, "sorular");
      const questionDoc = await addDoc(questionsRef, {
        soruImgUrl: imageUrl,
        ders: subject,
        createdAt: Timestamp.now(),
        status: "pending", // pending, answered, solved
        solution: null, // Çözüm adımları
        solving: true, // Çözüm işlemi başladı
      });

      // AI ile soruyu çöz (arka planda)
      try {
        const solveResponse = await fetch("/api/ai/solve-question", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrl, ders: subject }),
        });

        if (solveResponse.ok) {
          const solutionData = await solveResponse.json();
          
          // Çözümü Firestore'a kaydet
          const questionDocRef = doc(db, "users", user.uid, "sorular", questionDoc.id);
          await updateDoc(questionDocRef, {
            solution: solutionData,
            status: "answered", // Çözüm hazır
            solving: false,
          });
        } else {
          // Çözüm başarısız oldu, sadece durumu güncelle
          const questionDocRef = doc(db, "users", user.uid, "sorular", questionDoc.id);
          await updateDoc(questionDocRef, {
            solving: false,
          });
        }
      } catch (solveError: any) {
        console.error("Çözüm hatası:", solveError);
        // Hata olsa bile soru kaydedildi, sadece solving durumunu güncelle
        const questionDocRef = doc(db, "users", user.uid, "sorular", questionDoc.id);
        await updateDoc(questionDocRef, {
          solving: false,
        });
        // Hata mesajını logla ama kullanıcıya gösterme (arka planda çalışıyor)
        console.warn("⚠️ Soru çözme arka planda başarısız oldu, soru kaydedildi:", solveError.message);
      }

      // Günlük soru sayısını güncelle
      const today = new Date().toISOString().split("T")[0];
      const userRef = doc(db, "users", user.uid);
      const newDailyCount = userData.lastQuestionDate === today 
        ? (userData.dailyQuestionCount || 0) + 1 
        : 1;

      await updateDoc(userRef, {
        dailyQuestionCount: newDailyCount,
        lastQuestionDate: today,
      });

      // Veriyi yenile
      await refreshUserData();

      showToast("Soru başarıyla yüklendi!", "success");

      // Formu temizle
      setSelectedImage(null);
      setPreviewUrl(null);
      setCapturedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Sorularım sayfasına yönlendir
      setTimeout(() => {
        router.push("/sorularim");
      }, 1500);
    } catch (error: any) {
      console.error("Yükleme hatası:", error);
      showToast(error.message || "Soru yüklenirken bir hata oluştu.", "error");
    } finally {
      setUploading(false);
      setDetectingSubject(false);
    }
  };

  if (authLoading || userDataLoading || !user) {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] flex flex-col">
      <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <div className="flex-1 flex justify-center items-start px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8 animate-slideFade">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Soru Sor</h1>
            <p className="text-gray-600">
              Sorunuzu yükleyin, yapay zeka otomatik olarak dersini tespit edecek
            </p>
            {questionInfo.remaining !== Infinity && (
              <p className="text-sm text-gray-500 mt-2">
                Bugün kalan: <span className="font-bold text-blue-600">{questionInfo.remaining}</span> / {dailyLimit} soru
              </p>
            )}
          </div>

          {/* Upload Area */}
          <div className="bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-xl rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 relative overflow-hidden animate-slideFade mb-6">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>

            <div className="relative z-10">
              {!previewUrl ? (
                <div className="space-y-4">
                  {/* Dosya Seç */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-6 rounded-2xl border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all bg-blue-50/50 hover:bg-blue-50"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <div className="text-center">
                          <p className="text-gray-700 font-semibold">Dosya Seç</p>
                          <p className="text-sm text-gray-500 mt-1">Göz at veya sürükle-bırak</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Veya */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-gray-300"></div>
                    <span className="text-gray-500 text-sm">veya</span>
                    <div className="flex-1 h-px bg-gray-300"></div>
                  </div>

                  {/* Kameradan Çek */}
                  <button
                    onClick={handleOpenCamera}
                    className="w-full py-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold hover:shadow-lg transition-all"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Kameradan Çek</span>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Preview */}
                  <div className="relative rounded-2xl overflow-hidden border-2 border-blue-200">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Soru önizleme"
                        className="w-full h-auto"
                      />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedImage(null);
                        setPreviewUrl(null);
                        setCapturedImage(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
                    >
                      Değiştir
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploading || detectingSubject || !questionInfo.canAsk}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading || detectingSubject
                        ? detectingSubject
                          ? "Ders tespit ediliyor..."
                          : "Yükleniyor..."
                        : "Soruyu Yükle"}
                    </button>
                  </div>

                  {detectedSubject && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-sm text-gray-600">
                        Tespit edilen ders: <span className="font-bold text-blue-600">{detectedSubject}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Camera Modal */}
          {showCamera && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 max-w-md w-full">
                <div className="relative mb-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-2xl"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCloseCamera}
                    className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleCapture}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold hover:shadow-lg transition"
                  >
                    Fotoğraf Çek
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Message */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
      
      <div className="mt-auto">
        <StudentFooter />
      </div>
    </div>
  );
}

