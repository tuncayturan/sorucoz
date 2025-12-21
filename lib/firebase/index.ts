/**
 * Firebase ana export dosyası - React Native
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { GoogleAuthProvider } from "firebase/auth";
import { firebaseConfig } from "./config";

// Firebase'i lazy load et
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
      if (app && 'options' in app) {
        return app;
      }
      app = null;
    }
    
    // Yeni app initialize et
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      const errorMsg = "Firebase configuration is missing. Please check your environment variables.";
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    try {
      console.log("[Firebase] Initializing with config:", {
        apiKey: firebaseConfig.apiKey?.substring(0, 10) + "...",
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain
      });
      app = initializeApp(firebaseConfig);
    } catch (error: any) {
      console.error("Failed to initialize Firebase app:", error);
      throw error;
    }
  }
  
  return app;
}

// Auth - lazy load
export function getAuthInstance(): Auth {
  if (!authInstance) {
    try {
      const app = getApp();
      if (!app || !('options' in app)) {
        throw new Error("Firebase app not properly initialized");
      }
      authInstance = getAuth(app);
    } catch (error) {
      console.error("Firebase Auth initialization failed:", error);
      throw error;
    }
  }
  return authInstance;
}

export const auth: Auth = (() => {
  try {
    return getAuthInstance();
  } catch (error) {
    console.error("Firebase Auth export failed:", error);
    throw error;
  }
})();

export const googleProvider: GoogleAuthProvider = (() => {
  if (!googleProviderInstance) {
    googleProviderInstance = new GoogleAuthProvider();
  }
  return googleProviderInstance;
})();

// Firestore - lazy load
export function getDbInstance(): Firestore {
  if (!dbInstance) {
    try {
      const app = getApp();
      if (!app || !('options' in app)) {
        throw new Error("Firebase app not properly initialized");
      }
      dbInstance = getFirestore(app);
      console.log("[Firebase DB] Firestore instance created successfully");
    } catch (error: any) {
      console.error("[Firebase DB] Firestore initialization failed:", error);
      throw error;
    }
  }
  
  if (!dbInstance) {
    throw new Error("Firebase Firestore instance could not be initialized");
  }
  
  return dbInstance;
}

export const db: Firestore = (() => {
  try {
    return getDbInstance();
  } catch (error) {
    console.error("[Firebase DB] Initial export failed:", error);
    throw error;
  }
})();

// Storage - lazy load
export const storage: FirebaseStorage = (() => {
  if (!storageInstance) {
    try {
      storageInstance = getStorage(getApp());
    } catch (error) {
      console.error("Firebase Storage initialization failed:", error);
      throw error;
    }
  }
  return storageInstance;
})();

// App instance
export { getApp as getFirebaseApp };
