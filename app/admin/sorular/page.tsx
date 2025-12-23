"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";
import Image from "next/image";

interface Soru {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  soruImgUrl: string;
  ders: string;
  status: "pending" | "answered" | "solved";
  createdAt: Timestamp;
}

export default function AdminSorularPage() {
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "answered" | "solved">("all");
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
    fetchSorular();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const fetchSorular = async () => {
    try {
      setLoading(true);
      const allQuestions: Soru[] = [];
      const usersSnapshot = await getDocs(collection(db, "users"));

      for (const userDoc of usersSnapshot.docs) {
        const questionsRef = collection(db, "users", userDoc.id, "sorular");
        const q = query(questionsRef, orderBy("createdAt", "desc"), limit(20));
        const snapshot = await getDocs(q);

        snapshot.forEach((doc) => {
          allQuestions.push({
            id: doc.id,
            userId: userDoc.id,
            ...doc.data(),
          } as Soru);
        });
      }

      allQuestions.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

      setSorular(allQuestions);
    } catch (error) {      showToast("Sorular yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatTarih = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredSorular = filter === "all" 
    ? sorular 
    : sorular.filter((s) => s.status === filter);

  // Ders kategorilerine göre grupla
  const groupedBySubject = filteredSorular.reduce((acc, soru) => {
    const ders = soru.ders || "Bilinmeyen";
    if (!acc[ders]) {
      acc[ders] = [];
    }
    acc[ders].push(soru);
    return acc;
  }, {} as { [key: string]: Soru[] });

  // Dersleri alfabetik sırala
  const subjects = Object.keys(groupedBySubject).sort();

  const SUBJECT_COLORS: { [key: string]: string } = {
    "Matematik": "from-blue-500 to-indigo-600",
    "Fizik": "from-purple-500 to-pink-600",
    "Kimya": "from-green-500 to-emerald-600",
    "Biyoloji": "from-red-500 to-rose-600",
    "Türkçe": "from-yellow-500 to-orange-600",
    "Tarih": "from-amber-500 to-yellow-600",
    "Coğrafya": "from-teal-500 to-cyan-600",
    "Felsefe": "from-indigo-500 to-purple-600",
    "Vatandaşlık": "from-blue-500 to-cyan-600",
    "Güncel": "from-gray-500 to-slate-600",
    "Güncel Olaylar": "from-gray-500 to-slate-600",
    "Beden Eğitimi": "from-orange-500 to-red-600",
    "Edebiyat": "from-pink-500 to-rose-600",
    "Fen Bilgisi": "from-emerald-500 to-teal-600",
    "Sosyal Bilgiler": "from-orange-500 to-amber-600",
    "Sayısal Mantık": "from-violet-500 to-purple-600",
    "Sözel Mantık": "from-cyan-500 to-blue-600",
    "Geometri": "from-indigo-500 to-blue-600",
    "Eğitim Bilimleri": "from-emerald-500 to-green-600",
    "Gelişim": "from-pink-500 to-rose-600",
    "Din Kültürü ve Ahlak Bilgisi": "from-amber-500 to-yellow-600",
    "Okul Öncesi": "from-purple-500 to-pink-600",
    "Rehberlik": "from-teal-500 to-cyan-600",
    "Sınıf Öğretmenliği": "from-orange-500 to-red-600",
    "İngilizce": "from-red-500 to-pink-600",
    "Almanca": "from-yellow-500 to-amber-600",
    "İtalyanca": "from-green-500 to-emerald-600",
    "Arapça": "from-slate-500 to-gray-600",
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
    "Vatandaşlık": "📋",
    "Güncel": "📰",
    "Güncel Olaylar": "📰",
    "Beden Eğitimi": "⚽",
    "Edebiyat": "📚",
    "Fen Bilgisi": "🔬",
    "Sosyal Bilgiler": "🌐",
    "Sayısal Mantık": "🔢",
    "Sözel Mantık": "💡",
    "Geometri": "📐",
    "Eğitim Bilimleri": "🎓",
    "Gelişim": "🌱",
    "Din Kültürü ve Ahlak Bilgisi": "🕌",
    "Okul Öncesi": "🧸",
    "Rehberlik": "🤝",
    "Sınıf Öğretmenliği": "👨‍🏫",
    "İngilizce": "🇬🇧",
    "Almanca": "🇩🇪",
    "İtalyanca": "🇮🇹",
    "Arapça": "🇸🇦",
    "Bilinmeyen": "❓",
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sorular</h1>
        <p className="text-gray-600">Tüm kullanıcı sorularını görüntüleyin</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {(["all", "pending", "answered", "solved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition ${
              filter === f
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "Tümü" : f === "pending" ? "Bekleyen" : f === "answered" ? "Yanıtlandı" : "Çözüldü"}
          </button>
        ))}
      </div>

      {/* Questions by Subject */}
      {subjects.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
          <p className="text-gray-500 font-medium">Henüz soru yok</p>
        </div>
      ) : (
        <div className="space-y-8">
          {subjects.map((subject) => {
            const subjectSorular = groupedBySubject[subject];
            const subjectColor = SUBJECT_COLORS[subject] || "from-gray-500 to-gray-600";
            const subjectIcon = SUBJECT_ICONS[subject] || "❓";

            return (
              <div
                key={subject}
                className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden"
              >
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-200/20 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  {/* Subject Header */}
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-12 h-12 bg-gradient-to-br ${subjectColor} rounded-2xl flex items-center justify-center shadow-lg text-2xl`}>
                        {subjectIcon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{subject}</h2>
                        <p className="text-sm text-gray-600">{subjectSorular.length} soru</p>
                      </div>
                    </div>
                  </div>

                  {/* Questions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {subjectSorular.map((soru) => {
                      const statusColors = {
                        pending: "bg-yellow-100 text-yellow-700",
                        answered: "bg-blue-100 text-blue-700",
                        solved: "bg-green-100 text-green-700",
                      };

                      return (
                        <div
                          key={`${soru.userId}-${soru.id}`}
                          className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 shadow-[0_5px_20px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden hover:shadow-lg transition"
                        >
                          <div className="relative z-10">
                            <div className="mb-3">
                              <div className="relative w-full h-40 bg-gray-100 rounded-xl overflow-hidden mb-2">
                                <Image
                                  src={soru.soruImgUrl}
                                  alt="Soru"
                                  fill
                                  className="object-contain"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <span className={`px-2 py-1 bg-gradient-to-r ${subjectColor} text-white rounded-full text-xs font-bold`}>
                                  {soru.ders}
                                </span>
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[soru.status]}`}>
                                  {soru.status === "pending" ? "Bekleyen" : soru.status === "answered" ? "Yanıtlandı" : "Çözüldü"}
                                </span>
                              </div>
                            </div>
                            <div className="border-t border-gray-200 pt-3">
                              <p className="text-xs text-gray-600 mb-1">
                                <span className="font-semibold">{soru.userName || soru.userEmail || "Kullanıcı"}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatTarih(soru.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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

