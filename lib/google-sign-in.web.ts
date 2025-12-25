/**
 * Web implementation for Google Sign-In
 * Web'de native plugin çalışmaz, bu sadece type safety için
 */
export class GoogleSignInWeb {
  async signIn(): Promise<never> {
    throw new Error('Google Sign-In is not available on web. Use Firebase signInWithPopup instead.');
  }

  async signOut(): Promise<{ success: boolean }> {
    return { success: true };
  }
}

