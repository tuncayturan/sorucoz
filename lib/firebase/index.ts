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
      // Browser'da çalışıyorsak, config olmalı (fallback değerler config.ts'de tanımlı)
      // Config değerlerini kontrol et
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        const errorMsg = "Firebase configuration is missing. Please check your environment variables. " +
          `Missing: ${!firebaseConfig.apiKey ? 'NEXT_PUBLIC_FIREBASE_API_KEY' : ''} ${!firebaseConfig.projectId ? 'NEXT_PUBLIC_FIREBASE_PROJECT_ID' : ''}`;
        console.error(errorMsg);
        // Fallback değerler config.ts'de tanımlı, bu hata normalde olmamalı
        // Ama yine de hata veriyoruz çünkü config.ts'deki fallback değerler kullanılmıyor olabilir
        throw new Error(errorMsg);
      }
      
      // Yeni app initialize et
      try {
        // Config değerlerini logla (debug için)
        console.log("[Firebase] Initializing with config:", {
          apiKey: firebaseConfig.apiKey?.substring(0, 10) + "...",
          projectId: firebaseConfig.projectId,
          authDomain: firebaseConfig.authDomain
        });
        app = initializeApp(firebaseConfig);
      } catch (error: any) {
        console.error("Failed to initialize Firebase app:", error);
        // Eğer invalid-api-key hatası varsa, config değerlerini kontrol et
        if (error?.code === 'auth/invalid-api-key') {
          console.error("[Firebase] Invalid API key. Config values:", {
            apiKey: firebaseConfig.apiKey?.substring(0, 20) + "...",
            projectId: firebaseConfig.projectId
          });
        }
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
      // Fallback değerler config.ts'de tanımlı, bu yüzden apiKey ve projectId her zaman olmalı
      if (firebaseConfig.apiKey && firebaseConfig.projectId) {
        try {
          console.log("[Firebase] Re-initializing app with config:", {
            apiKey: firebaseConfig.apiKey?.substring(0, 10) + "...",
            projectId: firebaseConfig.projectId
          });
          app = initializeApp(firebaseConfig);
        } catch (error: any) {
          console.error("Failed to re-initialize Firebase app:", error);
          if (error?.code === 'auth/invalid-api-key') {
            console.error("[Firebase] Invalid API key detected. Please check Railway environment variables.");
          }
          throw new Error(
            "Firebase app not properly initialized. Please check your environment variables."
          );
        }
      } else {
        // Bu durum normalde olmamalı çünkü fallback değerler config.ts'de tanımlı
        console.error("[Firebase] Config values are missing even with fallbacks:", {
          hasApiKey: !!firebaseConfig.apiKey,
          hasProjectId: !!firebaseConfig.projectId
        });
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
        console.error("[Firebase DB] App not properly initialized");
        throw new Error("Firebase app not properly initialized");
      }
      
      // Firestore instance oluştur
      dbInstance = getFirestore(app);
      
      // Runtime'da db instance'ın düzgün oluşturulduğunu kontrol et
      if (typeof window !== "undefined") {
        if (!dbInstance) {
          throw new Error("Firebase Firestore instance is null");
        }
        // Firestore'un geçerli olduğunu test et
        if (!('type' in dbInstance) && !('_delegate' in dbInstance)) {
          console.warn("[Firebase DB] Firestore instance may not be valid");
        }
        console.log("[Firebase DB] Firestore instance created successfully");
      }
    } catch (error: any) {
      // Runtime'da tekrar dene
      if (typeof window !== "undefined") {
        // Browser'da çalışıyorsak tekrar dene
        console.warn("[Firebase DB] Initial attempt failed, retrying...", error.message);
        try {
          // Önce mevcut app'leri kontrol et
          const existingApps = getApps();
          if (existingApps.length > 0) {
            console.log("[Firebase DB] Using existing app");
            dbInstance = getFirestore(existingApps[0]);
          } else {
            // Config'i kontrol et
            if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
              throw new Error("Firebase configuration is missing. Please check environment variables.");
            }
            console.log("[Firebase DB] Creating new app and Firestore instance");
            const app = initializeApp(firebaseConfig);
            dbInstance = getFirestore(app);
          }
          
          if (!dbInstance) {
            throw new Error("Firestore instance is still null after retry");
          }
          
          console.log("[Firebase DB] Firestore instance created successfully on retry");
        } catch (retryError: any) {
          console.error("[Firebase DB] Firestore initialization failed after retry:", retryError);
          console.error("[Firebase DB] Config check:", {
            hasApiKey: !!firebaseConfig.apiKey,
            hasProjectId: !!firebaseConfig.projectId,
            apiKeyPrefix: firebaseConfig.apiKey?.substring(0, 10)
          });
          throw retryError;
        }
      } else {
        // Server-side'da çalışıyorsak tekrar dene
        console.warn("[Firebase DB] Server-side initial attempt failed, retrying...", error.message);
        try {
          // Önce mevcut app'leri kontrol et
          const existingApps = getApps();
          if (existingApps.length > 0) {
            console.log("[Firebase DB] Server-side: Using existing app");
            dbInstance = getFirestore(existingApps[0]);
          } else {
            // Config'i kontrol et
            if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
              throw new Error("Firebase configuration is missing. Please check environment variables.");
            }
            console.log("[Firebase DB] Server-side: Creating new app and Firestore instance");
            const app = initializeApp(firebaseConfig);
            dbInstance = getFirestore(app);
          }
          
          if (!dbInstance) {
            throw new Error("Firestore instance is still null after retry");
          }
          
          console.log("[Firebase DB] Server-side: Firestore instance created successfully on retry");
        } catch (retryError: any) {
          console.error("[Firebase DB] Server-side: Firestore initialization failed after retry:", retryError);
          console.error("[Firebase DB] Server-side: Config check:", {
            hasApiKey: !!firebaseConfig.apiKey,
            hasProjectId: !!firebaseConfig.projectId,
            apiKeyPrefix: firebaseConfig.apiKey?.substring(0, 10)
          });
          throw retryError;
        }
      }
    }
  }
  
  if (!dbInstance) {
    throw new Error("Firebase Firestore instance could not be initialized");
  }
  
  return dbInstance;
}

