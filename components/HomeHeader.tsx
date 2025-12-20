"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { collection, query, orderBy, getDocs, doc, updateDoc, Timestamp, onSnapshot, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { checkSubscriptionStatus, isFreemiumMode, type SubscriptionPlan } from "@/lib/subscriptionUtils";

interface HomeHeaderProps {
  onMenuClick?: () => void;
}

interface Bildirim {
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
  };
}

export default function HomeHeader({ onMenuClick }: HomeHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { userData } = useUserData();
  const { settings } = useSiteSettings();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const displayName = userData?.name || user?.displayName || "Öğrenci";
  const isPremium = userData?.premium || false;
  const displayPhoto = userData?.photoURL || user?.photoURL || null;
  const logoUrl = settings.logo || null;
  const siteName = settings.siteName || "SoruÇöz"; // Site adı, yoksa varsayılan "SoruÇöz"
  
  // Freemium kontrolü
  const subscriptionStatus = userData 
    ? checkSubscriptionStatus(
        userData.trialEndDate || null,
        userData.subscriptionEndDate || null,
        userData.premium,
        userData.createdAt,
        userData.subscriptionPlan
      )
    : "trial";
  
  // Plan'ı subscription status'e göre belirle
  let currentPlan: SubscriptionPlan = userData?.subscriptionPlan || "trial";
  if (subscriptionStatus === "trial") {
    currentPlan = "trial";
  } else if (subscriptionStatus === "active" && userData?.subscriptionPlan) {
    currentPlan = userData.subscriptionPlan;
  } else if (subscriptionStatus === "freemium") {
    currentPlan = "freemium";
  }
  
  const isFreemium = isFreemiumMode(currentPlan, subscriptionStatus);

  // Bildirimleri çek
  useEffect(() => {
    if (!user) return;

    const bildirimlerRef = collection(db, "users", user.uid, "bildirimler");
    const q = query(bildirimlerRef, orderBy("createdAt", "desc"), limit(20));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications: Bildirim[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const notification: Bildirim = {
          id: doc.id,
          ...data,
          read: data.read || false,
        } as Bildirim;
        notifications.push(notification);
      });
      
      // Unread count'u hesapla
      const unreadCount = notifications.filter((n) => !n.read).length;
      
      setBildirimler(notifications);
      setUnreadCount(unreadCount);
    });

    return () => unsubscribe();
  }, [user]);


  // Bildirim panelini dışarı tıklandığında kapat
  useEffect(() => {
    if (!showNotifications) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Bildirim butonu veya dropdown içine tıklanmadıysa kapat
      if (!target.closest('.notification-button') && !target.closest('.notification-dropdown')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);


  // Bildirimi okundu olarak işaretle ve yönlendir
  const handleNotificationClick = async (bildirim: Bildirim) => {
    if (!user) return;

    setShowNotifications(false);

    // Bildirimi okundu olarak işaretle
    if (!bildirim.read) {
      try {
        // Firestore'da okundu olarak işaretle
        const bildirimRef = doc(db, "users", user.uid, "bildirimler", bildirim.id);
        await updateDoc(bildirimRef, { read: true });
        
        // State'i güncelle
        setBildirimler(prev => 
          prev.map(b => b.id === bildirim.id ? { ...b, read: true } : b)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Bildirim okuma hatası:", error);
      }
    }

    // Bildirim tipine göre yönlendir
    if (bildirim.data?.type === "support_reply" && bildirim.data?.supportId) {
      router.push(`/destek?supportId=${bildirim.data.supportId}`);
    } else if (bildirim.data?.type === "support_reply") {
      router.push("/destek");
    } else if (bildirim.data?.type === "message" && bildirim.data?.messageId) {
      router.push(`/mesajlar?messageId=${bildirim.data.messageId}`);
    } else if (bildirim.data?.type === "message") {
      router.push("/mesajlar");
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


  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* LEFT: Logo & Menu Button (Mobile) */}
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100/80 active:scale-95 transition"
              aria-label="Menu"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>

            {/* Logo/App Name - Premium iOS Style */}
            <button
              onClick={() => router.push("/home")}
              className="flex items-center gap-3 group relative"
            >
              <div className="relative">
                {/* Outer Glow Effect */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-400/20 via-indigo-400/20 to-purple-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Main Logo Container - Premium Glassmorphism */}
                <div className="relative w-10 h-10 rounded-2xl overflow-hidden">
                  {/* Gradient Background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600" />
                  
                  {/* Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60" />
                  
                  {/* Inner Border Glow */}
                  <div className="absolute inset-[1px] rounded-2xl border border-white/20" />
                  
                  {/* Logo Content */}
                  {logoUrl ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={logoUrl}
                        alt={siteName}
                        fill
                        className="object-cover rounded-2xl"
                        unoptimized
                        onError={(e) => {
                          console.error("Logo yüklenemedi:", logoUrl);
                          // Fallback to initial
                          const target = e.target as HTMLImageElement;
                          if (target) {
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<div class="relative w-full h-full flex items-center justify-center z-10"><span class="text-white font-black text-base drop-shadow-md">${siteName.charAt(0).toUpperCase()}</span></div>`;
                            }
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center z-10">
                      <span className="text-white font-black text-base drop-shadow-md">
                        {siteName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {/* Hover Glow Effect */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm -z-10" />
                </div>
                
                {/* Subtle Shadow */}
                <div className="absolute inset-0 rounded-2xl shadow-[0_4px_12px_rgba(59,130,246,0.25)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              
              <span className="font-semibold text-gray-900 hidden sm:inline group-hover:text-blue-600 transition-colors duration-300">
                {siteName}
              </span>
            </button>
          </div>

          {/* CENTER: Desktop Navigation (hidden on mobile) */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              onClick={() => router.push("/home")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100/80 active:scale-95 transition"
            >
              Ana Sayfa
            </button>
            <button
              onClick={() => router.push("/soru-sor")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100/80 active:scale-95 transition"
            >
              Soru Sor
            </button>
            <button
              onClick={() => router.push("/sorularim")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100/80 active:scale-95 transition"
            >
              Sorularım
            </button>
            <button
              onClick={() => router.push("/mesajlar")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100/80 active:scale-95 transition"
            >
              Mesajlar
            </button>
            <button
              onClick={() => router.push("/istatistikler")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100/80 active:scale-95 transition"
            >
              İstatistikler
            </button>
            <button
              onClick={() => router.push("/destek")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100/80 active:scale-95 transition"
            >
              Destek
            </button>
            <button
              onClick={() => router.push("/ayarlar")}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100/80 active:scale-95 transition"
            >
              Ayarlar
            </button>
          </nav>

          {/* RIGHT: User Profile */}
          <div className="flex items-center gap-3">
            {/* Plan Badge (Desktop) - Tıklanabilir, Premium sayfasına gider */}
            {user && (
              <button
                onClick={() => router.push("/premium")}
                className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 ${
                  currentPlan === "freemium"
                    ? "bg-gradient-to-r from-gray-600 to-gray-800 text-white"
                    : currentPlan === "trial"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                    : currentPlan === "lite"
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                    : currentPlan === "premium"
                    ? "bg-gradient-to-r from-yellow-400 to-orange-400 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
                title="Plan detaylarını görüntüle"
              >
                <span>
                  {currentPlan === "freemium"
                    ? "🆓"
                    : currentPlan === "trial"
                    ? "🎁"
                    : currentPlan === "lite"
                    ? "📚"
                    : currentPlan === "premium"
                    ? "⭐"
                    : "📦"}
                </span>
                <span>
                  {currentPlan === "freemium"
                    ? "Freemium"
                    : currentPlan === "trial"
                    ? "Trial"
                    : currentPlan === "lite"
                    ? "Lite"
                    : currentPlan === "premium"
                    ? "Premium"
                    : "Plan Seç"}
                </span>
              </button>
            )}

            {/* Events Button - Freemium kullanıcılar için gizli */}
            {user && !isFreemium && (
              <button
                onClick={() => router.push("/etkinlikler")}
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
            )}

            {/* Notifications Button */}
            {user && (
              <div className="relative">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newShowState = !showNotifications;
                    
                    // If opening notifications, mark all unread notifications as read
                    if (!showNotifications && unreadCount > 0) {
                      try {
                        // Get all unread notifications
                        const unreadNotifications = bildirimler.filter(
                          (n) => !n.read
                        );
                        
                        if (unreadNotifications.length > 0) {
                          // Mark all unread notifications as read in Firestore
                          const updatePromises = unreadNotifications.map(async (bildirim) => {
                            const bildirimRef = doc(db, "users", user.uid, "bildirimler", bildirim.id);
                            await updateDoc(bildirimRef, { read: true });
                          });
                          
                          await Promise.all(updatePromises);
                          
                          // Update state optimistically
                          setBildirimler(prev => 
                            prev.map(b => 
                              unreadNotifications.some(n => n.id === b.id)
                                ? { ...b, read: true } 
                                : b
                            )
                          );
                          setUnreadCount(0);
                        }
                      } catch (error) {
                        console.error("Bildirimleri okundu işaretleme hatası:", error);
                      }
                    }
                    
                    setShowNotifications(newShowState);
                  }}
                  className="notification-button relative p-2 rounded-xl hover:bg-gray-100/80 active:scale-95 transition"
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
                    <div 
                      className="notification-dropdown absolute right-0 mt-2 w-80 sm:w-96 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-200/50 z-50 max-h-[500px] overflow-hidden flex flex-col"
                      onClick={(e) => e.stopPropagation()}
                    >
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
            )}

            {/* Profile Button */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100/80 active:scale-95 transition"
              >
                {displayPhoto ? (
                  <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
                    <img
                      src={displayPhoto}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = `<div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm"><span class="text-white font-semibold text-xs">${displayName.charAt(0).toUpperCase()}</span></div>`;
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center ring-2 ring-white shadow-sm">
                    <span className="text-white font-semibold text-xs">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-[120px] truncate">
                  {displayName}
                </span>
                <svg
                  className="w-4 h-4 text-gray-500"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProfileMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-gray-200/50 py-2 z-50">
                    <button
                      onClick={() => {
                        router.push("/ayarlar");
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100/80 transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Ayarlar
                    </button>
                    <button
                      onClick={() => {
                        router.push("/destek");
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100/80 transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Destek
                    </button>
                    <div className="border-t border-gray-200/50 my-1"></div>
                    <button
                      onClick={async () => {
                        const { signOut } = await import("firebase/auth");
                        const { auth } = await import("@/lib/firebase");
                        await signOut(auth);
                        router.replace("/landing");
                        setShowProfileMenu(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50/80 transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Çıkış Yap
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

