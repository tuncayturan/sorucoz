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

// Firebase'i lazy load et - build sırasında environment variables olmayabilir
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;

function getApp(): FirebaseApp {
  if (!app) {
    // Runtime'da (browser'da) config kontrolü yap
    if (typeof window !== "undefined") {
      // Browser'da çalışıyorsak, config olmalı
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        throw new Error(
          "Firebase configuration is missing. Please check your environment variables."
        );
      }
    } else {
      // Build sırasında environment variables yoksa hata verme
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        // Build sırasında dummy app döndür (runtime'da tekrar denenecek)
        // Sadece development'ta logla
        if (process.env.NODE_ENV === "development") {
          console.warn("Firebase config not available during build - this is OK, will retry at runtime");
        }
        // Dummy app instance döndür (sadece build sırasında)
        return {} as FirebaseApp;
      }
    }
    
    // Mevcut app varsa onu kullan, yoksa yeni initialize et
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(firebaseConfig);
    }
  }
  
  // Runtime'da app'in düzgün initialize edildiğini kontrol et
  if (typeof window !== "undefined" && (!app || !('options' in app))) {
    // App düzgün initialize edilmemişse, tekrar dene
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      app = initializeApp(firebaseConfig);
    } else {
      throw new Error(
        "Firebase app not properly initialized. Please check your environment variables."
      );
    }
  }
  
  return app;
}

// Auth - lazy load (getter function olarak)
// For runtime access, use this function
export function getAuthInstance(): Auth {
  if (!authInstance) {
    try {
      const app = getApp();
      // App'in düzgün initialize edildiğini kontrol et
      if (!app || !('options' in app)) {
        throw new Error("Firebase app not properly initialized");
      }
      authInstance = getAuth(app);
    } catch (error) {
      // Runtime'da tekrar dene
      if (typeof window !== "undefined") {
        // Browser'da çalışıyorsak tekrar dene
        try {
          const app = initializeApp(firebaseConfig);
          authInstance = getAuth(app);
        } catch (retryError) {
          console.error("Firebase Auth initialization failed:", retryError);
          throw retryError;
        }
      } else {
        // Build sırasında hata olabilir, runtime'da tekrar denenecek
        if (process.env.NODE_ENV === "development") {
          console.warn("Firebase Auth initialization failed (this is OK during build):", error);
        }
        throw error;
      }
    }
  }
  return authInstance;
}

// Auth instance export (db ve storage gibi)
export const auth: Auth = (() => {
  try {
    return getAuthInstance();
  } catch (error) {
    // Build sırasında hata olabilir, runtime'da tekrar denenecek
    if (process.env.NODE_ENV === "development") {
      console.warn("Firebase Auth export failed (this is OK during build):", error);
    }
    // Dummy auth instance döndür (build sırasında)
    return {} as Auth;
  }
})();

export const googleProvider: GoogleAuthProvider = (() => {
  if (!googleProviderInstance) {
    googleProviderInstance = new GoogleAuthProvider();
  }
  return googleProviderInstance;
})();

// Firestore - lazy load
export const db: Firestore = (() => {
  if (!dbInstance) {
    try {
      dbInstance = getFirestore(getApp());
    } catch (error) {
      // Sadece development'ta logla, production build'de sessiz kal
      if (process.env.NODE_ENV === "development") {
        console.warn("Firebase Firestore initialization failed (this is OK during build):", error);
      }
      // Dummy db instance döndür (build sırasında)
      return {} as Firestore;
    }
  }
  return dbInstance;
})();

// Storage - lazy load
export const storage: FirebaseStorage = (() => {
  if (!storageInstance) {
    try {
      storageInstance = getStorage(getApp());
    } catch (error) {
      // Sadece development'ta logla, production build'de sessiz kal
      if (process.env.NODE_ENV === "development") {
        console.warn("Firebase Storage initialization failed (this is OK during build):", error);
      }
      // Dummy storage instance döndür (build sırasında)
      return {} as FirebaseStorage;
    }
  }
  return storageInstance;
})();

// Messaging (FCM) - sadece browser'da çalışır
export const getMessagingInstance = (): Messaging | null => {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    try {
      return getMessaging(getApp());
    } catch (error) {
      console.error("Error initializing messaging:", error);
      return null;
    }
  }
  return null;
};

// App instance (gerekirse export edilebilir)
export { getApp as getFirebaseApp };

