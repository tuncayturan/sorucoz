"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

export default function AdminIstatistiklerPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalQuestions: 0,
    solvedQuestions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
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
    fetchStats();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Kullanıcı istatistikleri
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const totalUsers = usersSnapshot.size;
      
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      let activeUsers = 0;

      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        const lastActive = data.lastActive?.toDate?.() || data.createdAt?.toDate?.();
        if (lastActive && lastActive >= last30Days) {
          activeUsers++;
        }
      });

      // Soru istatistikleri
      let totalQuestions = 0;
      let solvedQuestions = 0;

      const usersSnapshot2 = await getDocs(usersRef);
      for (const userDoc of usersSnapshot2.docs) {
        const questionsRef = collection(db, "users", userDoc.id, "sorular");
        const questionsSnapshot = await getDocs(questionsRef);
        totalQuestions += questionsSnapshot.size;
        
        questionsSnapshot.forEach((qDoc) => {
          if (qDoc.data().status === "solved") {
            solvedQuestions++;
          }
        });
      }

      // Gelir istatistikleri (örnek - gerçek uygulamada payments collection'ından alınmalı)
      const totalRevenue = 0;
      const monthlyRevenue = 0;

      setStats({
        totalUsers,
        activeUsers,
        totalQuestions,
        solvedQuestions,
        totalRevenue,
        monthlyRevenue,
      });
    } catch (error) {      showToast("İstatistikler yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">İstatistikler ve Raporlar</h1>
        <p className="text-gray-600">Platform genel istatistikleri</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-6 border border-blue-100 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Toplam Kullanıcı</p>
            <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-6 border border-green-100 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Aktif Kullanıcı (30 gün)</p>
            <p className="text-3xl font-bold text-green-600">{stats.activeUsers}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-6 border border-purple-100 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <span className="text-2xl">❓</span>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Toplam Soru</p>
            <p className="text-3xl font-bold text-purple-600">{stats.totalQuestions}</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl p-6 border border-yellow-100 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Çözülen Soru</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.solvedQuestions}</p>
            <p className="text-xs text-gray-500 mt-2">
              {stats.totalQuestions > 0 
                ? `%${Math.round((stats.solvedQuestions / stats.totalQuestions) * 100)} çözüm oranı`
                : "0% çözüm oranı"}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 border border-emerald-100 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Toplam Gelir</p>
            <p className="text-3xl font-bold text-emerald-600">{stats.totalRevenue.toLocaleString("tr-TR")}₺</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-3xl p-6 border border-cyan-100 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Aylık Gelir</p>
            <p className="text-3xl font-bold text-cyan-600">{stats.monthlyRevenue.toLocaleString("tr-TR")}₺</p>
          </div>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Grafikler</h2>
        <div className="text-center py-12 text-gray-500">
          <p>Grafik görselleştirmeleri buraya eklenecek</p>
          <p className="text-sm mt-2">(Chart.js, Recharts, vb. kullanılabilir)</p>
        </div>
      </div>

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

