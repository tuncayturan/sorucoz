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
    // Mevcut app varsa onu kullan
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
      // App'in düzgün initialize edildiğini kontrol et
      if (app && 'options' in app) {
        return app;
      }
      // Eğer mevcut app düzgün değilse, yeni oluştur
      app = null;
    }
    
    // Runtime'da (browser'da) config kontrolü yap
    if (typeof window !== "undefined") {
      // Browser'da çalışıyorsak, config olmalı
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        const errorMsg = "Firebase configuration is missing. Please check your environment variables. " +
          `Missing: ${!firebaseConfig.apiKey ? 'NEXT_PUBLIC_FIREBASE_API_KEY' : ''} ${!firebaseConfig.projectId ? 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' : ''}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Yeni app initialize et
      try {
        app = initializeApp(firebaseConfig);
      } catch (error) {
        console.error("Failed to initialize Firebase app:", error);
        throw error;
      }
    } else {
      // Server-side (build zamanı veya API route)
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        // Build sırasında environment variables yoksa hata verme
        if (process.env.NODE_ENV === "development") {
          console.warn("Firebase config not available during build - this is OK, will retry at runtime");
        }
        // Dummy app instance döndür (sadece build sırasında)
        return {} as FirebaseApp;
      }
      
      try {
        app = initializeApp(firebaseConfig);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Firebase initialization failed (this is OK during build):", error);
        }
        return {} as FirebaseApp;
      }
    }
  }
  
  // Runtime'da app'in düzgün initialize edildiğini kontrol et
  if (typeof window !== "undefined") {
    if (!app || !('options' in app)) {
      // App düzgün initialize edilmemişse, tekrar dene
      if (firebaseConfig.apiKey && firebaseConfig.projectId) {
        try {
          app = initializeApp(firebaseConfig);
        } catch (error) {
          console.error("Failed to re-initialize Firebase app:", error);
          throw new Error(
            "Firebase app not properly initialized. Please check your environment variables."
          );
        }
      } else {
        throw new Error(
          "Firebase app not properly initialized. Please check your environment variables."
        );
      }
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

// Firestore - lazy load (getter function)
export function getDbInstance(): Firestore {
  if (!dbInstance) {
    try {
      const app = getApp();
      // App'in düzgün initialize edildiğini kontrol et
      if (!app || !('options' in app)) {
        throw new Error("Firebase app not properly initialized");
      }
      dbInstance = getFirestore(app);
      
      // Runtime'da db instance'ın düzgün oluşturulduğunu kontrol et
      if (typeof window !== "undefined" && !dbInstance) {
        throw new Error("Firebase Firestore instance is null");
      }
    } catch (error) {
      // Runtime'da tekrar dene
      if (typeof window !== "undefined") {
        // Browser'da çalışıyorsak tekrar dene
        try {
          // Önce mevcut app'leri kontrol et
          const existingApps = getApps();
          if (existingApps.length > 0) {
            dbInstance = getFirestore(existingApps[0]);
          } else {
            // Config'i kontrol et
            if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
              throw new Error("Firebase configuration is missing. Please check environment variables.");
            }
            const app = initializeApp(firebaseConfig);
            dbInstance = getFirestore(app);
          }
        } catch (retryError) {
          console.error("Firebase Firestore initialization failed:", retryError);
          throw retryError;
        }
      } else {
        // Build sırasında hata olabilir, runtime'da tekrar denenecek
        if (process.env.NODE_ENV === "development") {
          console.warn("Firebase Firestore initialization failed (this is OK during build):", error);
        }
        throw error;
      }
    }
  }
  
  if (!dbInstance) {
    throw new Error("Firebase Firestore instance could not be initialized");
  }
  
  return dbInstance;
}

// Firestore instance export - Proxy ile lazy loading
// Bu yaklaşım, her db kullanımında runtime'da gerçek instance'ı alır
export const db: Firestore = new Proxy({} as Firestore, {
  get(target, prop) {
    // Her property erişiminde gerçek db instance'ını al
    const realDb = getDbInstance();
    const value = (realDb as any)[prop];
    
    // Eğer function ise, context'i koru
    if (typeof value === 'function') {
      return value.bind(realDb);
    }
    
    return value;
  },
  
  // Proxy'nin diğer metodlarını da implement et
  has(target, prop) {
    try {
      const realDb = getDbInstance();
      return prop in realDb;
    } catch {
      return false;
    }
  },
  
  ownKeys(target) {
    try {
      const realDb = getDbInstance();
      return Reflect.ownKeys(realDb);
    } catch {
      return [];
    }
  }
});

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

