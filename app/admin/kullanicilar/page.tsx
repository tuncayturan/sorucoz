"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, doc, updateDoc, deleteDoc, Timestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";
import * as XLSX from "xlsx";

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

interface NewUser {
  name: string;
  email: string;
  password?: string;
}

interface CreateUserResult {
  success: Array<{ email: string; name: string; password: string; uid: string }>;
  errors: Array<{ email: string; error: string }>;
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

  // Kullanıcı ekleme için state'ler
  const [showAddUserSection, setShowAddUserSection] = useState(false);
  const [addUserMode, setAddUserMode] = useState<"single" | "bulk">("single");
  const [newUser, setNewUser] = useState<NewUser>({ name: "", email: "", password: "" });
  const [bulkUsers, setBulkUsers] = useState<NewUser[]>([]);
  const [uploading, setUploading] = useState(false);
  const [createResults, setCreateResults] = useState<CreateUserResult | null>(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());

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

  // Excel dosyası yükleme
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const users: NewUser[] = jsonData.map((row) => ({
          name: row["Ad Soyad"] || row["name"] || row["Name"] || "",
          email: row["Email"] || row["email"] || row["E-posta"] || "",
          password: row["Şifre"] || row["password"] || row["Password"] || "",
        })).filter(user => user.name && user.email);

