import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

import { Timestamp } from "firebase/firestore";

export interface UserData {
  name: string;
  email: string;
  role: "student" | "coach" | "admin";
  premium: boolean;
  createdAt: any;
  emailVerified: boolean;
  fcmTokens?: string[];
  lastTokenUpdate?: any;
  photoURL?: string | null;
  // Trial ve Subscription
  trialStartDate?: Timestamp | null;
  trialEndDate?: Timestamp | null;
  subscriptionStatus?: "trial" | "active" | "expired";
  subscriptionPlan?: "trial" | "lite" | "premium";
  subscriptionStartDate?: Timestamp | null;
  subscriptionEndDate?: Timestamp | null;
  dailyQuestionCount?: number;
  lastQuestionDate?: string;
  // Bildirim ayarları
  notificationsEnabled?: boolean;
  notificationTypes?: {
    messages?: boolean;
    questions?: boolean;
    system?: boolean;
  };
}

export function useUserData() {
  const { user } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (!user) {
      setUserData(null);
      setLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        setLoading(true);
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setUserData(userSnap.data() as UserData);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user, refreshKey]);

  return { userData, loading, refresh };
}

