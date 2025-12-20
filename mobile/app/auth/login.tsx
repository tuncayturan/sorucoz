import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "expo-router";
import { useAuth as useAuthContext } from "@/context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Eğer zaten giriş yapılmışsa ana sayfaya yönlendir
  if (user) {
    router.replace("/(tabs)/home");
    return null;
  }

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

      // Role'e göre yönlendir
      if (role === "admin") {
        router.replace("/(tabs)/home"); // Admin için özel sayfa eklenebilir
      } else if (role === "coach") {
        router.replace("/(tabs)/home"); // Coach için özel sayfa eklenebilir
      } else {
        router.replace("/(tabs)/home");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      Alert.alert("Hata", error.message || "Giriş yapılırken bir hata oluştu.");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>SoruÇöz</Text>
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
});