        setBulkUsers(users);
        showToast(`${users.length} kullanıcı yüklendi!`, "success");
      } catch (error) {
        console.error("Excel okuma hatası:", error);
        showToast("Excel dosyası okunamadı!", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Tekli kullanıcı ekleme
  const handleAddSingleUser = async () => {
    if (!newUser.name || !newUser.email) {
      showToast("Ad Soyad ve Email gereklidir!", "error");
      return;
    }

    try {
      setUploading(true);
      const response = await fetch("/api/admin/create-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: [newUser] }),
      });

      const data = await response.json();
      setCreateResults(data.results);

      if (data.results.success.length > 0) {
        showToast("Kullanıcı başarıyla eklendi!", "success");
        setNewUser({ name: "", email: "", password: "" });
        await fetchKullanicilar();
      } else {
        showToast(data.results.errors[0]?.error || "Kullanıcı eklenemedi!", "error");
      }
    } catch (error) {
      console.error("Kullanıcı ekleme hatası:", error);
      showToast("Bir hata oluştu!", "error");
    } finally {
      setUploading(false);
    }
  };

  // Toplu kullanıcı ekleme
  const handleAddBulkUsers = async () => {
    if (bulkUsers.length === 0) {
      showToast("Lütfen Excel dosyası yükleyin!", "error");
      return;
    }

    try {
      setUploading(true);
      const response = await fetch("/api/admin/create-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: bulkUsers }),
      });

      const data = await response.json();
      setCreateResults(data.results);

      if (data.results.success.length > 0) {
        showToast(`${data.results.success.length} kullanıcı başarıyla eklendi!`, "success");
        setBulkUsers([]);
        setFileInputKey(Date.now()); // File input'u sıfırla
        await fetchKullanicilar();
      }

      if (data.results.errors.length > 0) {
        showToast(`${data.results.errors.length} kullanıcı eklenemedi!`, "error");
      }
    } catch (error) {
      console.error("Toplu kullanıcı ekleme hatası:", error);
      showToast("Bir hata oluştu!", "error");
    } finally {
      setUploading(false);
    }
  };

  // Ekleme alanını kapat ve temizle
  const closeAddSection = () => {
    setShowAddUserSection(false);
    setNewUser({ name: "", email: "", password: "" });
    setBulkUsers([]);
    setCreateResults(null);
    setAddUserMode("single");
    setFileInputKey(Date.now()); // File input'u sıfırla
  };

  // Excel şablonu indir
  const downloadExcelTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        "Ad Soyad": "Ahmet Yılmaz",
        "Email": "ahmet@example.com",
        "Şifre": ""
      },
      {
        "Ad Soyad": "Ayşe Demir",
        "Email": "ayse@example.com",
        "Şifre": "OzelSifre123"
      }
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kullanıcılar");
    XLSX.writeFile(workbook, "kullanici-sablonu.xlsx");
    showToast("Şablon indirildi!", "success");
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
      <div className="mb-8 flex items-center justify-between">
        <div>
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
        <button
          onClick={() => {
            if (showAddUserSection) {
              closeAddSection();
            } else {
              setNewUser({ name: "", email: "", password: "" });
              setBulkUsers([]);
              setCreateResults(null);
              setAddUserMode("single");
              setShowAddUserSection(true);
            }
          }}
          className={`px-6 py-3 ${
            showAddUserSection 
              ? "bg-gray-500 hover:bg-gray-600" 
              : "bg-gradient-to-r from-blue-500 to-indigo-600"
          } text-white font-bold rounded-xl hover:shadow-lg transition-all flex items-center gap-2`}
        >
          {showAddUserSection ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Kapat
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Kullanıcı Ekle
            </>
          )}
        </button>
      </div>

      {/* Kullanıcı Ekleme Bölümü */}
      {showAddUserSection && (
        <div className="mb-6 bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 animate-slideFade">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Kullanıcı Ekle</h2>
            
            {/* Mode Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setAddUserMode("single");
                  setCreateResults(null);
                }}
                className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
                  addUserMode === "single"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Tekli Ekleme
                </span>
              </button>
              <button
                onClick={() => {
                  setAddUserMode("bulk");
                  setCreateResults(null);
                }}
                className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
                  addUserMode === "bulk"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Toplu Ekleme (Excel)
                </span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {addUserMode === "single" ? (
              // Tekli Ekleme Formu
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Ad Soyad *</label>
                  <input
                    type="text"
                    value={newUser?.name || ""}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                    placeholder="Örn: Ahmet Yılmaz"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={newUser?.email || ""}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                    placeholder="ornek@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Şifre (Opsiyonel)</label>
                  <input
                    type="text"
                    value={newUser?.password || ""}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                    placeholder="Boş bırakırsanız otomatik oluşturulur"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    💡 Şifre boş bırakılırsa sistem otomatik olarak güçlü bir şifre oluşturur
                  </p>
                  <p className="text-sm text-green-600 mt-1 font-semibold">
                    ✅ Email otomatik olarak onaylanmış olacak
                  </p>
                </div>
                
                {/* Tekli Ekleme Butonu */}
                <button
                  onClick={handleAddSingleUser}
                  disabled={uploading || !newUser?.name || !newUser?.email}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>İşleniyor...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Kullanıcı Ekle</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              // Toplu Ekleme (Excel)
              <div className="space-y-4">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Excel Formatı
                    </h3>
                    <button
                      onClick={downloadExcelTemplate}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Şablon İndir
                    </button>
                  </div>
                  <p className="text-sm text-blue-800 mb-3">Excel dosyanız aşağıdaki sütunları içermelidir:</p>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside mb-3">
                    <li><strong>Ad Soyad</strong> - Zorunlu</li>
                    <li><strong>Email</strong> - Zorunlu</li>
                    <li><strong>Şifre</strong> - Opsiyonel (boş bırakılırsa otomatik oluşturulur)</li>
                  </ul>
                  <p className="text-sm text-green-700 font-semibold bg-green-50 p-2 rounded-lg">
                    ✅ Tüm kullanıcıların email'leri otomatik olarak onaylanmış olacak
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Excel Dosyası Yükle</label>
                  <input
                    key={fileInputKey}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-blue-500 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                {bulkUsers.length > 0 && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
                    <p className="text-green-800 font-bold mb-2">
                      ✅ {bulkUsers.length} kullanıcı hazır
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {bulkUsers.slice(0, 5).map((user, index) => (
                        <div key={index} className="text-sm text-green-700 bg-white/50 rounded-lg p-2">
                          <strong>{user.name}</strong> - {user.email}
                          {user.password && " (Özel şifre)"}
                        </div>
                      ))}
                      {bulkUsers.length > 5 && (
                        <p className="text-sm text-green-600 font-semibold">
                          + {bulkUsers.length - 5} kullanıcı daha...
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Toplu Ekleme Butonu */}
                <button
                  onClick={handleAddBulkUsers}
                  disabled={uploading || bulkUsers.length === 0}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>İşleniyor...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{bulkUsers.length} Kullanıcı Ekle</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Results Display */}
            {createResults && (
              <div className="mt-6 space-y-4">
                {createResults.success.length > 0 && (
                  <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
                    <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Başarıyla Eklenen Kullanıcılar ({createResults.success.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {createResults.success.map((user, index) => (
                        <div key={index} className="bg-white rounded-lg p-3 text-sm">
                          <p className="font-bold text-gray-900">{user.name}</p>
                          <p className="text-gray-600">{user.email}</p>
                          <p className="text-green-700 font-mono text-xs mt-1">
                            Şifre: <strong>{user.password}</strong>
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-green-700 mt-3 font-semibold">
                      ⚠️ Bu şifreleri kaydedin! Kullanıcılara iletilmesi gerekiyor.
                    </p>
                  </div>
                )}

                {createResults.errors.length > 0 && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                    <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Hata Alan Kullanıcılar ({createResults.errors.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {createResults.errors.map((error, index) => (
                        <div key={index} className="bg-white rounded-lg p-3 text-sm">
                          <p className="font-bold text-gray-900">{error.email}</p>
                          <p className="text-red-600">{error.error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
            value={searchQuery || ""}
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
                          value={editData?.role || kullanici.role || "student"}
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
                            value={editData?.subscriptionPlan || kullanici.subscriptionPlan || "trial"}
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

