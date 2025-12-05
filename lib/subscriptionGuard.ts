import { checkSubscriptionStatus, type SubscriptionPlan, type SubscriptionStatus } from "./subscriptionUtils";
import { Timestamp } from "firebase/firestore";
import type { UserData } from "@/hooks/useUserData";

/**
 * Kullanıcının abonelik süresinin dolup dolmadığını kontrol eder
 * Trial (7 gün), Lite (30 gün) veya Premium (30 gün) süresi dolmuşsa true döner
 */
export function isSubscriptionExpired(userData: UserData | null | undefined): boolean {
  if (!userData) return false;

  const subscriptionStatus: SubscriptionStatus = checkSubscriptionStatus(
    userData?.trialEndDate || null,
    userData?.subscriptionEndDate || null,
    userData?.premium,
    userData?.createdAt,
    userData?.subscriptionPlan
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
  
  const subscriptionStatus: SubscriptionStatus = checkSubscriptionStatus(
    userData?.trialEndDate || null,
    userData?.subscriptionEndDate || null,
    userData?.premium,
    userData?.createdAt,
    userData?.subscriptionPlan
  );
  
  // Plan'ı subscription status'e göre belirle
  let currentPlan: SubscriptionPlan = userData?.subscriptionPlan || "trial";
  if (subscriptionStatus === "trial") {
    currentPlan = "trial";
  } else if (subscriptionStatus === "active" && userData?.subscriptionPlan) {
    currentPlan = userData.subscriptionPlan;
  } else if (subscriptionStatus === "freemium") {
    currentPlan = "freemium";
  }
  
  // FREEMIUM MOD: Freemium kullanıcılar yönlendirilmez (günde 1 soru sorabilirler)
  if (currentPlan === "freemium" || (subscriptionStatus as SubscriptionStatus) === "freemium") {
    return false; // Freemium modunda kalabilir
  }
  
  // Trial expired olanları yönlendirme (freemium'a geçecek)
  if (currentPlan === "trial" && (subscriptionStatus as SubscriptionStatus) === "freemium") {
    return false;
  }
  
  // Lite/Premium expired olanları yönlendir (planı yenilemeli)
  return subscriptionStatus === "expired" && (currentPlan === "lite" || currentPlan === "premium");
}

