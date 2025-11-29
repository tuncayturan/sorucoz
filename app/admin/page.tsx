"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, Timestamp, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getPlanPrice } from "@/lib/subscriptionUtils";
import Toast from "@/components/ui/Toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface Kullanici {
  id: string;
  subscriptionPlan?: "trial" | "lite" | "premium";
  subscriptionStatus?: "trial" | "active" | "expired";
  subscriptionStartDate?: Timestamp;
  subscriptionEndDate?: Timestamp;
  createdAt: Timestamp;
  lastTokenUpdate?: Timestamp | Date;
  lastSeen?: Timestamp;
  isOnline?: boolean;
  role?: "student" | "coach" | "admin";
}

interface SupportStats {
  pending: number;
  answered: number;
  closed: number;
  total: number;
}

interface MessageStats {
  total: number;
  unread: number;
}

export default function AdminDashboard() {
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [supportStats, setSupportStats] = useState<SupportStats>({
    pending: 0,
    answered: 0,
    closed: 0,
    total: 0,
  });
  const [messageStats, setMessageStats] = useState<MessageStats>({
    total: 0,
    unread: 0,
  });
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  // Çevrimiçi durumunu güncelle
  useOnlineStatus();

  useEffect(() => {
    fetchData();
    
    // Gerçek zamanlı çevrimiçi kullanıcı sayısını dinle
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000); // Son 2 dakika
      
      let onlineCount = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        // isOnline true ise veya lastSeen son 2 dakika içindeyse çevrimiçi say
        if (data.isOnline === true) {
          onlineCount++;
        } else if (data.lastSeen) {
          const lastSeen = data.lastSeen.toDate ? data.lastSeen.toDate() : new Date(data.lastSeen);
          if (lastSeen >= twoMinutesAgo) {
            onlineCount++;
          }
        }
      });
      setOnlineUsers(onlineCount);
    });

    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const users: Kullanici[] = [];
      snapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data(),
        } as Kullanici);
      });

      setKullanicilar(users);

      // Fetch support messages statistics
      await fetchSupportStats();
      
      // Fetch user messages statistics
      await fetchMessageStats();
    } catch (error) {
      console.error("Kullanıcılar yüklenirken hata:", error);
      showToast("Veri yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportStats = async () => {
    try {
      let pending = 0;
      let answered = 0;
      let closed = 0;
      let total = 0;

      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const destekRef = collection(db, "users", userId, "destek");
        const destekSnapshot = await getDocs(destekRef);

        destekSnapshot.forEach((doc) => {
          const data = doc.data();
          total++;
          const status = data.status || "pending";
          if (status === "pending") {
            pending++;
          } else if (status === "answered") {
            answered++;
          } else if (status === "closed") {
            closed++;
          }
        });
      }

      setSupportStats({ pending, answered, closed, total });
    } catch (error) {
      console.error("Destek mesajları istatistikleri yüklenirken hata:", error);
    }
  };

  const fetchMessageStats = async () => {
    try {
      let total = 0;
      let unread = 0;

      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const mesajlarRef = collection(db, "users", userId, "mesajlar");
        const mesajlarSnapshot = await getDocs(mesajlarRef);

        mesajlarSnapshot.forEach((doc) => {
          const data = doc.data();
          total++;
          if (!data.read) {
            unread++;
          }
        });
      }

      setMessageStats({ total, unread });
    } catch (error) {
      console.error("Kullanıcı mesajları istatistikleri yüklenirken hata:", error);
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // Aylık kazanç hesaplama
  const calculateMonthlyRevenue = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let revenue = 0;
    let activeLite = 0;
    let activePremium = 0;

    kullanicilar.forEach((user) => {
      if (user.subscriptionStatus === "active" && user.subscriptionPlan !== "trial") {
        const subStart = user.subscriptionStartDate?.toDate();
        const subEnd = user.subscriptionEndDate?.toDate();

        if (subStart && subEnd) {
          // Bu ay içinde başlayan veya devam eden abonelikler
          if (
            (subStart >= startOfMonth && subStart <= endOfMonth) ||
            (subStart < startOfMonth && subEnd >= startOfMonth)
          ) {
            if (user.subscriptionPlan === "lite") {
              revenue += getPlanPrice("lite");
              activeLite++;
            } else if (user.subscriptionPlan === "premium") {
              revenue += getPlanPrice("premium");
              activePremium++;
            }
          }
        }
      }
    });

    return { revenue, activeLite, activePremium };
  };

  const { revenue, activeLite, activePremium } = calculateMonthlyRevenue();

  // İstatistikler
  const totalUsers = kullanicilar.length;
  const trialUsers = kullanicilar.filter((u) => u.subscriptionPlan === "trial" || !u.subscriptionPlan).length;
  const liteUsers = kullanicilar.filter((u) => u.subscriptionPlan === "lite").length;
  const premiumUsers = kullanicilar.filter((u) => u.subscriptionPlan === "premium").length;
  const activeSubscriptions = kullanicilar.filter(
    (u) => u.subscriptionStatus === "active" && u.subscriptionPlan !== "trial"
  ).length;

  // Aktif kullanıcılar (son 30 gün içinde aktivite gösteren)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const activeUsers = kullanicilar.filter((u) => {
    if (u.lastTokenUpdate) {
      let lastUpdate: Date;
      if (u.lastTokenUpdate instanceof Date) {
        lastUpdate = u.lastTokenUpdate;
      } else if (u.lastTokenUpdate && typeof u.lastTokenUpdate === 'object' && 'toDate' in u.lastTokenUpdate) {
        lastUpdate = (u.lastTokenUpdate as Timestamp).toDate();
      } else {
        return false;
      }
      return lastUpdate >= thirtyDaysAgo;
    }
    // Eğer lastTokenUpdate yoksa, createdAt'e göre kontrol et (son 30 gün içinde kayıt olanlar)
    if (u.createdAt) {
      let created: Date;
      if (u.createdAt instanceof Date) {
        created = u.createdAt;
      } else if (u.createdAt && typeof u.createdAt === 'object' && 'toDate' in u.createdAt) {
        created = u.createdAt.toDate();
      } else {
        return false;
      }
      return created >= thirtyDaysAgo;
    }
    return false;
  }).length;

  // Yeni kullanıcılar (son 30 gün içinde kayıt olanlar)
  const newUsers = kullanicilar.filter((u) => {
    if (u.createdAt) {
      let created: Date;
      if (u.createdAt instanceof Date) {
        created = u.createdAt;
      } else if (u.createdAt && typeof u.createdAt === 'object' && 'toDate' in u.createdAt) {
        created = u.createdAt.toDate();
      } else {
        return false;
      }
      return created >= thirtyDaysAgo;
    }
    return false;
  }).length;

  // Rol bazlı istatistikler
  const studentCount = kullanicilar.filter((u) => u.role === "student" || !u.role).length;
  const coachCount = kullanicilar.filter((u) => u.role === "coach").length;
  const adminCount = kullanicilar.filter((u) => u.role === "admin").length;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Admin panel genel bakış</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Toplam Kullanıcı */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-blue-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">👥</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Toplam Kullanıcı</p>
            <p className="text-3xl font-bold text-blue-600">{totalUsers}</p>
            <p className="text-xs text-gray-500 mt-2">Kayıtlı kullanıcılar</p>
          </div>
        </div>

        {/* Çevrimiçi Kullanıcı */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-green-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🟢</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Çevrimiçi Kullanıcı</p>
            <p className="text-3xl font-bold text-green-600">{onlineUsers}</p>
            <p className="text-xs text-gray-500 mt-2">Şu an sitede aktif</p>
          </div>
        </div>

        {/* Yeni Kullanıcılar */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-purple-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">✨</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Yeni Kullanıcı</p>
            <p className="text-3xl font-bold text-purple-600">{newUsers}</p>
            <p className="text-xs text-gray-500 mt-2">Son 30 gün içinde</p>
          </div>
        </div>

        {/* Aylık Kazanç */}
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-yellow-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">💰</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Aylık Kazanç</p>
            <p className="text-3xl font-bold text-yellow-600">{revenue.toLocaleString("tr-TR")}₺</p>
            <p className="text-xs text-gray-500 mt-2">
              {activeLite} Lite + {activePremium} Premium
            </p>
          </div>
        </div>
      </div>

      {/* Kullanıcı Rol Dağılımı */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-cyan-50 to-teal-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-cyan-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🎓</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Öğrenci</p>
            <p className="text-3xl font-bold text-cyan-600">{studentCount}</p>
            <p className="text-xs text-gray-500 mt-2">Toplam öğrenci sayısı</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-indigo-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">👨‍🏫</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Coach</p>
            <p className="text-3xl font-bold text-indigo-600">{coachCount}</p>
            <p className="text-xs text-gray-500 mt-2">Toplam coach sayısı</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-rose-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-red-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">👑</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Admin</p>
            <p className="text-3xl font-bold text-red-600">{adminCount}</p>
            <p className="text-xs text-gray-500 mt-2">Toplam admin sayısı</p>
          </div>
        </div>
      </div>

      {/* Abonelik İstatistikleri */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Aktif Abonelikler */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-purple-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">⭐</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Aktif Abonelik</p>
            <p className="text-3xl font-bold text-purple-600">{activeSubscriptions}</p>
            <p className="text-xs text-gray-500 mt-2">Lite + Premium</p>
          </div>
        </div>

        {/* Premium Kullanıcılar */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-amber-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">⭐</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Premium</p>
            <p className="text-3xl font-bold text-amber-600">{premiumUsers}</p>
            <p className="text-xs text-gray-500 mt-2">Aktif premium kullanıcı</p>
          </div>
        </div>

        {/* Lite Kullanıcılar */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-blue-200/50 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">📚</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 font-medium mb-2">Lite</p>
            <p className="text-3xl font-bold text-blue-600">{liteUsers}</p>
            <p className="text-xs text-gray-500 mt-2">Aktif lite kullanıcı</p>
          </div>
        </div>
      </div>

      {/* Destek Mesajları ve Kullanıcı Mesajları İstatistikleri */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Destek Mesajları İstatistikleri */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">💬</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Destek Mesajları</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-4 border border-yellow-100">
                <p className="text-sm text-gray-600 font-medium mb-1">Bekleyen</p>
                <p className="text-3xl font-bold text-yellow-600">{supportStats.pending}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                <p className="text-sm text-gray-600 font-medium mb-1">Yanıt Verilen</p>
                <p className="text-3xl font-bold text-blue-600">{supportStats.answered}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
                <p className="text-sm text-gray-600 font-medium mb-1">Çözülmüş</p>
                <p className="text-3xl font-bold text-green-600">{supportStats.closed}</p>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-sm text-gray-600 font-medium mb-1">Toplam</p>
                <p className="text-3xl font-bold text-gray-600">{supportStats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Kullanıcı Mesajları İstatistikleri */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-200/20 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">📨</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Kullanıcı Mesajları</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-sm text-gray-600 font-medium mb-1">Toplam</p>
                <p className="text-3xl font-bold text-gray-600">{messageStats.total}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-4 border border-red-100">
                <p className="text-sm text-gray-600 font-medium mb-1">Okunmamış</p>
                <p className="text-3xl font-bold text-red-600">{messageStats.unread}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Abonelik Dağılımı */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden mb-8">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-200/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Abonelik Dağılımı</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <p className="text-sm text-gray-600 font-medium mb-2">🆓 Trial</p>
              <p className="text-3xl font-bold text-blue-600">{trialUsers}</p>
              <p className="text-xs text-gray-500 mt-2">Kullanıcı</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <p className="text-sm text-gray-600 font-medium mb-2">📚 Lite</p>
              <p className="text-3xl font-bold text-blue-600">{liteUsers}</p>
              <p className="text-xs text-gray-500 mt-2">Kullanıcı</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-100">
              <p className="text-sm text-gray-600 font-medium mb-2">⭐ Premium</p>
              <p className="text-3xl font-bold text-yellow-600">{premiumUsers}</p>
              <p className="text-xs text-gray-500 mt-2">Kullanıcı</p>
            </div>
          </div>
        </div>
      </div>

      {/* Hızlı Erişim */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-200/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">⚡</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Hızlı Erişim</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <a
              href="/admin/destek"
              className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">💬</div>
              <p className="font-bold text-gray-900 text-sm">Destek</p>
            </a>
            <a
              href="/admin/mesajlar"
              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📨</div>
              <p className="font-bold text-gray-900 text-sm">Kullanıcı Mesajları</p>
            </a>
            <a
              href="/admin/kullanicilar"
              className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">👥</div>
              <p className="font-bold text-gray-900 text-sm">Kullanıcılar</p>
            </a>
            <a
              href="/admin/coach-yonetimi"
              className="bg-gradient-to-br from-cyan-50 to-teal-50 rounded-2xl p-6 border border-cyan-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">👨‍🏫</div>
              <p className="font-bold text-gray-900 text-sm">Coach Yönetimi</p>
            </a>
            <a
              href="/admin/security"
              className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-6 border border-red-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">🔒</div>
              <p className="font-bold text-gray-900 text-sm">Security</p>
            </a>
            <a
              href="/admin/sorular"
              className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-6 border border-yellow-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">❓</div>
              <p className="font-bold text-gray-900 text-sm">Sorular</p>
            </a>
            <a
              href="/admin/abonelikler"
              className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">⭐</div>
              <p className="font-bold text-gray-900 text-sm">Abonelikler</p>
            </a>
            <a
              href="/admin/odeme-yontemleri"
              className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">💳</div>
              <p className="font-bold text-gray-900 text-sm">Ödeme Yöntemleri</p>
            </a>
            <a
              href="/admin/odeme-gecmisi"
              className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">💰</div>
              <p className="font-bold text-gray-900 text-sm">Ödeme Geçmişi</p>
            </a>
            <a
              href="/admin/istatistikler"
              className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📈</div>
              <p className="font-bold text-gray-900 text-sm">İstatistikler</p>
            </a>
            <a
              href="/admin/ayarlar"
              className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-6 border border-gray-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">⚙️</div>
              <p className="font-bold text-gray-900 text-sm">Site Ayarları</p>
            </a>
            <a
              href="/admin/popup-mesaj"
              className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-6 border border-pink-100 hover:shadow-lg hover:scale-105 transition-all text-center group"
            >
              <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">📢</div>
              <p className="font-bold text-gray-900 text-sm">Popup Mesaj</p>
            </a>
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
    </div>
  );
}
