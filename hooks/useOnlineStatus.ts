import { useEffect } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

/**
 * Kullanıcının çevrimiçi durumunu Firestore'da günceller
 * Her 30 saniyede bir lastSeen alanını günceller
 */
export function useOnlineStatus() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);

    // İlk güncelleme
    updateDoc(userRef, {
      lastSeen: serverTimestamp(),
      isOnline: true,
    }).catch((error) => {
      console.error("Error updating online status:", error);
    });

    // Her 30 saniyede bir güncelle
    const interval = setInterval(() => {
      updateDoc(userRef, {
        lastSeen: serverTimestamp(),
        isOnline: true,
      }).catch((error) => {
        console.error("Error updating online status:", error);
      });
    }, 30000); // 30 saniye

    // Sayfa kapatıldığında veya kullanıcı değiştiğinde temizle
    return () => {
      clearInterval(interval);
      // Kullanıcı çıktığında isOnline'ı false yap
      updateDoc(userRef, {
        isOnline: false,
      }).catch((error) => {
        console.error("Error updating offline status:", error);
      });
    };
  }, [user]);
}

