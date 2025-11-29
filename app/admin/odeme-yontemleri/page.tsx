"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface OdemeYontemi {
  id: string;
  name: string;
  enabled: boolean;
  apiKey?: string;
  secretKey?: string;
  testMode: boolean;
  description?: string;
}

export default function AdminOdemeYontemleriPage() {
  const [odemeYontemleri, setOdemeYontemleri] = useState<OdemeYontemi[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<OdemeYontemi>>({});
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
    fetchOdemeYontemleri();
  }, []);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const fetchOdemeYontemleri = async () => {
    try {
      setLoading(true);
      const settingsRef = doc(db, "adminSettings", "paymentMethods");
      const snapshot = await getDoc(settingsRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        setOdemeYontemleri(data.methods || []);
      } else {
        // Varsayılan ödeme yöntemleri
        const defaultMethods: OdemeYontemi[] = [
          {
            id: "iyzico",
            name: "iyzico",
            enabled: false,
            testMode: true,
            description: "Türkiye'de en popüler ödeme çözümü - Vergi levhası gerektirmez (Bireysel hesap açılabilir)",
          },
          {
            id: "paytr",
            name: "PayTR",
            enabled: false,
            testMode: true,
            description: "Türkiye'ye özel ödeme sistemi - Vergi levhası gerektirmez",
          },
          {
            id: "papara",
            name: "Papara",
            enabled: false,
            testMode: true,
            description: "Türkiye'de popüler dijital cüzdan - Vergi levhası gerektirmez",
          },
          {
            id: "stripe",
            name: "Stripe",
            enabled: false,
            testMode: true,
            description: "Uluslararası ödeme sistemi - Türkiye'de sınırlı (Vergi levhası gerektirmez)",
          },
          {
            id: "manual",
            name: "Manuel Ödeme",
            enabled: true,
            testMode: false,
            description: "Manuel ödeme onayı (admin tarafından)",
          },
        ];
        await setDoc(settingsRef, { methods: defaultMethods });
        setOdemeYontemleri(defaultMethods);
      }
    } catch (error) {
      console.error("Ödeme yöntemleri yüklenirken hata:", error);
      showToast("Ödeme yöntemleri yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async (id: string) => {
    try {
      const updated = odemeYontemleri.map((method) =>
        method.id === id ? { ...method, enabled: !method.enabled } : method
      );
      setOdemeYontemleri(updated);

      const settingsRef = doc(db, "adminSettings", "paymentMethods");
      await setDoc(settingsRef, { methods: updated });

      showToast("Ödeme yöntemi güncellendi!", "success");
    } catch (error) {
      console.error("Güncelleme hatası:", error);
      showToast("Güncelleme başarısız!", "error");
      fetchOdemeYontemleri();
    }
  };

  const startEdit = (method: OdemeYontemi) => {
    setEditing(method.id);
    setEditData({
      apiKey: method.apiKey || "",
      secretKey: method.secretKey || "",
      testMode: method.testMode,
      description: method.description || "",
    });
  };

  const saveEdit = async (id: string) => {
    try {
      const updated = odemeYontemleri.map((method) =>
        method.id === id
          ? {
              ...method,
              ...editData,
            }
          : method
      );
      setOdemeYontemleri(updated);

      const settingsRef = doc(db, "adminSettings", "paymentMethods");
      await setDoc(settingsRef, { methods: updated });

      showToast("Ayarlar kaydedildi!", "success");
      setEditing(null);
      setEditData({});
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      showToast("Kaydetme başarısız!", "error");
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditData({});
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-12 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Ödeme Yöntemleri</h1>
        <p className="text-gray-600">Ödeme entegrasyonlarını yönetin</p>
      </div>

      {/* Payment Methods List */}
      <div className="space-y-4">
        {odemeYontemleri.map((method) => (
          <div
            key={method.id}
            className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-200/20 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <span className="text-2xl">💳</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{method.name}</h3>
                      {method.description && (
                        <p className="text-sm text-gray-600 mt-1">{method.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold ${
                      method.testMode ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                    }`}
                  >
                    {method.testMode ? "Test Modu" : "Canlı Mod"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={method.enabled}
                      onChange={() => toggleEnabled(method.id)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
              </div>

              {editing === method.id ? (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      API Key
                    </label>
                    <input
                      type="text"
                      value={editData.apiKey || ""}
                      onChange={(e) => setEditData({ ...editData, apiKey: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="API Key girin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Secret Key
                    </label>
                    <input
                      type="password"
                      value={editData.secretKey || ""}
                      onChange={(e) => setEditData({ ...editData, secretKey: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Secret Key girin"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editData.testMode}
                      onChange={(e) => setEditData({ ...editData, testMode: e.target.checked })}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <label className="text-sm text-gray-700">Test Modu</label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => saveEdit(method.id)}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transition"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => startEdit(method)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition"
                  >
                    Ayarları Düzenle
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Cards */}
      <div className="mt-8 space-y-4">
        {/* Ödeme Yöntemleri Önerileri */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50/80 backdrop-blur-xl rounded-3xl p-6 border border-green-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-xl">💡</span>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-2">Vergi Levhası Olmadan Ödeme Yöntemleri</h4>
              <div className="space-y-3 text-sm text-gray-700">
                <div>
                  <p className="font-semibold text-gray-900 mb-1">1. iyzico (Önerilen)</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                    <li>Bireysel hesap açılabilir (vergi levhası gerektirmez)</li>
                    <li>Türkiye'de en yaygın kullanılan ödeme sistemi</li>
                    <li>Kolay entegrasyon ve iyi dokümantasyon</li>
                    <li>Komisyon: ~%2.9 + 0.25₺ (kredi kartı)</li>
                    <li>Başvuru: <a href="https://merchant.iyzipay.com" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">merchant.iyzipay.com</a></li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">2. PayTR</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                    <li>Bireysel hesap açılabilir</li>
                    <li>Türkiye'ye özel, kolay kurulum</li>
                    <li>Komisyon: ~%2.5 + 0.25₺</li>
                    <li>Başvuru: <a href="https://www.paytr.com" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">www.paytr.com</a></li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-1">3. Papara</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                    <li>Bireysel hesap açılabilir</li>
                    <li>Türkiye'de popüler dijital cüzdan</li>
                    <li>Düşük komisyon oranları</li>
                    <li>Başvuru: <a href="https://www.papara.com" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">www.papara.com</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Önemli Bilgiler */}
        <div className="bg-blue-50/80 backdrop-blur-xl rounded-3xl p-6 border border-blue-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">Önemli Bilgiler</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• API anahtarları güvenli bir şekilde saklanır</li>
                <li>• Test modunda gerçek ödeme alınmaz</li>
                <li>• Canlı moda geçmeden önce test yapın</li>
                <li>• Manuel ödeme her zaman aktif kalır</li>
                <li>• <strong>Yasal Uyarı:</strong> Vergi levhası olmadan ödeme almak mümkün olsa da, gelir elde ettiğinizde vergi yükümlülükleriniz olabilir. Bir muhasebeciye danışmanız önerilir.</li>
              </ul>
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

