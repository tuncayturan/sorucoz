"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SplashScreen from "@/components/SplashScreen";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";

export default function AppEntry() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        setShowSplash(false);
      }, 1000);
    }
  }, [loading]);

  useEffect(() => {
    if (!showSplash && !loading && !userDataLoading) {
      const done = localStorage.getItem("onboardingDone");

      if (!done) {
        router.replace("/onboarding");
      } else if (user) {
        // Role'e göre yönlendir
        if (userData?.role === "admin") {
          router.replace("/admin");
        } else if (userData?.role === "coach") {
          router.replace("/coach");
        } else {
          router.replace("/home");
        }
      } else {
        // Kullanıcı giriş yapmamışsa login'e yönlendir
        router.replace("/auth/login");
      }
    }
  }, [showSplash, loading, userDataLoading, user, userData, router]);

  if (showSplash || loading || userDataLoading) return <SplashScreen />;

  return null;
}
