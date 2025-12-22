import { Stack } from "expo-router";
import { AuthProvider } from "@/context/AuthContext";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="landing" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/verify-email" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="admin" />
      </Stack>
    </AuthProvider>
  );
}
