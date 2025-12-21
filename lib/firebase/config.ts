/**
 * Firebase yapılandırma dosyası - React Native
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

// Helper function: Boş string kontrolü yap, varsa trim et
const getEnvValue = (envVar: string | undefined, defaultValue: string): string => {
  if (!envVar || envVar.trim() === '') {
    return defaultValue;
  }
  return envVar.trim();
};

// Environment variables'dan config oluştur, yoksa veya boşsa default değerleri kullan
// React Native'de Constants.expoConfig.extra kullanılır
export const firebaseConfig = {
  apiKey: getEnvValue(
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 
    process.env.FIREBASE_API_KEY,
    defaultFirebaseConfig.apiKey
  ),
  authDomain: getEnvValue(
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 
    process.env.FIREBASE_AUTH_DOMAIN,
    defaultFirebaseConfig.authDomain
  ),
  projectId: getEnvValue(
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 
    process.env.FIREBASE_PROJECT_ID,
    defaultFirebaseConfig.projectId
  ),
  storageBucket: getEnvValue(
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE ||
    process.env.FIREBASE_STORAGE_BUCKET,
    defaultFirebaseConfig.storageBucket
  ),
  messagingSenderId: getEnvValue(
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 
    process.env.EXPO_PUBLIC_FIREBASE_SENDER_ID ||
    process.env.FIREBASE_MESSAGING_SENDER_ID,
    defaultFirebaseConfig.messagingSenderId
  ),
  appId: getEnvValue(
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 
    process.env.FIREBASE_APP_ID,
    defaultFirebaseConfig.appId
  ),
};
