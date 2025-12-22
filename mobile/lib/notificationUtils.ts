/**
 * Notification utilities for React Native (Expo)
 * Handles Expo Push Notifications and saves tokens to Firestore
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "./firebase";

// Bildirim handler yapılandırması
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Bildirim izni iste ve Expo Push Token al
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    console.log("[Notifications] 🚀 Starting push notification registration...");

    // Cihaz kontrolü
    if (!Device.isDevice) {
      console.warn("[Notifications] ⚠️ Must use physical device for Push Notifications");
      return null;
    }

    // Mevcut izin durumunu kontrol et
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // İzin yoksa iste
    if (existingStatus !== "granted") {
      console.log("[Notifications] 📝 Requesting notification permissions...");
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[Notifications] ⚠️ Failed to get push token for push notification!");
      return null;
    }

    console.log("[Notifications] ✅ Permissions granted");

    // Expo Push Token al
    console.log("[Notifications] 📞 Getting Expo Push Token...");
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "949d2310-ed92-4a67-9a8f-e64ac2eccf76", // EAS project ID from app.json
    });

    const token = tokenData.data;
    console.log("[Notifications] ✅ Expo Push Token received:", token.substring(0, 40) + "...");

    // Android için notification channel oluştur
    if (Platform.OS === "android") {
      console.log("[Notifications] 📱 Configuring Android notification channel...");
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
      });
    }

    return token;
  } catch (error: any) {
    console.error("[Notifications] ❌ Error registering for push notifications:", error);
    return null;
  }
}

/**
 * Kullanıcının Expo Push Token'ını Firestore'a kaydet
 * Web uygulamasındaki saveFCMTokenToUser ile benzer mantık
 */
export async function saveExpoPushTokenToUser(userId: string, token: string): Promise<void> {
  try {
    console.log("[Notifications] 💾 Saving Expo Push Token to Firestore...");
    console.log("[Notifications] User:", userId);
    console.log("[Notifications] Token (preview):", token.substring(0, 40) + "...");

    const userRef = doc(db, "users", userId);

    // Mevcut token'ları kontrol et
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const existingTokens = (userSnap.data().fcmTokens as string[]) || [];

      // Token zaten varsa güncelleme yapma
      if (existingTokens.includes(token)) {
        console.log("[Notifications] ✅ Token already exists, no update needed");
        return;
      }

      // Yeni token'ı ekle (eski token'ları koru - web ve mobil token'ları birlikte tut)
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
      });

      console.log("[Notifications] ✅ Token added to Firestore");
    } else {
      console.warn("[Notifications] ⚠️ User document not found, creating with token...");
      await updateDoc(userRef, {
        fcmTokens: [token],
      });
    }
  } catch (error: any) {
    console.error("[Notifications] ❌ Error saving token to Firestore:", error);
    throw error;
  }
}

/**
 * Bildirim listener'ları kur
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) {
  // Foreground notification handler
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log("[Notifications] 📬 Notification received (foreground):", notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Background/Tapped notification handler
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log("[Notifications] 👆 Notification tapped:", response);
    if (onNotificationTapped) {
      onNotificationTapped(response);
    }
  });

  return {
    remove: () => {
      Notifications.removeNotificationSubscription(receivedListener);
      Notifications.removeNotificationSubscription(responseListener);
    },
  };
}
