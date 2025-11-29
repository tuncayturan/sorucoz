/**
 * Firebase ana export dosyası
 * Tüm Firebase servislerini buradan export ediyoruz
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getMessaging, Messaging } from "firebase/messaging";
import { GoogleAuthProvider } from "firebase/auth";
import { firebaseConfig } from "./config";

// Next.js hot reload bug fix
const app: FirebaseApp = !getApps().length 
  ? initializeApp(firebaseConfig) 
  : getApps()[0];

// Auth
export const auth: Auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore
export const db: Firestore = getFirestore(app);

// Storage
export const storage: FirebaseStorage = getStorage(app);

// Messaging (FCM) - sadece browser'da çalışır
export const getMessagingInstance = (): Messaging | null => {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    try {
      return getMessaging(app);
    } catch (error) {
      console.error("Error initializing messaging:", error);
      return null;
    }
  }
  return null;
};

// App instance (gerekirse export edilebilir)
export { app };

