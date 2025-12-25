import { Capacitor } from '@capacitor/core';

export interface GoogleSignInResult {
  idToken: string;
  accessToken: string | null;
  email: string;
  displayName: string;
  photoUrl: string | null;
  serverAuthCode: string | null;
}

// Global handler'lar - MainActivity'den çağrılacak
declare global {
  interface Window {
    handleNativeGoogleSignIn?: (result: GoogleSignInResult) => void;
    handleNativeGoogleSignInError?: (error: { error: string; code: number }) => void;
  }
}

export const GoogleSignIn = {
  /**
   * Native Google Sign-In başlatır (sadece Android)
   * Web'de çalışmaz, web için signInWithPopup kullanılmalı
   */
  async signIn(): Promise<GoogleSignInResult> {
    if (Capacitor.getPlatform() === 'web') {
      throw new Error('Native Google Sign-In is not available on web. Use signInWithPopup instead.');
    }

    // Android WebView'den native kodu çağır
    if (typeof (window as any).AndroidGoogleSignIn !== 'undefined') {
      return new Promise((resolve, reject) => {
        // Global handler'ları ayarla
        window.handleNativeGoogleSignIn = (result: GoogleSignInResult) => {
          window.handleNativeGoogleSignIn = undefined;
          window.handleNativeGoogleSignInError = undefined;
          resolve(result);
        };

        window.handleNativeGoogleSignInError = (error: { error: string; code: number }) => {
          window.handleNativeGoogleSignIn = undefined;
          window.handleNativeGoogleSignInError = undefined;
          reject(new Error(error.error));
        };

        // Native Android kodu çağır
        (window as any).AndroidGoogleSignIn.signIn();
      });
    } else {
      throw new Error('Native Google Sign-In is not available. AndroidGoogleSignIn interface not found.');
    }
  },

  /**
   * Google Sign-Out yapar
   */
  async signOut(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      // Web'de Firebase signOut kullanılmalı
      return;
    }
    // Sign-out için şimdilik Firebase signOut kullan
    // İleride native signOut eklenebilir
  },

  /**
   * Native Google Sign-In'in mevcut olup olmadığını kontrol eder
   */
  isAvailable(): boolean {
    if (Capacitor.getPlatform() === 'web') {
      return false;
    }
    return typeof (window as any).AndroidGoogleSignIn !== 'undefined';
  },
};

