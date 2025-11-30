"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { collection, query, orderBy, getDocs, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import StudentFooter from "@/components/StudentFooter";
import { shouldRedirectToPremium } from "@/lib/subscriptionGuard";

interface Soru {
  id: string;
  ders: string;
  createdAt: Timestamp;
  status: "pending" | "answered" | "solved";
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

export default function IstatistiklerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sorular, setSorular] = useState<Soru[]>([]);
  const [workDuration, setWorkDuration] = useState<string>("");
  const [showScrollTop, setShowScrollTop] = useState(false);

  // İstatistikler
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [solvedQuestions, setSolvedQuestions] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState(0);
  const [pendingQuestions, setPendingQuestions] = useState(0);
  const [subjectDistribution, setSubjectDistribution] = useState<{ [key: string]: number }>({});
  const [todayQuestions, setTodayQuestions] = useState(0);
  const [weekQuestions, setWeekQuestions] = useState(0);
  const [monthQuestions, setMonthQuestions] = useState(0);

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

  useEffect(() => {
    if (user) {
      fetchStatistics();
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

  // Çalışma süresini hesapla
  useEffect(() => {
    if (userData?.createdAt) {
      const calculateWorkDuration = () => {
        const createdAt = userData.createdAt?.toDate?.() || new Date(userData.createdAt?.seconds * 1000);
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffDays > 0) {
          setWorkDuration(`${diffDays} gün`);
        } else if (diffHours > 0) {
          setWorkDuration(`${diffHours} saat`);
        } else {
          setWorkDuration(`${diffMinutes} dakika`);
        }
      };

      calculateWorkDuration();
      const interval = setInterval(calculateWorkDuration, 60000);
      return () => clearInterval(interval);
    }
  }, [userData?.createdAt]);

  const fetchStatistics = async () => {
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

      // İstatistikleri hesapla
      const total = sorularData.length;
      const solved = sorularData.filter((s) => s.status === "solved").length;
      const answered = sorularData.filter((s) => s.status === "answered").length;
      const pending = sorularData.filter((s) => s.status === "pending").length;

      setTotalQuestions(total);
      setSolvedQuestions(solved);
      setAnsweredQuestions(answered);
      setPendingQuestions(pending);

      // Derslere göre dağılım
      const distribution: { [key: string]: number } = {};
      sorularData.forEach((soru) => {
        const ders = soru.ders || "Bilinmeyen";
        distribution[ders] = (distribution[ders] || 0) + 1;
      });
      setSubjectDistribution(distribution);

      // Zaman bazlı istatistikler
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      const todayCount = sorularData.filter((s) => {
        const createdAt = s.createdAt?.toDate?.() || new Date(s.createdAt?.seconds * 1000);
        return createdAt >= today;
      }).length;

      const weekCount = sorularData.filter((s) => {
        const createdAt = s.createdAt?.toDate?.() || new Date(s.createdAt?.seconds * 1000);
        return createdAt >= weekAgo;
      }).length;

      const monthCount = sorularData.filter((s) => {
        const createdAt = s.createdAt?.toDate?.() || new Date(s.createdAt?.seconds * 1000);
        return createdAt >= monthAgo;
      }).length;

      setTodayQuestions(todayCount);
      setWeekQuestions(weekCount);
      setMonthQuestions(monthCount);
    } catch (error) {
      console.error("İstatistikler yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || userDataLoading || loading) {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const sortedSubjects = Object.entries(subjectDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  // Durum dağılımı için donut chart verisi
  const statusData = [
    { label: "Çözülen", value: solvedQuestions, color: "from-green-500 to-emerald-600", bgColor: "#10b981", endColor: "#059669" },
    { label: "Cevaplanan", value: answeredQuestions, color: "from-blue-500 to-indigo-600", bgColor: "#3b82f6", endColor: "#2563eb" },
    { label: "Bekleyen", value: pendingQuestions, color: "from-yellow-500 to-orange-600", bgColor: "#eab308", endColor: "#f59e0b" },
  ].filter(item => item.value > 0);

  // Donut chart hesaplama
  const totalStatus = statusData.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;
  const statusPaths = statusData.map((item) => {
    const percentage = (item.value / totalStatus) * 100;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle += angle;

    const startAngleRad = (startAngle - 90) * (Math.PI / 180);
    const endAngleRad = (endAngle - 90) * (Math.PI / 180);
    const radius = 60;
    const innerRadius = 40;
    const centerX = 80;
    const centerY = 80;

    const x1 = centerX + radius * Math.cos(startAngleRad);
    const y1 = centerY + radius * Math.sin(startAngleRad);
    const x2 = centerX + radius * Math.cos(endAngleRad);
    const y2 = centerY + radius * Math.sin(endAngleRad);
    const x3 = centerX + innerRadius * Math.cos(endAngleRad);
    const y3 = centerY + innerRadius * Math.sin(endAngleRad);
    const x4 = centerX + innerRadius * Math.cos(startAngleRad);
    const y4 = centerY + innerRadius * Math.sin(startAngleRad);

    const largeArc = angle > 180 ? 1 : 0;

    const outerPath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    const innerPath = `L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    return {
      ...item,
      path: outerPath + " " + innerPath,
      percentage: Math.round(percentage),
    };
  });

  // Son 7 gün için veri
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const dailyStats = last7Days.map((date) => {
    const count = sorular.filter((s) => {
      const createdAt = s.createdAt?.toDate?.() || new Date(s.createdAt?.seconds * 1000);
      const createdDate = new Date(createdAt);
      createdDate.setHours(0, 0, 0, 0);
      return createdDate.getTime() === date.getTime();
    }).length;
    return {
      date,
      count,
      dayName: date.toLocaleDateString("tr-TR", { weekday: "short" }),
    };
  });

  const maxDailyCount = Math.max(...dailyStats.map((d) => d.count), 1);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className="flex justify-center items-start px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="w-full max-w-6xl">
          {/* Header */}
          <div className="mb-8 animate-slideFade">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">İstatistikler</h1>
            <p className="text-gray-600">Çalışma performansınızı ve ilerlemenizi görüntüleyin</p>
          </div>

          {/* Genel İstatistikler - Enhanced */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(59,130,246,0.2)] border border-blue-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Toplam Soru</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{totalQuestions}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(34,197,94,0.2)] border border-green-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Çözülen Soru</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{solvedQuestions}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(59,130,246,0.2)] border border-blue-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Cevaplanan Soru</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{answeredQuestions}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(251,191,36,0.2)] border border-yellow-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1 font-medium">Bekleyen Soru</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">{pendingQuestions}</p>
              </div>
            </div>
          </div>

          {/* Durum Dağılımı - Donut Chart */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Durum Dağılımı</h2>
            {statusData.length > 0 ? (
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="relative">
                  <svg width="160" height="160" viewBox="0 0 160 160" className="transform -rotate-90">
                    {statusPaths.map((item, index) => (
                      <path
                        key={index}
                        d={item.path}
                        fill={`url(#gradient-${index})`}
                        className="transition-all duration-500 hover:opacity-80"
                      />
                    ))}
                    <defs>
                      {statusPaths.map((item, index) => (
                        <linearGradient key={index} id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={item.bgColor} />
                          <stop offset="100%" stopColor={item.endColor} />
                        </linearGradient>
                      ))}
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-900">{totalStatus}</p>
                      <p className="text-xs text-gray-500">Toplam</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {statusPaths.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${item.color}`}></div>
                        <span className="font-semibold text-gray-900">{item.label}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{item.value}</p>
                        <p className="text-xs text-gray-500">{item.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Henüz soru yok</p>
            )}
          </div>

          {/* Son 7 Gün - Bar Chart */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Son 7 Gün</h2>
            <div className="flex items-end justify-between gap-2 h-48">
              {dailyStats.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="relative w-full flex items-end justify-center h-40">
                    <div
                      className="w-full bg-gradient-to-t from-blue-500 to-indigo-600 rounded-t-lg transition-all duration-500 hover:from-blue-600 hover:to-indigo-700 group-hover:shadow-lg"
                      style={{ height: `${(day.count / maxDailyCount) * 100}%`, minHeight: day.count > 0 ? "8px" : "0" }}
                    >
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {day.count} soru
                      </div>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-gray-600 uppercase">{day.dayName}</p>
                  <p className="text-lg font-bold text-gray-900">{day.count}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Zaman Bazlı İstatistikler - Enhanced */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(168,85,247,0.2)] border border-purple-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                    <span className="text-xl">📅</span>
                  </div>
                  <p className="text-sm text-gray-600 font-medium">Bugün</p>
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{todayQuestions} soru</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(20,184,166,0.2)] border border-teal-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
                    <span className="text-xl">📊</span>
                  </div>
                  <p className="text-sm text-gray-600 font-medium">Bu Hafta</p>
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">{weekQuestions} soru</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(249,115,22,0.2)] border border-orange-100 relative overflow-hidden group hover:scale-[1.02] transition-all">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-200/30 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                    <span className="text-xl">📈</span>
                  </div>
                  <p className="text-sm text-gray-600 font-medium">Bu Ay</p>
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{monthQuestions} soru</p>
              </div>
            </div>
          </div>

          {/* Derslere Göre Dağılım - Enhanced */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Derslere Göre Dağılım</h2>
            {sortedSubjects.length > 0 ? (
              <div className="space-y-4">
                {sortedSubjects.map(([ders, count]) => {
                  const percentage = totalQuestions > 0 ? (count / totalQuestions) * 100 : 0;
                  return (
                    <div key={ders} className="space-y-3 p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 bg-gradient-to-br ${SUBJECT_COLORS[ders] || "from-gray-500 to-gray-600"} rounded-2xl flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}>
                            {SUBJECT_ICONS[ders] || "❓"}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-lg">{ders}</p>
                            <p className="text-sm text-gray-500 font-medium">{count} soru</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">{Math.round(percentage)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                        <div
                          className={`bg-gradient-to-r ${SUBJECT_COLORS[ders] || "from-gray-500 to-gray-600"} h-3 rounded-full transition-all duration-700 ease-out relative`}
                          style={{ width: `${percentage}%` }}
                        >
                          <div className="absolute inset-0 bg-white/30 rounded-full animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Henüz soru yok</p>
            )}
          </div>

          {/* Çalışma Süresi - Enhanced */}
          <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(168,85,247,0.2)] border border-purple-100 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-200/30 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium mb-1">Çalışma Süresi</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">{workDuration || "0 dk"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">Kayıt Tarihinden</p>
                  <p className="text-sm font-semibold text-gray-700">İtibaren</p>
                </div>
              </div>
            </div>
          </div>
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
      
      <StudentFooter />
    </div>
  );
}


