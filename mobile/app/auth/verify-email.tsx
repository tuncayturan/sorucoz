import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { sendEmailVerification, reload } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  // Email doğrulandıysa veya email doğrulaması gerektirmeyen kullanıcılar için ana sayfaya yönlendir
  useEffect(() => {
    if (authLoading || userDataLoading) return;
    
    if (!user) {
      router.replace("/landing");
      return;
    }

    // Google ile giriş/kayıt olanlar otomatik doğrulanmış - email doğrulaması gerektirme
    const isGoogleUser = user.providerData?.some((p: any) => p.providerId === 'google.com');
    if (isGoogleUser) {
      router.replace("/(tabs)/home");
      return;
    }

    // Firebase Auth'ta emailVerified: true olanlar (admin tarafından eklenen kullanıcılar dahil) için email doğrulaması gerektirme
    if (user.emailVerified) {
      // Firestore'da emailVerified true değilse güncelle
      if (userData?.emailVerified !== true) {
        updateDoc(doc(db, "users", user.uid), {
          emailVerified: true,
        }).catch(console.error);
      }
      router.replace("/(tabs)/home");
      return;
    }

    // Firestore'da emailVerified: true olanlar (admin tarafından eklenen kullanıcılar) için email doğrulaması gerektirme
    if (userData?.emailVerified === true) {
      router.replace("/(tabs)/home");
      return;
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  const checkVerified = async () => {
    if (!user) return;
    
    try {
      setChecking(true);
      // Firebase Auth'taki user bilgilerini yenile
      await reload(user);
      
      if (user.emailVerified) {
        // Firestore'da emailVerified'ı true yap
        try {
          await updateDoc(doc(db, "users", user.uid), {
            emailVerified: true,
          });
          console.log("[Verify Email] ✅ Firestore emailVerified updated to true");
        } catch (firestoreError) {
          console.error("[Verify Email] ⚠️ Firestore update error (non-critical):", firestoreError);
        }
        
        Alert.alert("Başarılı", "Email doğrulandı! Ana sayfaya yönlendiriliyorsunuz...", [
          {
            text: "Tamam",
            onPress: () => router.replace("/(tabs)/home"),
          },
        ]);
      } else {
        Alert.alert("Bilgi", "Email henüz doğrulanmamış. Lütfen email kutunuzu kontrol edin.");
      }
    } catch (error) {
      console.error("[Verify Email] ❌ Check verified error:", error);
      Alert.alert("Hata", "Doğrulama kontrolü yapılamadı. Lütfen tekrar deneyin.");
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    if (!user) return;
    try {
      setResending(true);
      await sendEmailVerification(user);
      console.log("[Verify Email] ✅ Email verification resent successfully");
      Alert.alert("Başarılı", "Doğrulama emaili tekrar gönderildi. Email kutunuzu kontrol edin.");
    } catch (error: any) {
      console.error("[Verify Email] ❌ Email verification resend error:", error);
      if (error.code === "auth/too-many-requests") {
        Alert.alert("Uyarı", "Çok fazla istek gönderdiniz. Lütfen birkaç dakika bekleyin.");
      } else {
        Alert.alert("Hata", `Email gönderilemedi: ${error.message || "Bilinmeyen hata"}. Lütfen tekrar deneyin.`);
      }
    } finally {
      setResending(false);
    }
  };

  if (authLoading || userDataLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Email Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={styles.title}>Emailini Onayla</Text>
        <Text style={styles.description}>
          Lütfen {user?.email} adresine gönderilen doğrulama bağlantısına tıkla.
        </Text>

        <TouchableOpacity
          style={[styles.button, checking && styles.buttonDisabled]}
          onPress={checkVerified}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Onaylandı mı kontrol et</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buttonSecondary, resending && styles.buttonDisabled]}
          onPress={resend}
          disabled={resending}
        >
          {resending ? (
            <ActivityIndicator color="#4CAF50" />
          ) : (
            <Text style={styles.buttonSecondaryText}>Emaili tekrar gönder</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f7",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  button: {
    width: "100%",
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonSecondary: {
    width: "100%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  buttonSecondaryText: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "bold",
  },
});
