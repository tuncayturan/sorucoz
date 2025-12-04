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
    userData.createdAt,
    userData.subscriptionPlan
  );

  // Eğer subscription status "expired" ise, abonelik süresi dolmuş demektir
  return subscriptionStatus === "expired";
}

/**
 * Kullanıcının premium sayfasına yönlendirilmesi gerekip gerekmediğini kontrol eder
 * FREEMIUM MOD: Trial süresi biten kullanıcılar yönlendirilmez (günde 1 soru hakkı var)
 */
export function shouldRedirectToPremium(userData: UserData | null | undefined): boolean {
  if (!userData) return false;
  
  const subscriptionStatus = checkSubscriptionStatus(
    userData.trialEndDate || null,
    userData.subscriptionEndDate || null,
    userData.premium,
    userData.createdAt,
    userData.subscriptionPlan
  );
  
  const currentPlan = userData.subscriptionPlan || "trial";
  
  // FREEMIUM MOD: Freemium kullanıcılar yönlendirilmez (günde 1 soru sorabilirler)
  if (currentPlan === "freemium" || subscriptionStatus === "freemium") {
    return false; // Freemium modunda kalabilir
  }
  
  // Trial expired olanları yönlendirme (freemium'a geçecek)
  if (currentPlan === "trial" && subscriptionStatus === "freemium") {
    return false;
  }
  
  // Lite/Premium expired olanları yönlendir (planı yenilemeli)
  return subscriptionStatus === "expired" && (currentPlan === "lite" || currentPlan === "premium");
}

