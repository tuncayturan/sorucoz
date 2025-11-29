"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import HomeHeader from "@/components/HomeHeader";
import Image from "next/image";
import Toast from "@/components/ui/Toast";

interface Soru {
  id: string;
  soruImgUrl: string;
  ders: string;
  createdAt: Timestamp;
  status: "pending" | "answered" | "solved";
  solution?: {
    steps: Array<{ step: number; explanation: string; calculation?: string }>;
    finalAnswer: string;
  } | null;
  solving?: boolean;
}

const SUBJECT_COLORS: { [key: string]: string } = {
  "Matematik": "from-blue-500 to-indigo-600",
  "Fizik": "from-purple-500 to-pink-600",
  "Kimya": "from-green-500 to-emerald-600",
  "Biyoloji": "from-red-500 to-rose-600",
  "Türkçe": "from-yellow-500 to-orange-600",
  "Tarih": "from-amber-500 to-yellow-600",
  "Coğrafya": "from-teal-500 to-cyan-600",
  "Felsefe": "from-indigo-500 to-purple-600",
  "Bilinmeyen": "from-gray-500 to-gray-600",
};

const SUBJECT_ICONS: { [key: string]: string } = {
  "Matematik": "🔢",
  "Fizik": "⚛️",
  "Kimya": "🧪",
  "Biyoloji": "🔬",
  "Türkçe": "📝",
  "Tarih": "📜",
  "Coğrafya": "🌍",
  "Felsefe": "💭",
  "Bilinmeyen": "❓",
};

