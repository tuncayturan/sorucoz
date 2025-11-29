/**
 * Firebase yapılandırma dosyası
 */

// Default Firebase config (fallback olarak kullanılır)
const defaultFirebaseConfig = {
  apiKey: "AIzaSyDmvEdQicJmsPhFjDcXXgj5rK0LO9Er2KU",
  authDomain: "sorucoz-6deb3.firebaseapp.com",
  projectId: "sorucoz-6deb3",
  storageBucket: "sorucoz-6deb3.firebasestorage.app",
  messagingSenderId: "1026488924758",
  appId: "1:1026488924758:web:d4c081b5f87a62f10ed9f7",
};

// Environment variables'dan config oluştur, yoksa default değerleri kullan
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE || defaultFirebaseConfig.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
};

// Service Worker için config (public/firebase-messaging-sw.js'de kullanılır)
export const firebaseConfigForServiceWorker = defaultFirebaseConfig;

