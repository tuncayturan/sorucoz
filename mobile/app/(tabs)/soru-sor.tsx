import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { db } from "@/lib/firebase";
import { collection, addDoc, Timestamp, updateDoc, doc } from "firebase/firestore";
import Constants from "expo-constants";

// API base URL - web sunucusunun URL'ini buraya ekleyin
// Örnek: "https://your-domain.com" veya "http://localhost:3000" (development için)
// app.json'daki extra.apiBaseUrl'den alınır, yoksa localhost kullanılır
const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 
                     (__DEV__ ? "http://localhost:3000" : "https://your-domain.com");

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
  isVisible: boolean;
}

export default function SoruSorScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detectingSubject, setDetectingSubject] = useState(false);
  const [detectedSubject, setDetectedSubject] = useState<string>("");
  const [toast, setToast] = useState<ToastState>({
    message: "",
    type: "info",
    isVisible: false,
  });

  // Kamera ve galeri izinlerini kontrol et
  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: mediaLibraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== "granted") {
        Alert.alert(
          "Kamera İzni Gerekli",
          "Kameradan fotoğraf çekmek için kamera izni gerekiyor.",
          [{ text: "Tamam" }]
        );
      }
      
      if (mediaLibraryStatus !== "granted") {
        Alert.alert(
          "Galeri İzni Gerekli",
          "Galeriden fotoğraf seçmek için galeri izni gerekiyor.",
          [{ text: "Tamam" }]
        );
      }
    })();
  }, []);

  // Kullanıcı kontrolü
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, isVisible: false }));
    }, 3000);
  };

  // Kameradan fotoğraf çek
  const handleOpenCamera = async () => {
    try {
      // Önce izin kontrolü yap
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Kamera İzni Gerekli",
          "Kameradan fotoğraf çekmek için kamera izni gerekiyor. Lütfen ayarlardan izin verin.",
          [{ text: "Tamam" }]
        );
        return;
      }

      // Kamera aç
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Editing bazen sorun çıkarabilir
        quality: 0.8,
        base64: false,
      });

      console.log("Kamera result:", result);

      // Result kontrolü
      if (result && !result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log("Seçilen resim URI:", imageUri);
        setSelectedImage(imageUri);
        showToast("Fotoğraf seçildi!", "success");
      } else if (result && result.canceled) {
        console.log("Kullanıcı iptal etti");
        // İptal edildi, sessizce devam et
      } else {
        console.warn("Beklenmeyen result formatı:", result);
        showToast("Fotoğraf seçilemedi. Lütfen tekrar deneyin.", "error");
      }
    } catch (error: any) {
      console.error("Kamera hatası:", error);
      showToast(
        error.message || "Kameraya erişim izni verilmedi veya bir hata oluştu.",
        "error"
      );
    }
  };

  // Galeriden fotoğraf seç
  const handlePickImage = async () => {
    try {
      // Önce izin kontrolü yap
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Galeri İzni Gerekli",
          "Galeriden fotoğraf seçmek için galeri izni gerekiyor. Lütfen ayarlardan izin verin.",
          [{ text: "Tamam" }]
        );
        return;
      }

      // Galeri aç
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Editing bazen sorun çıkarabilir
        quality: 0.8,
        base64: false,
      });

      console.log("Galeri result:", result);

      // Result kontrolü
      if (result && !result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        console.log("Seçilen resim URI:", imageUri);
        setSelectedImage(imageUri);
        showToast("Fotoğraf seçildi!", "success");
      } else if (result && result.canceled) {
        console.log("Kullanıcı iptal etti");
        // İptal edildi, sessizce devam et
      } else {
        console.warn("Beklenmeyen result formatı:", result);
        showToast("Fotoğraf seçilemedi. Lütfen tekrar deneyin.", "error");
      }
    } catch (error: any) {
      console.error("Galeri hatası:", error);
      showToast(
        error.message || "Galeriye erişim izni verilmedi veya bir hata oluştu.",
        "error"
      );
    }
  };

  // Ders tespit et (AI)
  const detectSubject = async (imageUrl: string): Promise<string> => {
    try {
      setDetectingSubject(true);
      const response = await fetch(`${API_BASE_URL}/api/ai/detect-subject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        throw new Error("Ders tespit edilemedi");
      }

      const data = await response.json();
      return data.subject || "Bilinmeyen";
    } catch (error) {
      console.error("Ders tespit hatası:", error);
      return "Bilinmeyen";
    } finally {
      setDetectingSubject(false);
    }
  };

  // Soruyu yükle
  const handleUpload = async () => {
    if (!user) {
      showToast("Lütfen giriş yapın.", "error");
      return;
    }

    if (!selectedImage) {
      showToast("Lütfen bir soru resmi seçin veya çekin.", "error");
      return;
    }

    try {
      setUploading(true);

      // Resmi FormData'ya dönüştür
      const formData = new FormData();
      
      // React Native'de File yerine URI kullanıyoruz
      const filename = selectedImage.split("/").pop() || "image.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      // React Native FormData formatı
      formData.append("file", {
        uri: selectedImage,
        name: filename,
        type: type,
      } as any);

      // Cloudinary'ye yükle
      // Not: React Native'de Content-Type header'ını manuel eklemeyin, fetch otomatik ekler
      const uploadResponse = await fetch(`${API_BASE_URL}/api/cloudinary/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Resim yükleme başarısız");
      }

      const uploadData = await uploadResponse.json();
      const imageUrl = uploadData.url;

      // AI ile ders tespit et
      const subject = await detectSubject(imageUrl);
      setDetectedSubject(subject);

      // Firestore'a kaydet
      const questionsRef = collection(db, "users", user.uid, "sorular");
      const questionDoc = await addDoc(questionsRef, {
        soruImgUrl: imageUrl,
        ders: subject,
        createdAt: Timestamp.now(),
        status: "pending", // pending, answered, solved
        solution: null, // Çözüm adımları
        solving: false, // AI çözüm başlatılacak mı?
      });

      // AI ile soruyu çöz (arka planda)
      try {
        const solveResponse = await fetch(`${API_BASE_URL}/api/ai/solve-question`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageUrl, ders: subject }),
        });

        if (solveResponse.ok) {
          const solutionData = await solveResponse.json();
          
          // Çözümü Firestore'a kaydet
          const questionDocRef = doc(db, "users", user.uid, "sorular", questionDoc.id);
          await updateDoc(questionDocRef, {
            solution: solutionData,
            status: "answered", // Çözüm hazır
            solving: false,
          });
        } else {
          // Çözüm başarısız oldu, sadece durumu güncelle
          const questionDocRef = doc(db, "users", user.uid, "sorular", questionDoc.id);
          await updateDoc(questionDocRef, {
            solving: false,
          });
        }
      } catch (solveError: any) {
        console.error("Çözüm hatası:", solveError);
        // Hata olsa bile soru kaydedildi, sadece solving durumunu güncelle
        const questionDocRef = doc(db, "users", user.uid, "sorular", questionDoc.id);
        await updateDoc(questionDocRef, {
          solving: false,
        });
      }

      showToast("Soru başarıyla yüklendi!", "success");

      // Formu temizle
      setSelectedImage(null);
      setDetectedSubject("");

      // Sorularım sayfasına yönlendir
      setTimeout(() => {
        router.push("/(tabs)/sorularim");
      }, 1500);
    } catch (error: any) {
      console.error("Yükleme hatası:", error);
      showToast(error.message || "Soru yüklenirken bir hata oluştu.", "error");
    } finally {
      setUploading(false);
      setDetectingSubject(false);
    }
  };

  if (authLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📸</Text>
        </View>
        <Text style={styles.title}>Soru Sor</Text>
        <Text style={styles.subtitle}>
          Sorunuzu yükleyin, yapay zeka otomatik olarak dersini tespit edecek
        </Text>
      </View>

      {/* Upload Area */}
      <View style={styles.uploadContainer}>
        {!selectedImage ? (
          <View style={styles.uploadOptions}>
            {/* Dosya Seç */}
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handlePickImage}
              activeOpacity={0.7}
            >
              <Text style={styles.uploadIcon}>📁</Text>
              <Text style={styles.uploadButtonText}>Galeriden Seç</Text>
              <Text style={styles.uploadSubtext}>Göz at veya sürükle-bırak</Text>
            </TouchableOpacity>

            {/* Veya */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>veya</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Kameradan Çek */}
            <TouchableOpacity
              style={[styles.uploadButton, styles.cameraButton]}
              onPress={handleOpenCamera}
              activeOpacity={0.7}
            >
              <Text style={styles.uploadIcon}>📷</Text>
              <Text style={[styles.uploadButtonText, styles.cameraButtonText]}>
                Kameradan Çek
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            {/* Preview */}
            <Image source={{ uri: selectedImage }} style={styles.previewImage} />

            {/* Actions */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => setSelectedImage(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.changeButtonText}>Değiştir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadSubmitButton, (uploading || detectingSubject) && styles.uploadSubmitButtonDisabled]}
                onPress={handleUpload}
                disabled={uploading || detectingSubject}
                activeOpacity={0.7}
              >
                {uploading || detectingSubject ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.uploadSubmitButtonText}>Soruyu Yükle</Text>
                )}
              </TouchableOpacity>
            </View>

            {detectedSubject && (
              <View style={styles.subjectContainer}>
                <Text style={styles.subjectText}>
                  Tespit edilen ders: <Text style={styles.subjectBold}>{detectedSubject}</Text>
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Toast Message */}
      {toast.isVisible && (
        <View style={[styles.toast, styles[`toast${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`]]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f7",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  uploadContainer: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadOptions: {
    gap: 16,
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  cameraButton: {
    borderStyle: "solid",
    borderColor: "#3b82f6",
    backgroundColor: "#3b82f6",
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 12,
    color: "#9ca3af",
  },
  cameraButtonText: {
    color: "#fff",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d1d5db",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    color: "#9ca3af",
  },
  previewContainer: {
    gap: 16,
  },
  previewImage: {
    width: "100%",
    height: 300,
    borderRadius: 16,
    resizeMode: "contain",
    backgroundColor: "#f3f4f6",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  changeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  changeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  uploadSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadSubmitButtonDisabled: {
    opacity: 0.6,
  },
  uploadSubmitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  subjectContainer: {
    backgroundColor: "#dbeafe",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  subjectText: {
    fontSize: 14,
    color: "#1e40af",
  },
  subjectBold: {
    fontWeight: "bold",
  },
  toast: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: "#10b981",
  },
  toastError: {
    backgroundColor: "#ef4444",
  },
  toastInfo: {
    backgroundColor: "#3b82f6",
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
});