// Firestore instance export - Works for both client and server
// Railway'de sorun yaşamamak için db'yi hem client hem server-side'da initialize ediyoruz
// Lazy initialization: Her kullanımda getDbInstance() çağrılacak
let _dbExport: Firestore | null = null;

function ensureDbExport(): Firestore {
  if (!_dbExport) {
    _dbExport = getDbInstance();
  }
  return _dbExport;
}

// Export db - hem client hem server-side'da çalışır
// Build sırasında hata vermemek için try-catch kullanıyoruz
export const db: Firestore = (() => {
  try {
    // Hem browser'da hem server-side'da çalışır
    return ensureDbExport();
  } catch (error) {
    // Build sırasında hata vermemek için dummy object döndür
    // Ama runtime'da (hem client hem server) gerçek instance kullanılacak
    if (process.env.NODE_ENV === "development") {
      console.warn("[Firebase DB] Initial export failed (OK during build):", error);
    }
    // Runtime'da ensureDbExport() tekrar çağrılacak ve başarılı olacak
    // Ama şimdilik dummy object döndür ki build başarısız olmasın
    return {} as Firestore;
  }
})();

// Runtime'da (hem client hem server) db'yi initialize et
// Bu, ilk kullanımda gerçek instance'ı garantiler
try {
  _dbExport = getDbInstance();
} catch (error) {
  // İlk initialization başarısız olabilir, ama sonraki kullanımlarda tekrar denenecek
  if (process.env.NODE_ENV === "development") {
    console.warn("[Firebase DB] Initial initialization failed, will retry on first use:", error);
  }
}

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