export default function SoruDetayPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const [soru, setSoru] = useState<Soru | null>(null);
  const [loading, setLoading] = useState(true);
  const [solving, setSolving] = useState(false);
  const [quotaError, setQuotaError] = useState(false);

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

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && params.id) {
      fetchSoru();
    }
  }, [user, params.id]);

  const fetchSoru = async () => {
    if (!user || !params.id) return;

    try {
      setLoading(true);
      const soruRef = doc(db, "users", user.uid, "sorular", params.id as string);
      const soruSnap = await getDoc(soruRef);

      if (soruSnap.exists()) {
        setSoru({
          id: soruSnap.id,
          ...soruSnap.data(),
        } as Soru);
      } else {
        showToast("Soru bulunamadı", "error");
        router.push("/sorularim");
      }
    } catch (error) {
      console.error("Soru yüklenirken hata:", error);
      showToast("Soru yüklenirken bir hata oluştu", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSolve = async () => {
    if (!user || !soru) return;

    try {
      setSolving(true);
      const response = await fetch("/api/ai/solve-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: soru.soruImgUrl, ders: soru.ders }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Bilinmeyen hata" }));
        const errorMessage = errorData.error || "Soruyu çözerken bir hata oluştu";
        
        // Rate limit hatası (429)
        if (response.status === 429 || errorData.code === "RATE_LIMIT_EXCEEDED") {
          setQuotaError(true);
          throw new Error("Gemini API rate limit aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin. (Dakikada 15 istek limiti)");
        }
        
        // Quota hatası için özel mesaj
        if (errorData.code === "QUOTA_EXCEEDED" || errorMessage.toLowerCase().includes("quota")) {
          setQuotaError(true);
          throw new Error("Gemini API günlük kullanım limiti doldu. Lütfen ertesi gün tekrar deneyin. (Günde 60 istek limiti)");
        }
        
        throw new Error(errorMessage);
      }

      const solutionData = await response.json();
      
      // Solution data kontrolü
      if (!solutionData.steps || !Array.isArray(solutionData.steps)) {
        throw new Error("Çözüm verisi geçersiz format");
      }

      // Firestore'a kaydet
      const soruRef = doc(db, "users", user.uid, "sorular", soru.id);
      await updateDoc(soruRef, {
        solution: solutionData,
        status: "answered",
        solving: false,
      });

      // Local state'i güncelle
      setSoru({
        ...soru,
        solution: solutionData,
        status: "answered",
        solving: false,
      });

      showToast("Soru başarıyla çözüldü!", "success");
    } catch (error: any) {
      console.error("Çözüm hatası:", error);
      showToast(error.message || "Soruyu çözerken bir hata oluştu", "error");
    } finally {
      setSolving(false);
    }
  };

  const handleMarkAsSolved = async () => {
    if (!user || !soru) return;

    try {
      const soruRef = doc(db, "users", user.uid, "sorular", soru.id);
      await updateDoc(soruRef, {
        status: "solved",
      });

      setSoru({
        ...soru,
        status: "solved",
      });

      showToast("Soru çözüldü olarak işaretlendi", "success");
    } catch (error) {
      console.error("Durum güncelleme hatası:", error);
      showToast("Durum güncellenirken bir hata oluştu", "error");
    }
  };

  if (authLoading || loading || !soru) {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <HomeHeader />

      <div className="flex justify-center items-start px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="mb-6 animate-slideFade">
            <button
              onClick={() => router.push("/sorularim")}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Geri Dön</span>
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 bg-gradient-to-br ${SUBJECT_COLORS[soru.ders] || "from-gray-500 to-gray-600"} rounded-2xl flex items-center justify-center text-2xl shadow-lg`}>
                {SUBJECT_ICONS[soru.ders] || "📚"}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{soru.ders} Sorusu</h1>
                <p className="text-sm text-gray-500">
                  {soru.createdAt.toDate().toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Soru Görseli */}
          <div className="bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-xl rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 mb-6 animate-slideFade">
            <div className="relative w-full rounded-2xl overflow-hidden">
              <Image
                src={soru.soruImgUrl}
                alt={`${soru.ders} sorusu`}
                width={800}
                height={600}
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Quota/Rate Limit Hatası Bilgilendirmesi */}
          {quotaError && (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-3xl p-6 mb-6 animate-slideFade">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-orange-900 mb-2">API Kullanım Limiti</h3>
                  <p className="text-orange-800 text-sm mb-3">
                    AI API kullanım limitiniz dolmuş veya çok fazla istek gönderildi. Soru çözme özelliği geçici olarak kullanılamıyor.
                  </p>
                  <div className="bg-white/60 rounded-xl p-4 mb-3">
                    <p className="text-sm font-semibold text-orange-900 mb-2">Çözüm Adımları:</p>
                    <ol className="text-sm text-orange-800 space-y-1 list-decimal list-inside">
                      <li><strong>Birkaç dakika bekleyin</strong> - Rate limit genellikle kısa sürede sıfırlanır (Gemini: dakikada 15 istek)</li>
                      <li>Gemini API limitlerinizi kontrol edin: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google AI Studio</a></li>
                      <li>GEMINI_API_KEY'inizin doğru olduğundan emin olun</li>
                      <li>Günde 60 istek limiti var - limit aşıldıysa ertesi gün sıfırlanır</li>
                    </ol>
                  </div>
                  <button
                    onClick={() => setQuotaError(false)}
                    className="text-sm text-orange-700 hover:text-orange-900 font-semibold underline"
                  >
                    Mesajı Kapat
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Durum ve Aksiyonlar */}
          <div className="bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-xl rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 mb-6 animate-slideFade">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className={`text-sm px-4 py-2 rounded-full font-bold ${
                  soru.status === "solved"
                    ? "bg-green-500 text-white"
                    : soru.status === "answered"
                    ? "bg-blue-500 text-white"
                    : soru.solving
                    ? "bg-purple-500 text-white animate-pulse"
                    : "bg-yellow-500 text-white"
                }`}>
                  {soru.status === "solved"
                    ? "✓ Çözüldü"
                    : soru.status === "answered"
                    ? "✓ Cevaplandı"
                    : soru.solving
                    ? "⏳ Çözülüyor..."
                    : "⏸ Beklemede"}
                </span>
              </div>
              <div className="flex gap-3">
                {!soru.solution && !soru.solving && (
                  <button
                    onClick={handleSolve}
                    disabled={solving}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {solving ? "Çözülüyor..." : "Soruyu Çöz"}
                  </button>
                )}
                {soru.status === "answered" && (
                  <button
                    onClick={handleMarkAsSolved}
                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transition"
                  >
                    Çözüldü Olarak İşaretle
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Çözüm Adımları */}
          {soru.solution && (
            <div className="bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-xl rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 animate-slideFade">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>📚</span>
                <span>Çözüm Adımları</span>
              </h2>
              <div className="space-y-4">
                {soru.solution.steps.map((step, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-2xl p-5 shadow-md border-l-4 border-blue-500"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {step.step}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-800 leading-relaxed mb-2">{step.explanation}</p>
                        {step.calculation && (
                          <div className="bg-gray-50 rounded-xl p-3 mt-2 font-mono text-sm text-gray-700">
                            {step.calculation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="text-sm text-gray-600 font-semibold mb-1">Final Cevap</p>
                    <p className="text-xl font-bold text-green-700">{soru.solution.finalAnswer}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {soru.solving && (
            <div className="bg-gradient-to-br from-white via-white to-purple-50/30 backdrop-blur-xl rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 animate-slideFade">
              <div className="flex items-center justify-center gap-3 text-purple-600">
                <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="font-semibold">Soru çözülüyor, lütfen bekleyin...</p>
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
    </div>
  );
}

