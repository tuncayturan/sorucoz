"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, limit, collectionGroup, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AdminBildirim {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Timestamp;
  type: string;
  data?: {
    type?: string;
    supportId?: string;
    messageId?: string;
    userId?: string;
  };
}

export default function AdminLayout({
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
  const [bildirimler, setBildirimler] = useState<AdminBildirim[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingSupportCount, setPendingSupportCount] = useState(0);
  const readNotificationsRef = useRef<Set<string>>(new Set());

  // Çevrimiçi durumunu güncelle
  useOnlineStatus();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/landing");
    } else if (userData && userData.role !== "admin") {
      router.replace("/home");
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

  // Real-time admin bildirimlerini dinle
  useEffect(() => {
    if (!user || userData?.role !== "admin") return;

    let unsubscribeFunctions: (() => void)[] = [];
    const supportMessagesMap = new Map<string, any[]>();

    // Browser bildirim izni iste
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const showBrowserNotification = (title: string, body: string) => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/img/logo.png",
          badge: "/img/logo.png",
        });
      }
    };

    // Tüm kullanıcıları al ve real-time dinle
    const setupRealTimeListeners = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        
        usersSnapshot.docs.forEach((userDoc) => {
          const userId = userDoc.id;
          
          // Destek mesajlarını real-time dinle
          const destekRef = collection(db, "users", userId, "destek");
          const destekQuery = query(destekRef, orderBy("createdAt", "desc"), limit(50));
          
          const unsubscribeDestek = onSnapshot(destekQuery, (snapshot) => {
            const pendingMessages: any[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              // Only show notification if message is pending and not viewed by admin
              if (data.status === "pending" && !data.viewedByAdmin) {
                pendingMessages.push({
                  id: `support-${userId}-${doc.id}`,
                  title: "Yeni Destek Mesajı",
                  body: `${data.userName || data.userEmail || "Kullanıcı"}: ${data.konu}`,
                  read: false,
                  createdAt: data.createdAt,
                  type: "support",
                  data: {
                    type: "support",
                    supportId: doc.id,
                    userId,
                  },
                });
              }
            });
            
            const prevCount = supportMessagesMap.get(userId)?.length || 0;
            supportMessagesMap.set(userId, pendingMessages);
            
            // Tüm pending mesajları topla
            const allPending: any[] = [];
            supportMessagesMap.forEach((messages) => {
              allPending.push(...messages);
            });
            
            setPendingSupportCount(allPending.length);
            
            // Yeni mesaj geldiğinde bildirim göster
            if (allPending.length > prevCount && prevCount >= 0) {
              const newMessage = pendingMessages[0];
              if (newMessage) {
                showBrowserNotification(newMessage.title, newMessage.body);
              }
            }
            
            updateNotifications();
          });
          
          unsubscribeFunctions.push(unsubscribeDestek);
        });
      } catch (error) {
        console.error("Real-time listeners kurulurken hata:", error);
      }
    };

    const updateNotifications = () => {
      const allSupport: any[] = [];
      
      supportMessagesMap.forEach((messages) => {
        allSupport.push(...messages);
      });
      
      const allNotifications = allSupport.map(notif => ({
        ...notif,
        read: readNotificationsRef.current.has(notif.id) || notif.read
      })).sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

      setBildirimler(allNotifications.slice(0, 50));
      setUnreadCount(allNotifications.filter((n) => !n.read).length);
    };

    setupRealTimeListeners();
    
    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }, [user, userData]);

  // Bildirime tıklayınca yönlendir
  const handleNotificationClick = async (bildirim: AdminBildirim) => {
    setShowNotifications(false);
    
    // Mark notification as read
    if (!bildirim.read) {
      readNotificationsRef.current.add(bildirim.id);
      setBildirimler(prev => 
        prev.map(b => b.id === bildirim.id ? { ...b, read: true } : b)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Mark support message as viewed in Firestore if it's a support notification
    if (bildirim.data?.type === "support" && bildirim.data?.userId && bildirim.data?.supportId) {
      try {
        const { doc, updateDoc, getDoc, Timestamp } = await import("firebase/firestore");
        const destekRef = doc(db, "users", bildirim.data.userId, "destek", bildirim.data.supportId);
        const destekSnap = await getDoc(destekRef);
        
        if (destekSnap.exists()) {
          const data = destekSnap.data();
          // Mark as viewed if it's pending and not viewed yet
          if (data.status === "pending" && !data.viewedByAdmin) {
            await updateDoc(destekRef, { 
              viewedByAdmin: true, 
              viewedByAdminAt: Timestamp.now() 
            });
          }
        }
      } catch (error) {
        console.error("Destek mesajı görüntüleme hatası:", error);
      }
    }
    
    // Sadece destek bildirimleri için yönlendirme
    if (bildirim.data?.type === "support" && bildirim.data?.userId && bildirim.data?.supportId) {
      router.push(`/admin/destek?userId=${bildirim.data.userId}&supportId=${bildirim.data.supportId}`);
    } else if (bildirim.data?.type === "support") {
      router.push(`/admin/destek`);
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

  if (authLoading || userDataLoading || !user || userData?.role !== "admin") {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const menuItems = [
    { href: "/admin", label: "Dashboard", icon: "📊", badge: null },
    { href: "/admin/destek", label: "Destek", icon: "💬", badge: pendingSupportCount > 0 ? pendingSupportCount : null },
    { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: "👥", badge: null },
    { href: "/admin/coach-yonetimi", label: "Coach Yönetimi", icon: "👨‍🏫", badge: null },
    { href: "/admin/security", label: "Security", icon: "🔒", badge: null },
    { href: "/admin/sorular", label: "Sorular", icon: "❓", badge: null },
    { href: "/admin/ai-yonetimi", label: "AI Yönetimi", icon: "🤖", badge: null },
    { href: "/admin/maliyet", label: "Maliyet Yönetimi", icon: "💵", badge: null },
    { href: "/admin/abonelikler", label: "Abonelikler", icon: "⭐", badge: null },
    { href: "/admin/odeme-yontemleri", label: "Ödeme Yöntemleri", icon: "💳", badge: null },
    { href: "/admin/odeme-gecmisi", label: "Ödeme Geçmişi", icon: "💰", badge: null },
    { href: "/admin/istatistikler", label: "İstatistikler", icon: "📈", badge: null },
    { href: "/admin/ayarlar", label: "Site Ayarları", icon: "⚙️", badge: null },
    { href: "/admin/popup-mesaj", label: "Popup Mesaj", icon: "📢", badge: null },
    { href: "/admin/referans-kodlar", label: "Referans Kodları", icon: "🎟️", badge: null },
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
                  alt={userData?.name || "Admin"}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-white shadow-sm">
                  <span className="text-white font-bold text-sm">
                    {(userData?.name || user?.displayName || "Admin").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <h1 className="text-lg font-bold text-gray-900">
                {userData?.name || user?.displayName || "Admin"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifications Button - Mobile */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl hover:bg-gray-100 transition"
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
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  ></div>
                  <div className="fixed top-16 left-4 right-4 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-200/50 z-50 max-h-[400px] overflow-hidden flex flex-col">
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
                              !bildirim.read ? "bg-blue-50/50" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                  !bildirim.read ? "bg-blue-500" : "bg-transparent"
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
                </>
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
                alt={userData?.name || "Admin"}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-white shadow-sm">
                <span className="text-white font-bold text-base">
                  {(userData?.name || user?.displayName || "Admin").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {userData?.name || user?.displayName || "Admin"}
              </h1>
              <p className="text-xs text-gray-500">{userData?.email || user?.email || ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
          {/* Notifications Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl hover:bg-gray-100/80 active:scale-95 transition"
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
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-200/50 z-50 max-h-[500px] overflow-hidden flex flex-col">
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
                            !bildirim.read ? "bg-blue-50/50" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                !bildirim.read ? "bg-blue-500" : "bg-transparent"
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
              </>
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
                  const isActive = pathname === item.href || (item.href === "/admin" && pathname === "/admin");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-semibold text-sm transition-all relative ${
                        isActive
                          ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
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
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4">
                <p className="text-xs text-gray-600 font-medium mb-1">Admin Paneli</p>
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

