"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface Kullanici {
  id: string;
  subscriptionPlan?: "trial" | "lite" | "premium";
  subscriptionStatus?: "trial" | "active" | "expired";
}

export default function AdminAboneliklerPage() {
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
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
    fetchKullanicilar();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const fetchKullanicilar = async () => {
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
    } catch (error) {      showToast("Kullanıcılar yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
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

  const trialUsers = kullanicilar.filter((u) => u.subscriptionPlan === "trial" || !u.subscriptionPlan).length;
  const liteUsers = kullanicilar.filter((u) => u.subscriptionPlan === "lite").length;
  const premiumUsers = kullanicilar.filter((u) => u.subscriptionPlan === "premium").length;
  const activeSubscriptions = kullanicilar.filter(
    (u) => u.subscriptionStatus === "active" && u.subscriptionPlan !== "trial"
  ).length;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Abonelik Yönetimi</h1>
        <p className="text-gray-600">Abonelik istatistikleri ve yönetimi</p>
      </div>

      {/* Stats */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden mb-8">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-200/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <p className="text-sm text-gray-600 font-medium mb-2">🆓 Trial Kullanıcılar</p>
              <p className="text-3xl font-bold text-blue-600">{trialUsers}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <p className="text-sm text-gray-600 font-medium mb-2">📚 Lite Kullanıcılar</p>
              <p className="text-3xl font-bold text-blue-600">{liteUsers}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-100">
              <p className="text-sm text-gray-600 font-medium mb-2">⭐ Premium Kullanıcılar</p>
              <p className="text-3xl font-bold text-yellow-600">{premiumUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Subscriptions */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-200/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Aktif Abonelikler</h2>
              <p className="text-sm text-gray-600">{activeSubscriptions} aktif abonelik</p>
            </div>
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

