"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";

interface WhatsAppMessage {
  id: string;
  coachId: string;
  from: string;
  to: string | null;
  body: string;
  timestamp: number;
  isGroup: boolean;
  isMedia: boolean;
  mediaUrl: string | null;
  isFromCoach: boolean;
  createdAt: Timestamp | null;
  profilePicUrl: string | null; // WhatsApp profil fotoğrafı
  contactName: string | null; // WhatsApp contact adı
}

export default function WhatsAppMessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const coachId = searchParams.get("coachId");
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [coachName, setCoachName] = useState("");

  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (!user) {
        router.replace("/landing");
      } else if (userData?.role !== "admin") {
        router.replace("/home");
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  useEffect(() => {
    if (!coachId || userData?.role !== "admin") return;

    // Coach bilgilerini al
    const fetchCoachInfo = async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const coachRef = doc(db, "users", coachId);
        const coachSnap = await getDoc(coachRef);
        if (coachSnap.exists()) {
          setCoachName(coachSnap.data().name || "İsimsiz Coach");
        }
      } catch (error) {
        console.error("Coach bilgisi alınırken hata:", error);
      }
    };

    fetchCoachInfo();

    // WhatsApp mesajlarını dinle
    const messagesQuery = query(
      collection(db, "whatsapp_messages"),
      where("coachId", "==", coachId)
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messagesList: WhatsAppMessage[] = [];
        snapshot.forEach((doc) => {
          messagesList.push({
            id: doc.id,
            ...doc.data(),
          } as WhatsAppMessage);
        });
        // Client-side'da timestamp'e göre sırala (en yeni önce)
        messagesList.sort((a, b) => {
          const timestampA = a.timestamp || 0;
          const timestampB = b.timestamp || 0;
          return timestampB - timestampA; // Descending order
        });
        setMessages(messagesList);
        setLoading(false);
      },
      (error) => {
        console.error("Mesajlar yüklenirken hata:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [coachId, userData]);

  if (authLoading || userDataLoading || !user || userData?.role !== "admin") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  if (!coachId) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-400">Coach ID bulunamadı</div>
      </div>
    );
  }

  const formatPhoneNumber = (phone: string) => {
    // WhatsApp formatından normal formata çevir (örn: 905551234567@c.us -> 905551234567)
    return phone.replace("@c.us", "").replace("@g.us", "");
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/admin/security")}
            className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Geri Dön
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">WhatsApp Mesajları</h1>
          <p className="text-gray-600">Coach: {coachName}</p>
        </div>

        {/* Messages List */}
        <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-lg border border-white/50 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
              <p className="text-gray-600 mt-4">Mesajlar yükleniyor...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Henüz mesaj bulunamadı</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 max-h-[calc(100vh-300px)] overflow-y-auto">
              {messages.map((message) => (
                <div key={message.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start gap-4">
                    {/* Profile Photo */}
                    {message.profilePicUrl ? (
                      <img
                        src={message.profilePicUrl}
                        alt="WhatsApp Profile"
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-gray-200"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
                        message.isFromCoach 
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600" 
                          : "bg-gradient-to-br from-green-500 to-emerald-600"
                      }`}>
                        {message.isFromCoach 
                          ? "C" 
                          : (message.contactName || formatPhoneNumber(message.from || message.to || "")).charAt(0).toUpperCase()
                        }
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {message.isFromCoach 
                            ? "Coach (Gönderen)" 
                            : message.contactName || formatPhoneNumber(message.from || message.to || "")
                          }
                        </span>
                        {!message.isFromCoach && message.contactName && (
                          <span className="text-xs text-gray-500">
                            ({formatPhoneNumber(message.from || message.to || "")})
                          </span>
                        )}
                        {message.isGroup && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            Grup
                          </span>
                        )}
                        {message.isFromCoach && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            Gönderildi
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDate(message.timestamp)}
                        </span>
                      </div>
                      {message.isMedia ? (
                        <div className="space-y-2">
                          {message.mediaUrl ? (
                            <>
                              {message.mediaUrl.startsWith("data:image") ? (
                                <Image
                                  src={message.mediaUrl}
                                  alt="WhatsApp Media"
                                  width={300}
                                  height={300}
                                  className="rounded-lg max-w-full"
                                />
                              ) : (
                                <a
                                  href={message.mediaUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-600 hover:text-green-800 underline"
                                >
                                  Medya Dosyasını Görüntüle
                                </a>
                              )}
                              {message.body && message.body.trim() && (
                                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-2">
                                  {message.body}
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Medya mesajı (indirilemedi)</span>
                            </div>
                          )}
                        </div>
                      ) : message.body && message.body.trim() ? (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                          {message.body}
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-500 italic">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Mesaj içeriği yok (sadece emoji veya sistem mesajı olabilir)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

