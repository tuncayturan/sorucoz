"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, addDoc, updateDoc, doc, orderBy, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface ReferralCode {
  id: string;
  code: string;
  name: string;
  discountPercent: number;
  isActive: boolean;
  usageCount: number;
  maxUsage?: number;
  createdAt: Timestamp;
  createdBy?: string;
}

export default function ReferansKodlarPage() {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState({
    code: "",
    name: "",
    discountPercent: 10,
    maxUsage: "",
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

  useEffect(() => {
    fetchCodes();
  }, []);

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const codesRef = collection(db, "referralCodes");
      const q = query(codesRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const codesList: ReferralCode[] = [];
      snapshot.forEach((doc) => {
        codesList.push({
          id: doc.id,
          ...doc.data(),
        } as ReferralCode);
      });

      setCodes(codesList);
    } catch (error) {
      console.error("Referans kodları yüklenirken hata:", error);
      showToast("Kodlar yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const handleCreateCode = async () => {
    if (!newCode.code.trim() || !newCode.name.trim()) {
      showToast("Kod ve isim alanları zorunludur.", "error");
      return;
    }

    // Kodun benzersiz olduğunu kontrol et
    const existingCode = codes.find(
      (c) => c.code.toLowerCase() === newCode.code.toLowerCase().trim()
    );
    if (existingCode) {
      showToast("Bu kod zaten kullanılıyor. Farklı bir kod girin.", "error");
      return;
    }

    try {
      const codesRef = collection(db, "referralCodes");
      await addDoc(codesRef, {
        code: newCode.code.trim().toUpperCase(),
        name: newCode.name.trim(),
        discountPercent: newCode.discountPercent,
        isActive: true,
        usageCount: 0,
        maxUsage: newCode.maxUsage ? parseInt(newCode.maxUsage) : null,
        createdAt: Timestamp.now(),
      });

      showToast("Referans kodu başarıyla oluşturuldu!", "success");
      setShowCreateModal(false);
      setNewCode({ code: "", name: "", discountPercent: 10, maxUsage: "" });
      fetchCodes();
    } catch (error) {
      console.error("Kod oluşturulurken hata:", error);
      showToast("Kod oluşturulurken bir hata oluştu.", "error");
    }
  };

  const toggleCodeStatus = async (codeId: string, currentStatus: boolean) => {
    try {
      const codeRef = doc(db, "referralCodes", codeId);
      await updateDoc(codeRef, {
        isActive: !currentStatus,
      });

      showToast(`Kod ${!currentStatus ? "aktif" : "pasif"} edildi.`, "success");
      fetchCodes();
    } catch (error) {
      console.error("Kod durumu güncellenirken hata:", error);
      showToast("Kod durumu güncellenirken bir hata oluştu.", "error");
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Referans Kodları</h1>
          <p className="text-gray-600">Topluma reklam yaparken kullanabileceğiniz indirim kodlarını yönetin</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Kod Oluştur
        </button>
      </div>

      {/* Codes List */}
      <div className="grid grid-cols-1 gap-4">
        {codes.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-gray-500 font-semibold text-lg">Henüz referans kodu yok</p>
            <p className="text-gray-400 text-sm mt-1">Yeni bir kod oluşturarak başlayın</p>
          </div>
        ) : (
          codes.map((code) => (
            <div
              key={code.id}
              className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 hover:shadow-[0_15px_50px_rgba(0,0,0,0.12)] transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl text-lg">
                      {code.code}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{code.name}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        code.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {code.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4">
                      <p className="text-xs text-gray-600 mb-1">İndirim Oranı</p>
                      <p className="text-2xl font-bold text-blue-600">%{code.discountPercent}</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4">
                      <p className="text-xs text-gray-600 mb-1">Kullanım Sayısı</p>
                      <p className="text-2xl font-bold text-green-600">{code.usageCount}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4">
                      <p className="text-xs text-gray-600 mb-1">Maksimum Kullanım</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {code.maxUsage ? code.maxUsage : "∞"}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-4">
                      <p className="text-xs text-gray-600 mb-1">Oluşturulma</p>
                      <p className="text-sm font-bold text-gray-700">{formatDate(code.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="ml-4">
                  <button
                    onClick={() => toggleCodeStatus(code.id, code.isActive)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                      code.isActive
                        ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    {code.isActive ? "Pasif Yap" : "Aktif Yap"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setShowCreateModal(false)}
          ></div>
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div
              className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-white/70 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Yeni Referans Kodu</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kod Adı
                  </label>
                  <input
                    type="text"
                    value={newCode.name}
                    onChange={(e) => setNewCode({ ...newCode, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all"
                    placeholder="Örn: Topluluk İndirimi"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kod
                  </label>
                  <input
                    type="text"
                    value={newCode.code}
                    onChange={(e) =>
                      setNewCode({ ...newCode, code: e.target.value.toUpperCase() })
                    }
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all font-mono"
                    placeholder="Örn: TOPLULUK10"
                    maxLength={20}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Kod otomatik olarak büyük harfe dönüştürülür
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    İndirim Oranı (%)
                  </label>
                  <input
                    type="number"
                    value={newCode.discountPercent}
                    onChange={(e) =>
                      setNewCode({ ...newCode, discountPercent: parseInt(e.target.value) || 10 })
                    }
                    min="1"
                    max="100"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Maksimum Kullanım (Opsiyonel)
                  </label>
                  <input
                    type="number"
                    value={newCode.maxUsage}
                    onChange={(e) => setNewCode({ ...newCode, maxUsage: e.target.value })}
                    min="1"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all"
                    placeholder="Boş bırakırsanız sınırsız olur"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Boş bırakırsanız kod sınırsız kullanılabilir
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewCode({ code: "", name: "", discountPercent: 10, maxUsage: "" });
                  }}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  İptal
                </button>
                <button
                  onClick={handleCreateCode}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-lg transition-all"
                >
                  Oluştur
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
