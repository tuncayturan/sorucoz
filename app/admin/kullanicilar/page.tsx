"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface Kullanici {
  id: string;
  name: string;
  email: string;
  role: "student" | "coach" | "admin";
  premium: boolean;
  subscriptionPlan?: "trial" | "lite" | "premium";
  subscriptionStatus?: "trial" | "active" | "expired";
  createdAt: any;
  photoURL?: string | null;
}

export default function AdminKullanicilarPage() {
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [filteredKullanicilar, setFilteredKullanicilar] = useState<Kullanici[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Kullanici>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: string; userName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      // Sadece öğrencileri getir (orderBy kaldırıldı, client-side sıralama yapılacak)
      const q = query(usersRef, where("role", "==", "student"));
      const snapshot = await getDocs(q);

      const users: Kullanici[] = [];
      snapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data(),
        } as Kullanici);
      });

      // Client-side'da tarihe göre sırala (en yeni önce)
      users.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime; // Descending order
      });

      setKullanicilar(users);
      setFilteredKullanicilar(users);
    } catch (error) {
      console.error("Kullanıcılar yüklenirken hata:", error);
      showToast("Kullanıcılar yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Arama fonksiyonu - dinamik filtreleme
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredKullanicilar(kullanicilar);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = kullanicilar.filter((kullanici) => {
      const nameMatch = kullanici.name?.toLowerCase().includes(query);
      const emailMatch = kullanici.email?.toLowerCase().includes(query);
      return nameMatch || emailMatch;
    });

    setFilteredKullanicilar(filtered);
  }, [searchQuery, kullanicilar]);

  const handleUpdateUser = async (userId: string) => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, editData);
      showToast("Kullanıcı güncellendi!", "success");
      setEditingUser(null);
      setEditData({});
      await fetchKullanicilar();
    } catch (error) {
      console.error("Güncelleme hatası:", error);
      showToast("Güncelleme başarısız!", "error");
    }
  };

  const handleDeleteClick = (userId: string, userName: string) => {
    const user = kullanicilar.find(u => u.id === userId);
    setDeleteConfirm({ userId, userName: user?.name || userName });
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      await deleteDoc(doc(db, "users", deleteConfirm.userId));
      showToast(`${deleteConfirm.userName} kullanıcısı başarıyla silindi!`, "success");
      setDeleteConfirm(null);
      await fetchKullanicilar();
    } catch (error) {
      console.error("Silme hatası:", error);
      showToast("Kullanıcı silinirken bir hata oluştu!", "error");
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (user: Kullanici) => {
    setEditingUser(user.id);
    setEditData({
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
    });
  };

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Kullanıcılar</h1>
        <p className="text-gray-600">
          {searchQuery ? (
            <>
              <span className="font-semibold">{filteredKullanicilar.length}</span> sonuç bulundu
              {filteredKullanicilar.length !== kullanicilar.length && (
                <span className="text-gray-400"> (Toplam {kullanicilar.length} öğrenci)</span>
              )}
            </>
          ) : (
            <>Toplam {kullanicilar.length} kayıtlı öğrenci</>
          )}
        </p>
      </div>

      {/* Search Bar - iOS Style */}
      <div className="mb-6 bg-gray-50/50 rounded-3xl p-5 border border-gray-100/50">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-4 rounded-2xl border-2 border-gray-200/80 bg-white/90 backdrop-blur-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all text-base font-medium"
            placeholder="İsim veya e-posta ile ara..."
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-200/20 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredKullanicilar.length === 0 && searchQuery ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-semibold text-lg">Sonuç bulunamadı</p>
                <p className="text-gray-400 text-sm mt-1">"{searchQuery}" için eşleşen öğrenci bulunamadı</p>
              </div>
            ) : filteredKullanicilar.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-semibold text-lg">Henüz öğrenci yok</p>
                <p className="text-gray-400 text-sm mt-1">Kayıtlı öğrenci bulunmamaktadır</p>
              </div>
            ) : (
              filteredKullanicilar.map((kullanici) => (
                <div
                  key={kullanici.id}
                  className="bg-gradient-to-br from-gray-50 to-white backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-white/50 hover:shadow-md transition-all"
                >
                {editingUser === kullanici.id ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      {kullanici.photoURL ? (
                        <img
                          src={kullanici.photoURL}
                          alt={kullanici.name}
                          className="w-12 h-12 rounded-xl object-cover border-2 border-blue-200 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                          {kullanici.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{kullanici.name}</p>
                        <p className="text-sm text-gray-600 font-medium">{kullanici.email}</p>
                      </div>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Rol</label>
                        <select
                          value={editData.role || kullanici.role}
                          onChange={(e) => setEditData({ ...editData, role: e.target.value as any })}
                          className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="student">Öğrenci</option>
                          <option value="coach">Koç</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      {kullanici.role === "student" && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Plan</label>
                          <select
                            value={editData.subscriptionPlan || kullanici.subscriptionPlan || "trial"}
                            onChange={(e) => setEditData({ ...editData, subscriptionPlan: e.target.value as any })}
                            className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="trial">Trial</option>
                            <option value="lite">Lite</option>
                            <option value="premium">Premium</option>
                          </select>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleUpdateUser(kullanici.id)}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition"
                        >
                          Kaydet
                        </button>
                        <button
                          onClick={() => {
                            setEditingUser(null);
                            setEditData({});
                          }}
                          className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
                        >
                          İptal
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {kullanici.photoURL ? (
                        <img
                          src={kullanici.photoURL}
                          alt={kullanici.name}
                          className="w-12 h-12 rounded-xl object-cover border-2 border-blue-200 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                          {kullanici.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{kullanici.name}</p>
                        <p className="text-sm text-gray-600 font-medium">{kullanici.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                            kullanici.role === "admin" ? "bg-red-100 text-red-700" :
                            kullanici.role === "coach" ? "bg-green-100 text-green-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {kullanici.role === "admin" ? "Admin" : kullanici.role === "coach" ? "Koç" : "Öğrenci"}
                          </span>
                          {kullanici.role === "student" && kullanici.subscriptionPlan === "premium" && (
                            <span className="text-xs px-2 py-1 rounded-full font-bold bg-yellow-100 text-yellow-700">
                              ⭐ Premium
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {kullanici.role === "student" && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500 font-medium mb-1">Plan</p>
                          <p className="text-sm font-bold text-gray-900">
                            {kullanici.subscriptionPlan === "premium" ? "⭐ Premium" :
                             kullanici.subscriptionPlan === "lite" ? "📚 Lite" : "🆓 Trial"}
                          </p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(kullanici)}
                          className="p-2 rounded-xl bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(kullanici.id, kullanici.name)}
                          className="p-2 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-[0_20px_60px_rgba(0,0,0,0.3)] relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-200/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Kullanıcıyı Sil</h2>
                  <p className="text-sm text-gray-600">Bu işlem geri alınamaz</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700">
                  <span className="font-semibold">{deleteConfirm.userName}</span> kullanıcısını silmek istediğinizden emin misiniz?
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Bu kullanıcının tüm verileri kalıcı olarak silinecektir.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  İptal
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Siliniyor...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Sil</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
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

