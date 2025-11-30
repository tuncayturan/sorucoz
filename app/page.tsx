"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { shouldRedirectToPremium } from "@/lib/subscriptionGuard";

export default function AppEntry() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();

  useEffect(() => {
    if (!loading && !userDataLoading) {
      if (user) {
        // Role'e göre yönlendir
        if (userData?.role === "admin") {
          router.replace("/admin");
        } else if (userData?.role === "coach") {
          router.replace("/coach");
        } else {
          // Student kullanıcılar için abonelik kontrolü
          if (shouldRedirectToPremium(userData)) {
            router.replace("/premium");
          } else {
            router.replace("/home");
          }
        }
      } else {
        // Kullanıcı giriş yapmamışsa landing sayfasına yönlendir
        router.replace("/landing");
      }
    }
  }, [loading, userDataLoading, user, userData, router]);

  // Loading durumunda minimal bir loading göster
  if (loading || userDataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f5f5f7] via-white to-[#f5f5f7] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return null;
}
