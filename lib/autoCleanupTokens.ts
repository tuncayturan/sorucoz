/**
 * Her kullanıcı için otomatik token cleanup
 * Login/register sonrası otomatik çağrılır
 * Kullanıcının eski duplicate token'larını temizler
 */

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function autoCleanupUserTokens(userId: string): Promise<void> {
  try {
    console.log("[Auto Cleanup] 🧹 Starting auto cleanup for user:", userId);
    
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log("[Auto Cleanup] User not found, skipping");
      return;
    }
    
    const userData = userSnap.data();
    const fcmTokens = (userData.fcmTokens as string[]) || [];
    
    console.log("[Auto Cleanup] Current tokens:", fcmTokens.length);
    
    // Eğer 2+ token varsa, sadece son token'ı tut
    if (fcmTokens.length > 1) {
      const lastToken = fcmTokens[fcmTokens.length - 1];
      
      console.log("[Auto Cleanup] ⚠️ Found", fcmTokens.length, "tokens, keeping only the last one");
      
      await updateDoc(userRef, {
        fcmTokens: [lastToken],
        lastAutoCleanup: new Date(),
      });
      
      console.log("[Auto Cleanup] ✅ Cleaned", fcmTokens.length - 1, "duplicate token(s)");
    } else if (fcmTokens.length === 1) {
      console.log("[Auto Cleanup] ✅ Already clean (only 1 token)");
    } else {
      console.log("[Auto Cleanup] ℹ️ No tokens yet");
    }
  } catch (error) {
    console.error("[Auto Cleanup] ❌ Error:", error);
    // Hata olsa bile devam et, token cleanup critical değil
  }
}

