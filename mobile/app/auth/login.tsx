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
import { signInWithEmailAndPassword, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "expo-router";
import { useAuth as useAuthContext } from "@/context/AuthContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { registerForPushNotificationsAsync, saveExpoPushTokenToUser } from "@/lib/notificationUtils";

// WebBrowser'ı tamamla
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { settings } = useSiteSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const siteLogo = settings.logo && settings.logo.trim() !== "" ? settings.logo : null;
  const siteName = settings.siteName || "SoruÇöz";

  // Eğer zaten giriş yapılmışsa ana sayfaya yönlendir
  if (user) {
    router.replace("/(tabs)/home");
    return null;
  }

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
        } else {
          // Mevcut kullanıcı - photoURL güncelle (eğer yoksa)
          const existingData = snap.data();
          if (user.photoURL && !existingData.photoURL) {
            await setDoc(ref, {
              photoURL: user.photoURL,
            }, { merge: true });
          }
        }

        // Bildirim token'ı al ve kaydet (arka planda, bloklamadan)
        registerForPushNotificationsAsync()
          .then((token) => {
            if (token) {
              console.log("[Login] ✅ Expo Push Token received, saving to Firestore...");
              return saveExpoPushTokenToUser(user.uid, token);
            } else {
              console.warn("[Login] No Expo Push Token received");
            }
          })
          .catch((error) => {
            console.error("[Login] Error in notification token process:", error);
            // Token kaydetme hatası giriş işlemini durdurmaz
          });

        // Ana sayfaya yönlendir
        router.replace("/(tabs)/home");
      }
    } catch (error: any) {
      console.error("Google login error:", error);
      Alert.alert("Hata", error.message || "Google ile giriş yapılırken bir hata oluştu.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      await promptAsync();
    } catch (error: any) {
      console.error("Google prompt error:", error);
      Alert.alert("Hata", "Google giriş başlatılamadı.");
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Hata", "Tüm alanlar zorunlu.");
      return;
    }

    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const ref = doc(db, "users", cred.user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        Alert.alert("Hata", "Hesap bulunamadı. Lütfen kayıt olun.");
        setLoading(false);
        return;
      }

      const userData = snap.data();
      const role = userData.role;
      const emailVerified = userData.emailVerified || false;

      // Email doğrulama kontrolü - Sadece normal email/password ile kayıt olmuş ve doğrulanmamış kullanıcılar için
      const isGoogleUser = cred.user.providerData?.some((p: any) => p.providerId === 'google.com');
      // Google ile giriş/kayıt olanlar veya admin tarafından eklenen kullanıcılar (emailVerified: true) için email doğrulaması gerektirme
      if (!isGoogleUser && !cred.user.emailVerified && emailVerified !== true) {
        Alert.alert("Email Doğrulama", "Email adresinizi doğrulamanız gerekiyor. Lütfen email kutunuzu kontrol edin.");
        // Yine de giriş yapabilir ama uyarı almış olur
      }

      // Bildirim token'ı al ve kaydet (arka planda, bloklamadan)
      registerForPushNotificationsAsync()
        .then((token) => {
          if (token) {
            console.log("[Login] ✅ Expo Push Token received, saving to Firestore...");
            return saveExpoPushTokenToUser(cred.user.uid, token);
          } else {
            console.warn("[Login] No Expo Push Token received");
          }
        })
        .catch((error) => {
          console.error("[Login] Error in notification token process:", error);
          // Token kaydetme hatası giriş işlemini durdurmaz
        });

      // Role'e göre yönlendir
      if (role === "admin") {
        router.replace("/admin");
      } else if (role === "coach") {
        router.replace("/coach");
      } else {
        router.replace("/(tabs)/home");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Giriş yapılırken bir hata oluştu.";
      
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        errorMessage = "Email veya şifre hatalı.";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "Kullanıcı bulunamadı. Lütfen kayıt olun.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Bağlantı hatası. İnternet bağlantınızı kontrol edin.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("Giriş Hatası", errorMessage);
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
        <Text style={styles.subtitle}>Giriş Yap</Text>

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
          placeholder="Şifre"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Giriş Yap</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>veya</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
          onPress={handleGoogleLogin}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#4285F4" />
          ) : (
            <>
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIcon}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Google ile Giriş Yap</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push("/auth/register")}
        >
          <Text style={styles.linkText}>Hesabınız yok mu? Kayıt olun</Text>
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
    marginBottom: 8,
    color: "#333",
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 30,
    color: "#666",
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
});
