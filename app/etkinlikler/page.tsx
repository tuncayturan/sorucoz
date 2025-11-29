"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import StudentFooter from "@/components/StudentFooter";
import { collection, query, where, orderBy, getDocs, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Event {
  id: string;
  title: string;
  description?: string;
  date: Timestamp;
  type: "meeting" | "other";
  zoomLink?: string;
  createdAt: Timestamp;
  coachId: string;
  coachName: string;
  coachPhotoURL?: string | null;
}

export default function EtkinliklerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Role kontrolü
  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (!user) {
        router.replace("/auth/login");
      } else if (userData?.role !== "student") {
        if (userData?.role === "admin") {
          router.replace("/admin");
        } else if (userData?.role === "coach") {
          router.replace("/coach");
        }
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  // Etkinlikleri real-time çek
  useEffect(() => {
    if (!user || userData?.role !== "student") return;

    setLoading(true);
    const unsubscribeFunctions: (() => void)[] = [];
    const coachesMap = new Map<string, { name: string; photoURL?: string | null }>();

    const setupEventListeners = async () => {
      try {
        // Tüm coach'ları bul
        const usersRef = collection(db, "users");
        const coachesQuery = query(usersRef, where("role", "==", "coach"));
        const coachesSnapshot = await getDocs(coachesQuery);

        // Coach isimlerini ve profil resimlerini kaydet
        coachesSnapshot.docs.forEach((coachDoc) => {
          const coachData = coachDoc.data();
          coachesMap.set(coachDoc.id, {
            name: coachData.name || "Coach",
            photoURL: coachData.photoURL || null,
          });
        });

        // Her coach'un etkinliklerini real-time dinle
        coachesSnapshot.docs.forEach((coachDoc) => {
          const coachId = coachDoc.id;
          const eventsRef = collection(db, "users", coachId, "events");
          const eventsQuery = query(eventsRef, orderBy("date", "asc"));

          const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
            setEvents((prevEvents) => {
              // Bu coach'un eski etkinliklerini kaldır
              const filtered = prevEvents.filter((e) => e.coachId !== coachId);
              const now = new Date();

              // Tüm etkinlikleri ekle (gelecek ve geçmiş)
              snapshot.forEach((eventDoc) => {
                const eventData = eventDoc.data();
                const coachInfo = coachesMap.get(coachId) || { name: "Coach", photoURL: null };
                filtered.push({
                  id: eventDoc.id,
                  coachId,
                  coachName: coachInfo.name,
                  coachPhotoURL: coachInfo.photoURL,
                  ...eventData,
                  date: eventData.date,
                } as Event);
              });

              // Tarihe göre sırala
              filtered.sort((a, b) => {
                const aTime = a.date?.toDate?.()?.getTime() || 0;
                const bTime = b.date?.toDate?.()?.getTime() || 0;
                return aTime - bTime;
              });

              return filtered;
            });
            setLoading(false);
          });

          unsubscribeFunctions.push(unsubscribe);
        });

        // Eğer coach yoksa loading'i kapat
        if (coachesSnapshot.docs.length === 0) {
          setLoading(false);
        }
      } catch (error) {
        console.error("Etkinlikler yüklenirken hata:", error);
        setLoading(false);
      }
    };

    setupEventListeners();

    return () => {
      unsubscribeFunctions.forEach((unsub) => unsub());
    };
  }, [user, userData]);

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      setShowScrollTop(scrollPosition > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const formatEventDate = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events.filter((event) => {
      const eventDate = event.date?.toDate?.() || new Date(event.date?.seconds * 1000);
      return eventDate >= now;
    });
  };

  const getPastEvents = () => {
    const now = new Date();
    return events.filter((event) => {
      const eventDate = event.date?.toDate?.() || new Date(event.date?.seconds * 1000);
      return eventDate < now;
    });
  };

  if (authLoading || userDataLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-12 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/50 text-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500 font-medium">Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  const upcomingEvents = getUpcomingEvents();
  const pastEvents = getPastEvents();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header - iOS Premium Style */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Etkinlikler</h1>
          <p className="text-gray-600 text-lg">Yaklaşan ve planlanan tüm etkinlikler</p>
        </div>

        {/* Yaklaşan Etkinlikler - iOS Premium Cards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></div>
            <span>Yaklaşan Etkinlikler</span>
          </h2>
          {upcomingEvents.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-2xl rounded-[2rem] p-16 shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-white/70 text-center relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-200/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-semibold text-lg">Henüz yaklaşan etkinlik yok</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => {
                const eventDate = event.date?.toDate?.() || new Date(event.date?.seconds * 1000);
                const isToday = new Date().toDateString() === eventDate.toDateString();
                const isTomorrow = new Date(Date.now() + 86400000).toDateString() === eventDate.toDateString();

                return (
                  <div
                    key={event.id}
                    className="bg-white/95 backdrop-blur-3xl rounded-[2rem] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-white/60 hover:shadow-[0_25px_70px_rgba(0,0,0,0.12)] transition-all relative overflow-hidden group"
                  >
                    {/* Decorative gradient */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-green-200/30 to-emerald-200/30 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
                    
                    <div className="relative z-10">
                      {/* Badge */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                          event.type === "meeting"
                            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {event.type === "meeting" ? "🎥 Canlı Toplantı" : "📅 Diğer"}
                        </span>
                        {(isToday || isTomorrow) && (
                          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
                            {isToday ? "Bugün" : "Yarın"}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-gray-900 text-xl mb-3 leading-tight">{event.title}</h3>
                      
                      {/* Description */}
                      {event.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2 leading-relaxed">{event.description}</p>
                      )}

                      {/* Date & Coach Info */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="font-medium">{formatEventDate(event.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          {event.coachPhotoURL ? (
                            <img
                              src={event.coachPhotoURL}
                              alt={event.coachName}
                              className="w-8 h-8 rounded-full object-cover border-2 border-green-200"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-blue-600">
                                {event.coachName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="font-medium">{event.coachName}</span>
                        </div>
                      </div>

                      {/* Zoom Join Button */}
                      {event.type === "meeting" && event.zoomLink && (
                        <button
                          onClick={() => window.open(event.zoomLink, '_blank', 'noopener,noreferrer')}
                          className="w-full py-4 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                        >
                          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Zoom'a Katıl</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tamamlanan Etkinlikler */}
        {pastEvents.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-1 h-8 bg-gradient-to-b from-gray-400 to-gray-500 rounded-full"></div>
              <span>Tamamlanan Etkinlikler</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 opacity-75"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          event.type === "meeting"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {event.type === "meeting" ? "Canlı Toplantı" : "Diğer"}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-700 text-lg mb-2">{event.title}</h3>
                      {event.description && (
                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{event.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatEventDate(event.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {event.coachPhotoURL ? (
                        <img
                          src={event.coachPhotoURL}
                          alt={event.coachName}
                          className="w-6 h-6 rounded-full object-cover border border-gray-300"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-[10px] font-bold text-gray-600">
                            {event.coachName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span>{event.coachName}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-[0_10px_30px_rgba(59,130,246,0.4)] flex items-center justify-center transition-all duration-300 ${
          showScrollTop
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-90 pointer-events-none"
        } active:scale-95 hover:shadow-[0_15px_40px_rgba(59,130,246,0.5)]`}
        aria-label="Yukarı git"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
      
      <StudentFooter />
    </div>
  );
}
