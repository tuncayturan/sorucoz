"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CoachBildirim {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Timestamp;
  type?: string;
  data?: {
    type?: string;
    conversationId?: string;
    messageId?: string;
    userId?: string;
  };
}

export default function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [bildirimler, setBildirimler] = useState<CoachBildirim[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const readNotificationsRef = useRef<Set<string>>(new Set());

  // Çevrimiçi durumunu güncelle
  useOnlineStatus();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/landing");
    } else if (userData && userData.role !== "coach") {
      if (userData.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/home");
      }
    }
  }, [user, userData, authLoading, router]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (sidebarOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".sidebar") && !target.closest(".sidebar-toggle")) {
          setSidebarOpen(false);
        }
      };
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [sidebarOpen]);

  // Close notifications when clicking outside
  useEffect(() => {
    if (showNotifications) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest(".notifications-container") && !target.closest(".notifications-button")) {
          setShowNotifications(false);
        }
      };
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showNotifications]);

  // Real-time coach bildirimlerini dinle - Yeni conversation yapısı
  useEffect(() => {
    if (!user || userData?.role !== "coach") return;

    let unsubscribeFunctions: (() => void)[] = [];

    // Browser bildirim izni iste
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const showBrowserNotification = (title: string, body: string, conversationId: string) => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/img/logo.png",
          badge: "/img/logo.png",
          data: { conversationId },
        });
      }
    };

    // Sadece bu coach'un conversation'larını dinle
    const setupRealTimeListeners = async () => {
      try {
        // Sadece bu coach'un dahil olduğu conversation'ları al
        const conversationsQuery = query(
          collection(db, "conversations"),
          where("coachId", "==", user.uid)
        );
        const conversationsSnapshot = await getDocs(conversationsQuery);

        conversationsSnapshot.docs.forEach((convDoc) => {
          const conversationId = convDoc.id;
          const convData = convDoc.data();
          const studentId = convData.studentId;
          const studentName = convData.studentName || "Öğrenci";

          // Conversation'daki mesajları dinle
          const messagesRef = collection(db, "conversations", conversationId, "messages");
          const messagesQuery = query(messagesRef, orderBy("createdAt", "desc"));

          const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const newUnreadMessages: CoachBildirim[] = [];
            
            snapshot.forEach((msgDoc) => {
              const msgData = msgDoc.data();
              // Sadece öğrencinin gönderdiği ve coach tarafından okunmamış mesajlar
              if (msgData.senderId === studentId && !msgData.readByCoach) {
                newUnreadMessages.push({
                  id: msgDoc.id,
                  title: "Yeni Öğrenci Mesajı",
                  body: `${studentName}: ${msgData.text?.substring(0, 50) || "Dosya gönderildi"}${msgData.text && msgData.text.length > 50 ? "..." : ""}`,
                  read: false,
                  createdAt: msgData.createdAt,
                  type: "message",
                  data: {
                    type: "message",
                    conversationId: conversationId,
                    messageId: msgDoc.id,
                    userId: studentId,
                  },
                });
              }
            });

            setBildirimler(prev => {
              // Önce bu conversation'a ait eski bildirimleri kaldır
              const filteredPrev = prev.filter(b => b.data?.conversationId !== conversationId);
              // Yeni bildirimleri ekle ve sırala
              return [...filteredPrev, ...newUnreadMessages].sort((a, b) => {
                const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
                const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
                return bTime - aTime;
              }).slice(0, 50);
            });

            // Unread count'u güncelle
            setUnreadCount(prev => {
              const otherConversationsUnread = bildirimler.filter(
                b => b.data?.conversationId !== conversationId && !b.read
              ).length;
              return otherConversationsUnread + newUnreadMessages.filter(b => !b.read).length;
            });

            // Yeni mesaj geldiğinde browser bildirimi göster
            if (newUnreadMessages.length > 0 && !readNotificationsRef.current.has(newUnreadMessages[0].id)) {
              showBrowserNotification(
                newUnreadMessages[0].title,
                newUnreadMessages[0].body,
                newUnreadMessages[0].data?.conversationId || ""
              );
            }
          });

          unsubscribeFunctions.push(unsubscribe);
        });
      } catch (error) {
        console.error("Coach real-time listener kurulum hatası:", error);
      }
    };

    setupRealTimeListeners();
    
    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, [user, userData, pathname, bildirimler]);

  // Bildirime tıklayınca yönlendir
  const handleNotificationClick = async (bildirim: CoachBildirim) => {
    setShowNotifications(false);
    
    // Mark notification as read
    if (!bildirim.read) {
      readNotificationsRef.current.add(bildirim.id);
      setBildirimler(prev => 
        prev.map(b => b.id === bildirim.id ? { ...b, read: true } : b)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Mark message as read in Firestore if it's a message notification
    if (bildirim.data?.type === "message" && bildirim.data?.conversationId && bildirim.data?.messageId) {
      try {
        const mesajRef = doc(db, "conversations", bildirim.data.conversationId, "messages", bildirim.data.messageId);
        await updateDoc(mesajRef, { readByCoach: true });
      } catch (error) {
        console.error("Mesaj okuma hatası:", error);
      }
    }
    
    if (bildirim.data?.type === "message" && bildirim.data?.conversationId) {
      router.push(`/coach/chat?conversationId=${bildirim.data.conversationId}`);
    } else {
      router.push(`/coach/chat`);
    }
  };

  const formatTarih = (timestamp: Timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Şimdi";
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  };

  if (authLoading || userDataLoading || !user || userData?.role !== "coach") {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const menuItems = [
    { href: "/coach", label: "Ana Sayfa", icon: "🏠", badge: null },
    { href: "/coach/students", label: "Öğrenciler", icon: "👥", badge: null },
    { href: "/coach/chat", label: "Mesajlar", icon: "💬", badge: unreadCount > 0 ? unreadCount : null },
    { href: "/coach/calendar", label: "Takvim", icon: "📅", badge: null },
    { href: "/coach/profile", label: "Profil", icon: "👤", badge: null },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="sidebar-toggle p-2 rounded-xl hover:bg-gray-100 transition"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              {user?.photoURL || userData?.photoURL ? (
                <img
                  src={user?.photoURL || userData?.photoURL || ""}
                  alt={userData?.name || "Coach"}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const name = (userData?.name || user?.displayName || "Coach").charAt(0).toUpperCase();
                    e.currentTarget.parentElement!.innerHTML = `<div class="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-white shadow-sm"><span class="text-white font-bold text-sm">${name}</span></div>`;
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-white shadow-sm">
                  <span className="text-white font-bold text-sm">
                    {(userData?.name || user?.displayName || "Coach").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {userData?.name || user?.displayName || "Coach"}
                </h1>
                {userData?.title && (
                  <p className="text-xs text-green-600 font-medium">{userData.title}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifications Button - Mobile */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="notifications-button relative p-2 rounded-xl hover:bg-gray-100 transition"
              >
                <svg
                  className="w-5 h-5 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown - Mobile */}
              {showNotifications && (
                <div className="notifications-container fixed top-16 left-4 right-4 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-200/50 z-50 max-h-[400px] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200/50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">Bildirimler</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">
                        {unreadCount} yeni
                      </span>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {bildirimler.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-gray-500 text-sm">Bildirim yok</p>
                      </div>
                    ) : (
                      bildirimler.map((bildirim) => (
                        <button
                          key={bildirim.id}
                          onClick={() => handleNotificationClick(bildirim)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50/80 transition border-b border-gray-100/50 ${
                            !bildirim.read ? "bg-green-50/50" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                !bildirim.read ? "bg-green-500" : "bg-transparent"
                              }`}
                            ></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm mb-1">
                                {bildirim.title}
                              </p>
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {bildirim.body}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatTarih(bildirim.createdAt)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={async () => {
                const { signOut } = await import("firebase/auth");
                const { auth } = await import("@/lib/firebase");
                await signOut(auth);
                router.replace("/landing");
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50/80 active:scale-95 transition"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Header */}
      <header className="hidden lg:block sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-3">
            {user?.photoURL || userData?.photoURL ? (
              <img
                src={user?.photoURL || userData?.photoURL || ""}
                alt={userData?.name || "Coach"}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const name = (userData?.name || user?.displayName || "Coach").charAt(0).toUpperCase();
                  e.currentTarget.parentElement!.innerHTML = `<div class="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-white shadow-sm"><span class="text-white font-bold text-base">${name}</span></div>`;
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-white shadow-sm">
                <span className="text-white font-bold text-base">
                  {(userData?.name || user?.displayName || "Coach").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {userData?.name || user?.displayName || "Coach"}
              </h1>
              {userData?.title ? (
                <p className="text-xs text-green-600 font-medium">{userData.title}</p>
              ) : (
                <p className="text-xs text-gray-500">Coach Panel</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="notifications-button relative p-2 rounded-xl hover:bg-gray-100/80 active:scale-95 transition"
              >
                <svg
                  className="w-6 h-6 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="notifications-container absolute right-0 mt-2 w-80 sm:w-96 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-200/50 z-50 max-h-[500px] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-gray-200/50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">Bildirimler</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">
                        {unreadCount} yeni
                      </span>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {bildirimler.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-gray-500 text-sm">Bildirim yok</p>
                      </div>
                    ) : (
                      bildirimler.map((bildirim) => (
                        <button
                          key={bildirim.id}
                          onClick={() => handleNotificationClick(bildirim)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50/80 transition border-b border-gray-100/50 ${
                            !bildirim.read ? "bg-green-50/50" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                !bildirim.read ? "bg-green-500" : "bg-transparent"
                              }`}
                            ></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm mb-1">
                                {bildirim.title}
                              </p>
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {bildirim.body}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatTarih(bildirim.createdAt)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={async () => {
                const { signOut } = await import("firebase/auth");
                const { auth } = await import("@/lib/firebase");
                await signOut(auth);
                router.replace("/landing");
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50/80 active:scale-95 transition"
            >
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Mobile Overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed top-16 inset-x-0 bottom-0 bg-black/50 backdrop-blur-sm z-30" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`sidebar fixed lg:sticky top-16 lg:top-0 left-0 h-[calc(100vh-4rem)] lg:h-screen z-40 bg-white/90 backdrop-blur-xl border-r border-gray-200/50 shadow-lg transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 w-64`}
        >
          <div className="flex flex-col h-full">
            {/* Menu Items */}
            <nav className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-all relative ${
                        isActive
                          ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                          : "text-gray-700 hover:bg-gray-100/80"
                      }`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && item.badge > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-red-500 text-white"
                        }`}>
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-gray-200/50">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4">
                <p className="text-xs text-gray-600 font-medium mb-1">Coach Paneli</p>
                <p className="text-xs text-gray-500">v1.0.0</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen lg:min-h-[calc(100vh-4rem)]">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

