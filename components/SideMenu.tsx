"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { checkSubscriptionStatus, type SubscriptionPlan } from "@/lib/subscriptionUtils";

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: string | number;
}

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { userData } = useUserData();

  const displayName = userData?.name || user?.displayName || "Öğrenci";
  const isPremium = userData?.premium || false;
  
  // Plan bilgisini hesapla
  const subscriptionStatus = userData 
    ? checkSubscriptionStatus(
        userData?.trialEndDate || null,
        userData?.subscriptionEndDate || null,
        userData?.premium,
        userData?.createdAt,
        userData?.subscriptionPlan
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

  const menuItems: MenuItem[] = [
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      label: "Ana Sayfa",
      path: "/home",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      label: "Soru Sor",
      path: "/soru-sor",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      label: "Sorularım",
      path: "/sorularim",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      label: "Mesajlar",
      path: "/mesajlar",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      label: "İstatistikler",
      path: "/istatistikler",
    },
    {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      label: "Destek",
      path: "/destek",
    },
  ];

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        ></div>
      )}

      {/* Side Menu */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white/90 backdrop-blur-xl shadow-2xl z-50 transform transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">SÇ</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{displayName}</p>
                  <p className="text-xs text-gray-500">{userData?.email || user?.email}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-gray-100/80 active:scale-95 transition"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Plan Badge - Tıklanabilir, Premium sayfasına gider */}
            {user && (
              <button
                onClick={() => handleNavigation("/premium")}
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-full font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 w-fit ${
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
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {menuItems.map((item, index) => {
                const isActive = pathname === item.path;
                return (
                  <button
                    key={index}
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg"
                        : "text-gray-700 hover:bg-gray-100/80 active:scale-98"
                    }`}
                  >
                    {item.icon}
                    <span className="font-medium flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200/50">
            <button
              onClick={() => handleNavigation("/ayarlar")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-700 hover:bg-gray-100/80 active:scale-98 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium">Ayarlar</span>
            </button>
            <button
              onClick={async () => {
                const { signOut } = await import("firebase/auth");
                const { auth } = await import("@/lib/firebase");
                await signOut(auth);
                router.replace("/landing");
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-600 hover:bg-red-50/80 active:scale-98 transition mt-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="font-medium">Çıkış Yap</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

