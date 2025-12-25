import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

export interface GoogleSignInResult {
  idToken: string;
  accessToken: string | null;
  email: string;
  displayName: string;
  photoUrl: string | null;
  serverAuthCode: string | null;
}

export interface GoogleSignInPlugin {
  signIn(): Promise<GoogleSignInResult>;
  signOut(): Promise<{ success: boolean }>;
}

const GoogleSignInNative = registerPlugin<GoogleSignInPlugin>('GoogleSignIn', {
  web: () => import('./google-sign-in.web').then(m => new m.GoogleSignInWeb()),
});

export const GoogleSignIn = {
  /**
   * Native Google Sign-In başlatır (sadece Android/iOS)
   * Web'de çalışmaz, web için signInWithPopup kullanılmalı
   */
  async signIn(): Promise<GoogleSignInResult> {
    if (Capacitor.getPlatform() === 'web') {
      throw new Error('Native Google Sign-In is not available on web. Use signInWithPopup instead.');
    }
    return GoogleSignInNative.signIn();
  },

  /**
   * Google Sign-Out yapar
   */
  async signOut(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      // Web'de Firebase signOut kullanılmalı
      return;
    }
    await GoogleSignInNative.signOut();
  },

  /**
   * Native Google Sign-In'in mevcut olup olmadığını kontrol eder
   */
  isAvailable(): boolean {
    return Capacitor.getPlatform() !== 'web';
  },
};

