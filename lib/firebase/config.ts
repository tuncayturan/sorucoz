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

// VAPID Key - FCM Push Notifications için gerekli
// Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// NOT: Bu public bir key'dir, güvenlik riski yaratmaz
const defaultVapidKey = "BPZp-eOLhT6q8kK9K7zqP8sNZJZQGxO5fL0yH3nH5xJ6nH2aL3nK9qP7mN8oL4iK6jH8gF9eE8dD7cC6bB5aA4";

export { defaultVapidKey };

// Helper function: Boş string kontrolü yap, varsa trim et
const getEnvValue = (envVar: string | undefined, defaultValue: string): string => {
  if (!envVar || envVar.trim() === '') {
    return defaultValue;
  }
  return envVar.trim();
};

// Environment variables'dan config oluştur, yoksa veya boşsa default değerleri kullan
export const firebaseConfig = {
  apiKey: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, defaultFirebaseConfig.apiKey),
  authDomain: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, defaultFirebaseConfig.authDomain),
  projectId: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, defaultFirebaseConfig.projectId),
  storageBucket: getEnvValue(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE,
    defaultFirebaseConfig.storageBucket
  ),
  messagingSenderId: getEnvValue(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
    defaultFirebaseConfig.messagingSenderId
  ),
  appId: getEnvValue(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, defaultFirebaseConfig.appId),
};

// Debug: Production'da config kaynağını logla (sadece browser'da)
if (typeof window !== 'undefined') {
  // Config değerlerinin default değerlerle aynı olup olmadığını kontrol et
  const usingFallback = 
    firebaseConfig.apiKey === defaultFirebaseConfig.apiKey &&
    firebaseConfig.projectId === defaultFirebaseConfig.projectId;
  
  if (usingFallback) {
    console.warn('[Firebase Config] Using fallback values. Environment variables may not be set in Railway.');
  } else {
    console.log('[Firebase Config] Using environment variables from Railway.');
  }
}

// Service Worker için config (public/firebase-messaging-sw.js'de kullanılır)
export const firebaseConfigForServiceWorker = defaultFirebaseConfig;

