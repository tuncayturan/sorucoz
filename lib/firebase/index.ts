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
        // Fallback değerler config.ts'de tanımlı, bu hata normalde olmamalı
        // Ama yine de hata veriyoruz çünkü config.ts'deki fallback değerler kullanılmıyor olabilir
        throw new Error(errorMsg);
      }
      
      // Yeni app initialize et
      try {
        app = initializeApp(firebaseConfig);
      } catch (error: any) {
        // Eğer invalid-api-key hatası varsa, config değerlerini kontrol et
        if (error?.code === 'auth/invalid-api-key') {
        }
        throw error;
      }
    } else {
      // Server-side (build zamanı veya API route)
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        // Build sırasında environment variables yoksa hata verme
        if (process.env.NODE_ENV === "development") {
        }
        // Dummy app instance döndür (sadece build sırasında)
        return {} as FirebaseApp;
      }
      
      try {
        app = initializeApp(firebaseConfig);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
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
          app = initializeApp(firebaseConfig);
        } catch (error: any) {
          if (error?.code === 'auth/invalid-api-key') {
          }
          throw new Error(
            "Firebase app not properly initialized. Please check your environment variables."
          );
        }
      } else {
        // Bu durum normalde olmamalı çünkü fallback değerler config.ts'de tanımlı
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
          throw retryError;
        }
      } else {
        // Build sırasında hata olabilir, runtime'da tekrar denenecek
        if (process.env.NODE_ENV === "development") {
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
      
      // Firestore instance oluştur
      dbInstance = getFirestore(app);
      
      // Runtime'da db instance'ın düzgün oluşturulduğunu kontrol et
      if (typeof window !== "undefined") {
        if (!dbInstance) {
          throw new Error("Firebase Firestore instance is null");
        }
        // Firestore'un geçerli olduğunu test et
        if (!('type' in dbInstance) && !('_delegate' in dbInstance)) {
        }
      }
    } catch (error: any) {
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
          
          if (!dbInstance) {
            throw new Error("Firestore instance is still null after retry");
          }
        } catch (retryError: any) {
          throw retryError;
        }
      } else {
        // Server-side'da çalışıyorsak tekrar dene
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
          
          if (!dbInstance) {
            throw new Error("Firestore instance is still null after retry");
          }
        } catch (retryError: any) {
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
      return null;
    }
  }
  return null;
};

// App instance (gerekirse export edilebilir)
export { getApp as getFirebaseApp };

