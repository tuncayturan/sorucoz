import { useEffect, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function AppEntry() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  // Navigation'ın hazır olmasını bekle
  useEffect(() => {
    // Segments boş değilse navigation hazır demektir
    if (segments.length > 0 || !authLoading) {
      setIsNavigationReady(true);
    }
  }, [segments, authLoading]);

  useEffect(() => {
    // Navigation hazır değilse bekle
    if (!isNavigationReady || authLoading || userDataLoading) return;

    // Kısa bir gecikme ekle - layout'un tamamen mount olmasını bekle
    const timer = setTimeout(() => {
      if (!user) {
        // Kullanıcı giriş yapmamışsa landing sayfasına yönlendir
        router.replace("/landing");
      } else if (userData) {
        // Email doğrulama kontrolü - Sadece normal email/password ile kayıt olmuş ve doğrulanmamış kullanıcılar için
        const isGoogleUser = user.providerData?.some((p: any) => p.providerId === 'google.com');
        // Google ile giriş/kayıt olanlar veya admin tarafından eklenen kullanıcılar (emailVerified: true) için email doğrulaması gerektirme
        if (!isGoogleUser && !user.emailVerified && userData.emailVerified !== true) {
          // Email doğrulanmamış kullanıcılar için verify-email sayfasına yönlendir
          router.replace("/auth/verify-email");
          return;
        }

        // Role'e göre yönlendir
        if (userData.role === "admin") {
          router.replace("/admin");
        } else if (userData.role === "coach") {
          router.replace("/coach");
        } else {
          // Student kullanıcılar için ana sayfaya yönlendir
          router.replace("/(tabs)/home");
        }
      }
    }, 100); // 100ms gecikme - layout'un mount olmasını bekle

    return () => clearTimeout(timer);
  }, [isNavigationReady, user, authLoading, userData, userDataLoading, router]);

  if (authLoading || userDataLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f7",
  },
});
