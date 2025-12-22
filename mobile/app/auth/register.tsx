import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { createUserWithEmailAndPassword, signInWithCredential, GoogleAuthProvider, sendEmailVerification } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { useRouter } from "expo-router";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { registerForPushNotificationsAsync, saveExpoPushTokenToUser } from "@/lib/notificationUtils";

// WebBrowser'ı tamamla
WebBrowser.maybeCompleteAuthSession();

export default function RegisterScreen() {
  const router = useRouter();
  const { settings } = useSiteSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const siteLogo = settings.logo && settings.logo.trim() !== "" ? settings.logo : null;
  const siteName = settings.siteName || "SoruÇöz";

  // Google OAuth hook - Android için Expo Client ID veya Android Client ID kullan
  // ÖNEMLİ: Android'de webClientId kullanma! "Custom scheme URIs are not allowed for 'WEB' client type" hatası verir
  // Firebase Console > Project Settings > Your apps > Android app > OAuth 2.0 Client IDs
  const [request, response, promptAsync] = Google.useAuthRequest({
    // Android için: expoClientId veya androidClientId kullan (webClientId DEĞİL!)
    expoClientId: "1026488924758-ph73nddcqp9skmtp5nn6l47d09beo2oe.apps.googleusercontent.com", // Expo Client ID (Android ve iOS için)
    iosClientId: "1026488924758-ph73nddcqp9skmtp5nn6l47d09beo2oe.apps.googleusercontent.com",
    // webClientId sadece web platformu için - Android'de kullanma!
  });

  // Google response'u dinle
  React.useEffect(() => {
    if (response?.type === "success") {
      handleGoogleResponse(response);
    }
  }, [response]);

  const handleGoogleResponse = async (response: any) => {
    try {
      setGoogleLoading(true);
      
      if (response.type === "success" && response.params?.id_token) {
        // Firebase credential oluştur
        const credential = GoogleAuthProvider.credential(response.params.id_token);
        const userCredential = await signInWithCredential(auth, credential);
        const user = userCredential.user;

        // Kullanıcı verilerini kontrol et ve gerekirse oluştur
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // Yeni kullanıcı - Firestore'a kaydet
          await setDoc(ref, {
            name: user.displayName || "",
            email: user.email || "",
            role: "student",
            premium: false,
            createdAt: serverTimestamp(),
            emailVerified: true,
            photoURL: user.photoURL || null,
            fcmTokens: [],
          });
        }

        // Bildirim token'ı al ve kaydet (arka planda, bloklamadan)
        registerForPushNotificationsAsync()
          .then((token) => {
            if (token) {
              console.log("[Register] ✅ Expo Push Token received, saving to Firestore...");
              return saveExpoPushTokenToUser(user.uid, token);
            } else {
              console.warn("[Register] No Expo Push Token received");
            }
          })
          .catch((error) => {
            console.error("[Register] Error in notification token process:", error);
            // Token kaydetme hatası kayıt işlemini durdurmaz
          });

        // Ana sayfaya yönlendir
        router.replace("/(tabs)/home");
      }
    } catch (error: any) {
      console.error("Google register error:", error);
      Alert.alert("Hata", error.message || "Google ile kayıt olurken bir hata oluştu.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      setGoogleLoading(true);
      await promptAsync();
    } catch (error: any) {
      console.error("Google prompt error:", error);
      Alert.alert("Hata", "Google kayıt başlatılamadı.");
      setGoogleLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Hata", "Tüm alanlar zorunlu.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Hata", "Şifre en az 6 karakter olmalıdır.");
      return;
    }

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Email doğrulama gönder
      try {
        await sendEmailVerification(cred.user);
        console.log("[Register] ✅ Email verification sent successfully to:", email);
      } catch (emailError: any) {
        console.error("[Register] ❌ Email verification error:", emailError);
        // Email gönderim hatası kayıt işlemini durdurmaz
      }

      // Kullanıcı verilerini Firestore'a kaydet
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        email,
        role: "student",
        createdAt: serverTimestamp(),
        emailVerified: false,
      });

      // Bildirim token'ı al ve kaydet (arka planda, bloklamadan)
      registerForPushNotificationsAsync()
        .then((token) => {
          if (token) {
            console.log("[Register] ✅ Expo Push Token received, saving to Firestore...");
            return saveExpoPushTokenToUser(cred.user.uid, token);
          } else {
            console.warn("[Register] No Expo Push Token received");
          }
        })
        .catch((error) => {
          console.error("[Register] Error in notification token process:", error);
          // Token kaydetme hatası kayıt işlemini durdurmaz
        });

      Alert.alert("Başarılı", "Kayıt başarılı! Email doğrulama linki gönderildi. Lütfen email kutunuzu kontrol edin.", [
        {
          text: "Tamam",
          onPress: () => router.replace("/auth/verify-email"),
        },
      ]);
    } catch (error: any) {
      console.error("Register error:", error);
      let errorMessage = "Kayıt olurken bir hata oluştu.";
      
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Bu email adresi zaten kullanılıyor.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Şifre çok zayıf. En az 6 karakter olmalıdır.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Geçersiz email adresi.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Kayıt Hatası", errorMessage);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        {siteLogo ? (
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: siteLogo }}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        ) : (
          <Text style={styles.title}>{siteName}</Text>
        )}
        <Text style={styles.subtitle}>Kayıt Ol</Text>

        <TextInput
          style={styles.input}
          placeholder="Ad Soyad"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="E-posta"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Şifre (min. 6 karakter)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Kayıt Ol</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>veya</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
          onPress={handleGoogleRegister}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#4285F4" />
          ) : (
            <>
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIcon}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Google ile Kayıt Ol</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.back()}
        >
          <Text style={styles.linkText}>Zaten hesabınız var mı? Giriş yapın</Text>
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
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
    color: "#333",
  },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  linkButton: {
    marginTop: 20,
    alignItems: "center",
  },
  linkText: {
    color: "#4CAF50",
    fontSize: 14,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    marginHorizontal: 15,
    color: "#666",
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  googleButtonText: {
    color: "#4285F4",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
  },
  googleIcon: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
  },
});
