/**
 * Her kullanıcı için otomatik token cleanup
 * Login/register sonrası otomatik çağrılır
 * Kullanıcının eski duplicate token'larını temizler
 */

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function autoCleanupUserTokens(userId: string): Promise<void> {
  try {    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {      return;
    }
    
    const userData = userSnap.data();
    const fcmTokens = (userData.fcmTokens as string[]) || [];    // Eğer 2+ token varsa, sadece son token'ı tut
    if (fcmTokens.length > 1) {
      const lastToken = fcmTokens[fcmTokens.length - 1];      await updateDoc(userRef, {
        fcmTokens: [lastToken],
        lastAutoCleanup: new Date(),
      });
      
    } else if (fcmTokens.length === 1) {
    } else {    }
  } catch (error) {    // Hata olsa bile devam et, token cleanup critical değil
  }
}

