"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";

interface CoachWhatsAppStatus {
  id: string;
  name: string;
  email: string;
  whatsappConnected: boolean;
  whatsappConnecting: boolean;
  hasQRCode: boolean;
  whatsappPhoneNumber?: string;
}

export default function AdminSecurityPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [coaches, setCoaches] = useState<CoachWhatsAppStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (!user) {
        router.replace("/auth/login");
      } else if (userData?.role !== "admin") {
        router.replace("/home");
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  useEffect(() => {
    if (userData?.role === "admin") {
      fetchCoachesStatus();
      // Her 5 saniyede bir güncelle
      const interval = setInterval(fetchCoachesStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [userData]);

  const fetchCoachesStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/whatsapp/status-all");
      if (response.ok) {
        const data = await response.json();
        setCoaches(data.coaches || []);
      }
    } catch (error) {
      console.error("Coach durumları yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || userDataLoading || !user || userData?.role !== "admin") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const connectedCount = coaches.filter((c) => c.whatsappConnected).length;
  const connectingCount = coaches.filter((c) => c.whatsappConnecting).length;
  const disconnectedCount = coaches.filter(
    (c) => !c.whatsappConnected && !c.whatsappConnecting
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Security</h1>
          <p className="text-gray-600">WhatsApp Web bağlantı durumları</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/90 backdrop-blur-2xl rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Bağlı</p>
                <p className="text-2xl font-bold text-gray-900">{connectedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-2xl rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Bağlanıyor</p>
                <p className="text-2xl font-bold text-gray-900">{connectingCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-2xl rounded-2xl p-6 shadow-lg border border-white/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Bağlı Değil</p>
                <p className="text-2xl font-bold text-gray-900">{disconnectedCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coaches List */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-lg border border-white/50 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Coach Listesi</h2>
            <p className="text-sm text-gray-600 mt-1">Tüm coach'ların WhatsApp Web bağlantı durumları</p>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
              <p className="text-gray-600 mt-4">Yükleniyor...</p>
            </div>
          ) : coaches.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Henüz coach bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coach
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      E-posta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {coaches.map((coach) => (
                    <tr key={coach.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                            {coach.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{coach.name}</div>
                            <div className="text-xs text-gray-500">ID: {coach.id.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{coach.email || "-"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {coach.whatsappConnected ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                            Bağlı
                          </span>
                        ) : coach.whatsappConnecting ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <div className="w-2 h-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                            Bağlanıyor
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                            Bağlı Değil
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-3">
                          {coach.whatsappConnected ? (
                            <button
                              onClick={() => router.push(`/admin/security/whatsapp-messages?coachId=${coach.id}`)}
                              className="text-green-600 hover:text-green-800 font-medium flex items-center gap-2"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              Mesajları Görüntüle
                            </button>
                          ) : null}
                          <button
                            onClick={() => router.push(`/admin/coach-yonetimi?coachId=${coach.id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Detaylar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

