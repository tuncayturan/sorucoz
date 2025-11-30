import { checkSubscriptionStatus } from "./subscriptionUtils";
import { Timestamp } from "firebase/firestore";
import type { UserData } from "@/hooks/useUserData";

/**
 * Kullanıcının abonelik süresinin dolup dolmadığını kontrol eder
 * Trial (7 gün), Lite (30 gün) veya Premium (30 gün) süresi dolmuşsa true döner
 */
export function isSubscriptionExpired(userData: UserData | null | undefined): boolean {
  if (!userData) return false;

  const subscriptionStatus = checkSubscriptionStatus(
    userData.trialEndDate || null,
    userData.subscriptionEndDate || null,
    userData.premium,
    userData.createdAt
  );

  // Eğer subscription status "expired" ise, abonelik süresi dolmuş demektir
  return subscriptionStatus === "expired";
}

/**
 * Kullanıcının premium sayfasına yönlendirilmesi gerekip gerekmediğini kontrol eder
 */
export function shouldRedirectToPremium(userData: UserData | null | undefined): boolean {
  return isSubscriptionExpired(userData);
}

