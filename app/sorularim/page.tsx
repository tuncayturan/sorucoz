"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import Image from "next/image";
import StudentFooter from "@/components/StudentFooter";

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
  "Vatandaşlık": "from-blue-500 to-cyan-600",
  "Güncel": "from-gray-500 to-slate-600",
  "Fen Bilgisi": "from-emerald-500 to-teal-600",
  "Sosyal Bilgiler": "from-orange-500 to-amber-600",
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
  "Fen Bilgisi": "🔬",
  "Sosyal Bilgiler": "🌐",
  "Bilinmeyen": "❓",
};

export default function SorularimPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchSorular();
    }
  }, [user]);

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      setShowScrollTop(scrollPosition > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const fetchSorular = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const questionsRef = collection(db, "users", user.uid, "sorular");
      const q = query(questionsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      const sorularData: Soru[] = [];
      querySnapshot.forEach((doc) => {
        sorularData.push({
          id: doc.id,
          ...doc.data(),
        } as Soru);
      });

      setSorular(sorularData);
    } catch (error) {
      console.error("Sorular yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  // Derslere göre grupla
  const groupedSorular = sorular.reduce((acc, soru) => {
    const ders = soru.ders || "Bilinmeyen";
    if (!acc[ders]) {
      acc[ders] = [];
    }
    acc[ders].push(soru);
    return acc;
  }, {} as { [key: string]: Soru[] });

  const subjects = Object.keys(groupedSorular).sort();

  // Filtrelenmiş sorular
  const filteredSorular = selectedSubject
    ? groupedSorular[selectedSubject] || []
    : sorular;

  if (authLoading || userDataLoading || loading) {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className="flex justify-center items-start px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="w-full max-w-6xl">
          {/* Header */}
          <div className="mb-8 animate-slideFade">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sorularım</h1>
            <p className="text-gray-600">
              {sorular.length > 0
                ? `Toplam ${sorular.length} soru yüklediniz`
                : "Henüz soru yüklemediniz"}
            </p>
          </div>

          {/* Ders Filtreleri */}
          {subjects.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-3 animate-slideFade">
              <button
                onClick={() => setSelectedSubject(null)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                  selectedSubject === null
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Tümü ({sorular.length})
              </button>
              {subjects.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                    selectedSubject === subject
                      ? `bg-gradient-to-r ${SUBJECT_COLORS[subject] || "from-gray-500 to-gray-600"} text-white shadow-lg`
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {SUBJECT_ICONS[subject] || "📚"} {subject} ({groupedSorular[subject].length})
                </button>
              ))}
            </div>
          )}

          {/* Sorular Listesi */}
          {sorular.length === 0 ? (
            <div className="bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-xl rounded-3xl p-12 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 text-center animate-slideFade">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Henüz soru yok</h3>
              <p className="text-gray-600 mb-6">İlk sorunuzu yüklemek için "Soru Sor" sayfasına gidin</p>
              <button
                onClick={() => router.push("/soru-sor")}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition"
              >
                Soru Sor
              </button>
            </div>
          ) : selectedSubject ? (
            // Seçili derse göre listele
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-xl rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 animate-slideFade">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 bg-gradient-to-br ${SUBJECT_COLORS[selectedSubject] || "from-gray-500 to-gray-600"} rounded-2xl flex items-center justify-center text-2xl shadow-lg`}>
                    {SUBJECT_ICONS[selectedSubject] || "📚"}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedSubject}</h2>
                    <p className="text-sm text-gray-500">{groupedSorular[selectedSubject].length} soru</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSorular.map((soru) => (
                    <div
                      key={soru.id}
                      className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition cursor-pointer border border-gray-100 relative overflow-hidden"
                      onClick={() => {
                        router.push(`/sorularim/${soru.id}`);
                      }}
                    >
                      {/* Durum Badge - Üstte */}
                      <div className="absolute top-3 left-3 z-10">
                        <span className={`text-xs px-3 py-1.5 rounded-full font-bold shadow-lg ${
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
                      <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                        <Image
                          src={soru.soruImgUrl}
                          alt={`${soru.ders} sorusu`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">
                          {soru.ders}
                        </span>
                        <span className="text-xs text-gray-500">
                          {soru.createdAt.toDate().toLocaleDateString("tr-TR")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            // Derslere göre gruplanmış listeleme
            <div className="space-y-6">
              {subjects.map((subject) => (
                <div
                  key={subject}
                  className="bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-xl rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 animate-slideFade"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-12 h-12 bg-gradient-to-br ${SUBJECT_COLORS[subject] || "from-gray-500 to-gray-600"} rounded-2xl flex items-center justify-center text-2xl shadow-lg`}>
                      {SUBJECT_ICONS[subject] || "📚"}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">{subject}</h2>
                      <p className="text-sm text-gray-500">{groupedSorular[subject].length} soru</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedSorular[subject].map((soru) => (
                      <div
                        key={soru.id}
                        className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition cursor-pointer border border-gray-100 relative overflow-hidden"
                        onClick={() => {
                          router.push(`/sorularim/${soru.id}`);
                        }}
                      >
                        {/* Durum Badge - Üstte */}
                        <div className="absolute top-3 left-3 z-10">
                          <span className={`text-xs px-3 py-1.5 rounded-full font-bold shadow-lg ${
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
                        <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                          <Image
                            src={soru.soruImgUrl}
                            alt={`${soru.ders} sorusu`}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">
                            {soru.ders}
                          </span>
                          <span className="text-xs text-gray-500">
                            {soru.createdAt.toDate().toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
        } active:scale-95`}
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
      
      <StudentFooter />
    </div>
  );
}

