import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Hoş Geldiniz!</Text>
        <Text style={styles.subtitle}>{user?.email || "Kullanıcı"}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
});
