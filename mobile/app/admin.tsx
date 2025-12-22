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
import { collection, query, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";

export default function AdminScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalStudents: 0,
    totalCoaches: 0,
    totalAdmins: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/landing");
    } else if (userData && userData.role !== "admin") {
      if (userData.role === "coach") {
        router.replace("/coach");
      } else {
        router.replace("/(tabs)/home");
      }
    }
  }, [user, userData, authLoading, router]);

  useEffect(() => {
    if (user && userData?.role === "admin") {
      fetchStats();
    }
  }, [user, userData]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      let totalUsers = 0;
      let totalStudents = 0;
      let totalCoaches = 0;
      let totalAdmins = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        totalUsers++;
        if (data.role === "student") totalStudents++;
        else if (data.role === "coach") totalCoaches++;
        else if (data.role === "admin") totalAdmins++;
      });

      setStats({
        totalUsers,
        totalStudents,
        totalCoaches,
        totalAdmins,
      });
    } catch (error) {
      console.error("İstatistikler yüklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || userDataLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!user || userData?.role !== "admin") {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Paneli</Text>
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
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={32} color="#3B82F6" />
            <Text style={styles.statNumber}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Toplam Kullanıcı</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="school" size={32} color="#4CAF50" />
            <Text style={styles.statNumber}>{stats.totalStudents}</Text>
            <Text style={styles.statLabel}>Öğrenci</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="person" size={32} color="#F59E0B" />
            <Text style={styles.statNumber}>{stats.totalCoaches}</Text>
            <Text style={styles.statLabel}>Coach</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="shield" size={32} color="#EF4444" />
            <Text style={styles.statNumber}>{stats.totalAdmins}</Text>
            <Text style={styles.statLabel}>Admin</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yönetim</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/admin/kullanicilar")}
          >
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={styles.menuItemText}>Kullanıcılar</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/admin/sorular")}
          >
            <Ionicons name="help-circle" size={24} color="#3B82F6" />
            <Text style={styles.menuItemText}>Sorular</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/admin/destek")}
          >
            <Ionicons name="chatbubbles" size={24} color="#3B82F6" />
            <Text style={styles.menuItemText}>Destek</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/admin/ayarlar")}
          >
            <Ionicons name="settings" size={24} color="#3B82F6" />
            <Text style={styles.menuItemText}>Site Ayarları</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/admin/istatistikler")}
          >
            <Ionicons name="stats-chart" size={24} color="#3B82F6" />
            <Text style={styles.menuItemText}>İstatistikler</Text>
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    width: "48%",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
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
