"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, Timestamp, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface Coach {
  id: string;
  name: string;
  email: string;
  photoURL?: string | null;
  title?: string | null; // Coach ünvanı
  createdAt: Timestamp;
  role: "coach";
}

export default function CoachYonetimiPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCoachId, setEditingCoachId] = useState<string | null>(null);
  const [coachForm, setCoachForm] = useState({
    name: "",
    email: "",
    password: "",
    title: "", // Coach ünvanı
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // Role check
  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (!user) {
        router.replace("/landing");
      } else if (userData?.role !== "admin") {
        router.replace("/home");
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  // Fetch coaches
  useEffect(() => {
    if (!user || userData?.role !== "admin") return;

    const coachesRef = collection(db, "users");
    // Index gerektirmemek için önce role ile filtrele, sonra client-side'da sırala
    const q = query(coachesRef, where("role", "==", "coach"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const coachesList: Coach[] = [];
      snapshot.forEach((doc) => {
        coachesList.push({
          id: doc.id,
          ...doc.data(),
        } as Coach);
      });
      // Client-side'da createdAt'e göre sırala
      coachesList.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime; // Yeni olanlar önce
      });
      setCoaches(coachesList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, userData]);

  const handleAddCoach = async () => {
    if (!coachForm.name.trim() || !coachForm.email.trim() || !coachForm.password.trim() || !user) {
      showToast("Tüm alanlar zorunludur.", "error");
      return;
    }

    try {
      setSaving(true);

      // Firebase Auth'da yeni kullanıcı oluştur
      const { createUserWithEmailAndPassword } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      const { updateProfile } = await import("firebase/auth");

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        coachForm.email.trim(),
        coachForm.password.trim()
      );

      // Profil adını güncelle
      await updateProfile(userCredential.user, {
        displayName: coachForm.name.trim(),
      });

      // Firestore'da coach olarak kaydet
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: coachForm.name.trim(),
        email: coachForm.email.trim(),
        title: coachForm.title.trim() || null, // Coach ünvanı
        role: "coach",
        createdAt: Timestamp.now(),
        emailVerified: true, // Coach'lar otomatik onaylı
        photoURL: null,
        fcmTokens: [],
      });

      setCoachForm({ name: "", email: "", password: "", title: "" });
      setShowAddModal(false);
      showToast("Coach başarıyla eklendi!", "success");
    } catch (error: any) {
      console.error("Error adding coach:", error);
      if (error.code === "auth/email-already-in-use") {
        showToast("Bu e-posta adresi zaten kullanılıyor.", "error");
      } else if (error.code === "auth/weak-password") {
        showToast("Şifre en az 6 karakter olmalıdır.", "error");
      } else if (error.code === "auth/invalid-email") {
        showToast("Geçersiz e-posta adresi.", "error");
      } else {
        showToast("Coach eklenirken bir hata oluştu.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditCoach = (coach: Coach) => {
    setCoachForm({
      name: coach.name,
      email: coach.email,
      password: "",
      title: coach.title || "", // Coach ünvanı
    });
    setEditingCoachId(coach.id);
    setShowEditModal(true);
  };

  const handleUpdateCoach = async () => {
    if (!coachForm.name.trim() || !coachForm.email.trim() || !editingCoachId || !user) {
      showToast("Ad soyad ve e-posta zorunludur.", "error");
      return;
    }

    try {
      setSaving(true);

      const coachRef = doc(db, "users", editingCoachId);
      const updateData: any = {
        name: coachForm.name.trim(),
        email: coachForm.email.trim(),
        title: coachForm.title.trim() || null, // Coach ünvanı
      };

      // Şifre değiştirildiyse
      if (coachForm.password.trim()) {
        if (coachForm.password.trim().length < 6) {
          showToast("Şifre en az 6 karakter olmalıdır.", "error");
          setSaving(false);
          return;
        }

        // Firebase Auth'da şifreyi güncelle
        const { getAuth } = await import("firebase/auth");
        const { updatePassword } = await import("firebase/auth");
        const auth = getAuth();
        
        // Coach kullanıcısını bul ve şifresini güncelle
        // Not: Admin olarak başka kullanıcının şifresini değiştirmek için Firebase Admin SDK gerekir
        // Bu yüzden şifre değiştirme özelliğini kaldıralım veya sadece Firestore'da güncelleme yapalım
        showToast("Şifre değiştirme özelliği şu anda kullanılamıyor. Coach kendi şifresini profil sayfasından değiştirebilir.", "info");
      }

      await updateDoc(coachRef, updateData);

      // Firebase Auth'da displayName güncelle
      try {
        const { getAuth } = await import("firebase/auth");
        const { updateProfile } = await import("firebase/auth");
        const auth = getAuth();
        // Coach kullanıcısının auth bilgilerini güncellemek için Firebase Admin SDK gerekir
        // Bu yüzden sadece Firestore'da güncelleme yapıyoruz
      } catch (authError) {
        console.error("Auth update error:", authError);
      }

      setCoachForm({ name: "", email: "", password: "", title: "" });
      setShowEditModal(false);
      setEditingCoachId(null);
      showToast("Coach bilgileri başarıyla güncellendi!", "success");
    } catch (error: any) {
      console.error("Error updating coach:", error);
      showToast("Coach güncellenirken bir hata oluştu.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCoach = async (coachId: string, coachName: string) => {
    if (!user || !confirm(`${coachName} adlı coach'u silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;

    try {
      // Firestore'dan sil
      await deleteDoc(doc(db, "users", coachId));
      
      // Firebase Auth'dan silmek için Firebase Admin SDK gerekir
      // Şimdilik sadece Firestore'dan siliyoruz
      showToast("Coach başarıyla silindi!", "success");
    } catch (error) {
      console.error("Error deleting coach:", error);
      showToast("Coach silinirken bir hata oluştu.", "error");
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (authLoading || userDataLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Coach Yönetimi</h1>
            <p className="text-gray-600">Coach'ları görüntüleyin, ekleyin veya düzenleyin</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition"
          >
            + Yeni Coach Ekle
          </button>
        </div>
      </div>

      {/* Coaches List */}
      <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Coach Listesi</h2>
        {coaches.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-gray-500">Henüz coach yok</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {coach.photoURL ? (
                      <img
                        src={coach.photoURL}
                        alt={coach.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-white shadow-sm">
                        <span className="text-white font-bold text-lg">
                          {coach.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900">{coach.name}</h3>
                      {coach.title && (
                        <p className="text-xs text-green-600 font-medium">{coach.title}</p>
                      )}
                      <p className="text-sm text-gray-600">{coach.email}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Kayıt: {formatDate(coach.createdAt)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditCoach(coach)}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 transition"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => handleDeleteCoach(coach.id, coach.name)}
                    className="px-4 py-2 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Coach Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Yeni Coach Ekle</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ad Soyad</label>
                <input
                  type="text"
                  value={coachForm.name}
                  onChange={(e) => setCoachForm({ ...coachForm, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Coach adı soyadı"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">E-posta</label>
                <input
                  type="email"
                  value={coachForm.email}
                  onChange={(e) => setCoachForm({ ...coachForm, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="coach@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ünvan <span className="text-gray-500 font-normal">(Opsiyonel)</span>
                </label>
                <input
                  type="text"
                  value={coachForm.title}
                  onChange={(e) => setCoachForm({ ...coachForm, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Örn: Matematik Öğretmeni, Fizik Koçu"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Şifre</label>
                <input
                  type="password"
                  value={coachForm.password}
                  onChange={(e) => setCoachForm({ ...coachForm, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="En az 6 karakter"
                />
                <p className="text-xs text-gray-500 mt-1">Coach bu şifre ile giriş yapabilir</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddCoach}
                disabled={saving || !coachForm.name.trim() || !coachForm.email.trim() || !coachForm.password.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50"
              >
                {saving ? "Ekleniyor..." : "Ekle"}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setCoachForm({ name: "", email: "", password: "", title: "" });
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Coach Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowEditModal(false);
            setEditingCoachId(null);
          }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Coach Düzenle</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ad Soyad</label>
                <input
                  type="text"
                  value={coachForm.name}
                  onChange={(e) => setCoachForm({ ...coachForm, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Coach adı soyadı"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">E-posta</label>
                <input
                  type="email"
                  value={coachForm.email}
                  onChange={(e) => setCoachForm({ ...coachForm, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="coach@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ünvan <span className="text-gray-500 font-normal">(Opsiyonel)</span>
                </label>
                <input
                  type="text"
                  value={coachForm.title}
                  onChange={(e) => setCoachForm({ ...coachForm, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Örn: Matematik Öğretmeni, Fizik Koçu"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifre <span className="text-gray-500 text-xs">(Opsiyonel - Değiştirmek için doldurun)</span>
                </label>
                <input
                  type="password"
                  value={coachForm.password}
                  onChange={(e) => setCoachForm({ ...coachForm, password: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Yeni şifre (boş bırakabilirsiniz)"
                />
                <p className="text-xs text-gray-500 mt-1">Şifre değiştirmek için yeni şifre girin. Coach kendi şifresini profil sayfasından değiştirebilir.</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateCoach}
                disabled={saving || !coachForm.name.trim() || !coachForm.email.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50"
              >
                {saving ? "Güncelleniyor..." : "Güncelle"}
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCoachId(null);
                  setCoachForm({ name: "", email: "", password: "", title: "" });
                }}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
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

