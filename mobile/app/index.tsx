import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function AppEntry() {
  const router = useRouter();
  const segments = useSegments();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/auth/login");
    } else {
      router.replace("/(tabs)/home");
    }
  }, [user, loading]);

  if (loading) {
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
