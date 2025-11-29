"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface Odeme {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  plan: "lite" | "premium";
  status: "pending" | "completed" | "failed" | "refunded";
  paymentMethod: string;
  createdAt: Timestamp;
  transactionId?: string;
}

export default function AdminOdemeGecmisiPage() {
  const [odemeler, setOdemeler] = useState<Odeme[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "failed">("all");
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
    fetchOdemeler();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const fetchOdemeler = async () => {
    try {
      setLoading(true);
      // Not: Gerçek uygulamada payments collection'ı olmalı
      // Şimdilik örnek veri gösteriyoruz
      const paymentsRef = collection(db, "payments");
      const q = query(paymentsRef, orderBy("createdAt", "desc"), limit(100));
      const snapshot = await getDocs(q);

      const payments: Odeme[] = [];
      snapshot.forEach((doc) => {
        payments.push({
          id: doc.id,
          ...doc.data(),
        } as Odeme);
      });

      setOdemeler(payments);
    } catch (error) {
      console.error("Ödemeler yüklenirken hata:", error);
      // Collection yoksa boş liste göster
      setOdemeler([]);
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

  const filteredOdemeler = filter === "all" 
    ? odemeler 
    : odemeler.filter((o) => o.status === filter);

  const totalRevenue = filteredOdemeler
    .filter((o) => o.status === "completed")
    .reduce((sum, o) => sum + o.amount, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Ödeme Geçmişi</h1>
        <p className="text-gray-600">Tüm ödeme işlemlerini görüntüleyin</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
          <p className="text-sm text-gray-600 font-medium mb-2">Toplam Gelir</p>
          <p className="text-2xl font-bold text-green-600">{totalRevenue.toLocaleString("tr-TR")}₺</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
          <p className="text-sm text-gray-600 font-medium mb-2">Tamamlanan</p>
          <p className="text-2xl font-bold text-blue-600">
            {filteredOdemeler.filter((o) => o.status === "completed").length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-100">
          <p className="text-sm text-gray-600 font-medium mb-2">Bekleyen</p>
          <p className="text-2xl font-bold text-yellow-600">
            {filteredOdemeler.filter((o) => o.status === "pending").length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-6 border border-red-100">
          <p className="text-sm text-gray-600 font-medium mb-2">Başarısız</p>
          <p className="text-2xl font-bold text-red-600">
            {filteredOdemeler.filter((o) => o.status === "failed").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {(["all", "pending", "completed", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition ${
              filter === f
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "Tümü" : f === "pending" ? "Bekleyen" : f === "completed" ? "Tamamlanan" : "Başarısız"}
          </button>
        ))}
      </div>

      {/* Payments List */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 overflow-hidden">
        {filteredOdemeler.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 font-medium">Henüz ödeme kaydı yok</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Kullanıcı</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Plan</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Tutar</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Durum</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Yöntem</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOdemeler.map((odeme) => {
                  const statusColors = {
                    pending: "bg-yellow-100 text-yellow-700",
                    completed: "bg-green-100 text-green-700",
                    failed: "bg-red-100 text-red-700",
                    refunded: "bg-gray-100 text-gray-700",
                  };

                  return (
                    <tr key={odeme.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900">{odeme.userName || "Kullanıcı"}</p>
                          <p className="text-sm text-gray-600">{odeme.userEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          odeme.plan === "premium" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {odeme.plan === "premium" ? "⭐ Premium" : "📚 Lite"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{odeme.amount}₺</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[odeme.status]}`}>
                          {odeme.status === "pending" ? "Bekleyen" : 
                           odeme.status === "completed" ? "Tamamlandı" : 
                           odeme.status === "failed" ? "Başarısız" : "İade"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">{odeme.paymentMethod || "Manuel"}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{formatTarih(odeme.createdAt)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

