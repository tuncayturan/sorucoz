import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { LinearGradient } from "expo-linear-gradient";
import { Video, ResizeMode } from "expo-av";

const { width } = Dimensions.get("window");

export default function LandingScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading } = useSiteSettings();
  const [logoError, setLogoError] = useState(false);
  const videoRef = useRef<Video>(null);

  const siteName = settings.siteName || "SoruÇöz";
  const siteLogo = settings.logo;
  const landingVideoUrl = settings.landingVideoUrl;

  // Giriş yapmış kullanıcıları yönlendir
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/(tabs)/home");
    }
  }, [user, authLoading, router]);

  if (authLoading || settingsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const handleGetStarted = () => {
    router.push("/auth/login");
  };

  const features = [
    {
      icon: "🤖",
      title: "AI Destekli Soru Çözümü",
      description: "Yapay zeka ile sorularınızı anında çözün. Detaylı açıklamalar ve adım adım çözümler.",
    },
    {
      icon: "👨‍🏫",
      title: "Uzman Eğitim Koçları",
      description: "Gerçek eğitim koçları ile birebir rehberlik. Her zaman yanınızda profesyonel destek.",
    },
    {
      icon: "📊",
      title: "Detaylı İstatistikler",
      description: "Gelişiminizi takip edin. Performans analizi ve kişiselleştirilmiş öneriler.",
    },
    {
      icon: "📅",
      title: "Etkinlik Takvimi",
      description: "Önemli sınav tarihleri ve etkinlikler. Hiçbir şeyi kaçırmayın.",
    },
    {
      icon: "💬",
      title: "Anlık Mesajlaşma",
      description: "Eğitim koçlarınızla doğrudan iletişim. Sorularınız anında yanıtlanır.",
    },
    {
      icon: "⭐",
      title: "Premium Deneyim",
      description: "Modern, hızlı ve tamamen iOS hissi. Premium öğrenme deneyimi.",
    },
  ];

  const sinavlar = [
    { name: "LGS", icon: "📚" },
    { name: "TYT", icon: "🎯" },
    { name: "AYT", icon: "📖" },
    { name: "YKS", icon: "🎓" },
    { name: "KPSS", icon: "💼" },
    { name: "TUS", icon: "⚕️" },
    { name: "DUS", icon: "🦷" },
    { name: "YDS", icon: "🌍" },
    { name: "YÖKDİL", icon: "🗣️" },
    { name: "ALES", icon: "📝" },
    { name: "DGS", icon: "🔄" },
    { name: "MSÜ", icon: "🎖️" },
    { name: "STS", icon: "🏥" },
    { name: "EUS", icon: "💊" },
  ];

  return (
    <View style={styles.container}>
      {/* Video Background */}
      {landingVideoUrl ? (
        <Video
          ref={videoRef}
          source={{ uri: landingVideoUrl }}
          style={styles.videoBackground}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          isMuted
          onError={(error) => {
            console.error("Video error:", error);
          }}
        />
      ) : (
        <View style={styles.videoBackgroundFallback} />
      )}
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          {siteLogo && !logoError ? (
            <Image
              source={{ uri: siteLogo }}
              style={styles.logo}
              onError={() => setLogoError(true)}
            />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoText}>{siteName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{siteName}</Text>
        <Text style={styles.subtitle}>ile Başarıya</Text>

        {/* Description */}
        <Text style={styles.description}>
          Yapay zeka ve uzman eğitim koçları ile öğrenme deneyiminizi bir üst seviyeye taşıyın
        </Text>

        {/* Sınav Türleri */}
        <View style={styles.sinavContainer}>
          <Text style={styles.sinavTitle}>Tüm Sınavlara Hazırlık</Text>
          <View style={styles.sinavGrid}>
            {sinavlar.map((sinav, index) => (
              <View key={index} style={styles.sinavBadge}>
                <Text style={styles.sinavIcon}>{sinav.icon}</Text>
                <Text style={styles.sinavName}>{sinav.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Trust Badges */}
        <View style={styles.badgesContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>⭐</Text>
            <Text style={styles.badgeText}>4.9/5 Puan</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>🚀</Text>
            <Text style={styles.badgeText}>Anında Çözüm</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>✅</Text>
            <Text style={styles.badgeText}>Güvenilir</Text>
          </View>
        </View>

        {/* CTA Button */}
        <TouchableOpacity style={styles.ctaButton} onPress={handleGetStarted}>
          <LinearGradient
            colors={["#3B82F6", "#6366F1", "#8B5CF6"]}
            style={styles.ctaGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.ctaText}>Ücretsiz Başlayın</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Features Section */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Neden {siteName}?</Text>
        <Text style={styles.sectionSubtitle}>Öğrenme deneyiminizi dönüştüren özellikler</Text>

        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>📊</Text>
          <Text style={styles.statNumber}>10K+</Text>
          <Text style={styles.statLabel}>Çözülen Soru</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🎓</Text>
          <Text style={styles.statNumber}>5K+</Text>
          <Text style={styles.statLabel}>Mutlu Öğrenci</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>👨‍🏫</Text>
          <Text style={styles.statNumber}>50+</Text>
          <Text style={styles.statLabel}>Uzman Koç</Text>
        </View>
      </View>

      {/* Final CTA */}
      <View style={styles.finalCtaSection}>
        <Text style={styles.finalCtaTitle}>Hemen Başlayın</Text>
        <Text style={styles.finalCtaDescription}>
          Öğrenme yolculuğunuzu bugün başlatın. Premium deneyim sizi bekliyor.
        </Text>
        <TouchableOpacity style={styles.ctaButton} onPress={handleGetStarted}>
          <LinearGradient
            colors={["#3B82F6", "#6366F1", "#8B5CF6"]}
            style={styles.ctaGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.ctaText}>Ücretsiz Başlayın</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2025 {siteName}. {settings.footerCopyright || "Tüm hakları saklıdır."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollView: {
    flex: 1,
  },
  videoBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.95,
  },
  videoBackgroundFallback: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f7",
  },
  heroSection: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 30,
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 28,
  },
  logoFallback: {
    width: 112,
    height: 112,
    borderRadius: 28,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 48,
    fontWeight: "900",
    color: "#fff",
  },
  title: {
    fontSize: 48,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#60A5FA",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginBottom: 30,
    paddingHorizontal: 20,
    lineHeight: 26,
  },
  sinavContainer: {
    width: "100%",
    marginBottom: 30,
  },
  sinavTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  sinavGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  sinavBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  sinavIcon: {
    fontSize: 18,
  },
  sinavName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  badgesContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 30,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  badgeIcon: {
    fontSize: 18,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  ctaButton: {
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 20,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
  },
  featuresSection: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  sectionTitle: {
    fontSize: 36,
    fontWeight: "900",
    color: "#60A5FA",
    textAlign: "center",
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 30,
  },
  featuresGrid: {
    gap: 16,
  },
  featureCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: "#E5E7EB",
    lineHeight: 20,
  },
  statsSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  statCard: {
    alignItems: "center",
    flex: 1,
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "900",
    color: "#60A5FA",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  finalCtaSection: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  finalCtaTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  finalCtaDescription: {
    fontSize: 16,
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  footer: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
  },
});
