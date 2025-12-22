import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";

export default function CoachScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/landing");
    } else if (userData && userData.role !== "coach") {
      if (userData.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/(tabs)/home");
      }
    }
  }, [user, userData, authLoading, router]);

  useEffect(() => {
    if (user && userData?.role === "coach") {
      fetchStudents();
    }
  }, [user, userData]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("role", "==", "student"));
      const snapshot = await getDocs(q);

      const studentsList: any[] = [];
      snapshot.forEach((doc) => {
        studentsList.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      studentsList.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

      setStudents(studentsList);
    } catch (error) {
      console.error("Öğrenciler yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || userDataLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (!user || userData?.role !== "coach") {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Coach Paneli</Text>
        <TouchableOpacity
          onPress={async () => {
            const { signOut } = await import("firebase/auth");
            const { auth } = await import("@/lib/firebase");
            await signOut(auth);
            router.replace("/landing");
          }}
        >
          <Ionicons name="log-out-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={32} color="#4CAF50" />
            <Text style={styles.statNumber}>{students.length}</Text>
            <Text style={styles.statLabel}>Toplam Öğrenci</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/coach/chat")}
          >
            <Ionicons name="chatbubbles" size={24} color="#4CAF50" />
            <Text style={styles.menuItemText}>Öğrenci Mesajları</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/coach/students")}
          >
            <Ionicons name="people" size={24} color="#4CAF50" />
            <Text style={styles.menuItemText}>Öğrenciler</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/coach/calendar")}
          >
            <Ionicons name="calendar" size={24} color="#4CAF50" />
            <Text style={styles.menuItemText}>Takvim</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/coach/profile")}
          >
            <Ionicons name="person" size={24} color="#4CAF50" />
            <Text style={styles.menuItemText}>Profil</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f7",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#4CAF50",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f9f9f9",
    marginBottom: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
});
