import { Timestamp } from "firebase/firestore";

export type SubscriptionStatus = "trial" | "active" | "expired";
export type SubscriptionPlan = "trial" | "lite" | "premium";

export interface SubscriptionData {
  trialStartDate: Timestamp | null;
  trialEndDate: Timestamp | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStartDate: Timestamp | null;
  subscriptionEndDate: Timestamp | null;
  premium: boolean;
  dailyQuestionCount?: number; // Günlük soru sayısı
  lastQuestionDate?: string; // Son soru sorulma tarihi (YYYY-MM-DD formatında)
}

/**
 * Yeni kullanıcı için 7 günlük trial başlatır
 */
export function createTrialData(): Omit<SubscriptionData, "premium"> {
  const now = new Date();
  const trialEndDate = new Date(now);
  trialEndDate.setDate(trialEndDate.getDate() + 7); // 7 gün sonra

  return {
    trialStartDate: Timestamp.fromDate(now),
    trialEndDate: Timestamp.fromDate(trialEndDate),
    subscriptionStatus: "trial" as SubscriptionStatus,
    subscriptionPlan: "trial" as SubscriptionPlan,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    dailyQuestionCount: 0,
    lastQuestionDate: now.toISOString().split("T")[0], // YYYY-MM-DD
  };
}

/**
 * Kullanıcının subscription durumunu kontrol eder
 */
export function checkSubscriptionStatus(
  trialEndDate: Timestamp | null,
  subscriptionEndDate: Timestamp | null,
  premium: boolean,
  createdAt?: any
): SubscriptionStatus {
  const now = new Date();
  const subEnd = subscriptionEndDate ? subscriptionEndDate.toDate() : null;

  // Subscription aktif ve bitmemişse (Lite veya Premium)
  if (subEnd && now <= subEnd) {
    return "active";
  }

  // Eğer trialEndDate varsa, onu kullan
  if (trialEndDate) {
    const trialEnd = trialEndDate.toDate();
    
    // Trial süresi dolmuş mu?
    if (now > trialEnd) {
      return "expired";
    }

    // Trial aktif
    return "trial";
  }

  // trialEndDate yoksa, kayıt tarihinden itibaren 7 gün hesapla
  if (createdAt) {
    let registrationDate: Date;
    
    // createdAt Timestamp veya Date olabilir
    if (createdAt.toDate) {
      registrationDate = createdAt.toDate();
    } else if (createdAt instanceof Date) {
      registrationDate = createdAt;
    } else if (createdAt.seconds) {
      // Firestore Timestamp formatı
      registrationDate = new Date(createdAt.seconds * 1000);
    } else {
      // Fallback: şu anki tarih
      registrationDate = new Date();
    }

    const trialEndDate = new Date(registrationDate);
    trialEndDate.setDate(trialEndDate.getDate() + 7); // Kayıt tarihinden 7 gün sonra

    // 7 gün dolmuş mu?
    if (now > trialEndDate) {
      return "expired";
    }

    // Hala 7 gün içindeyse trial
    return "trial";
  }

  // Hiçbir bilgi yoksa expired döndür (eski davranış)
  return "expired";
}

/**
 * Trial'ın kaç gün kaldığını hesaplar
 */
export function getTrialDaysLeft(trialEndDate: Timestamp | null, createdAt?: any): number {
  const now = new Date();
  
  // Eğer trialEndDate varsa, onu kullan
  if (trialEndDate) {
    const end = trialEndDate.toDate();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  // trialEndDate yoksa, kayıt tarihinden itibaren 7 gün hesapla
  if (createdAt) {
    let registrationDate: Date;
    
    // createdAt Timestamp veya Date olabilir
    if (createdAt.toDate) {
      registrationDate = createdAt.toDate();
    } else if (createdAt instanceof Date) {
      registrationDate = createdAt;
    } else if (createdAt.seconds) {
      // Firestore Timestamp formatı
      registrationDate = new Date(createdAt.seconds * 1000);
    } else {
      return 0;
    }

    const trialEndDate = new Date(registrationDate);
    trialEndDate.setDate(trialEndDate.getDate() + 7); // Kayıt tarihinden 7 gün sonra

    const diffTime = trialEndDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  return 0;
}

/**
 * Subscription'ın kaç gün kaldığını hesaplar
 */
export function getSubscriptionDaysLeft(subscriptionEndDate: Timestamp | null): number {
  if (!subscriptionEndDate) return 0;

  const now = new Date();
  const end = subscriptionEndDate.toDate();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Plan'a göre günlük soru limitini döndürür
 */
export function getDailyQuestionLimit(plan: SubscriptionPlan): number {
  switch (plan) {
    case "trial":
      return 3; // Trial'da günde 3 soru
    case "lite":
      return 10; // Lite'da günde 10 soru
    case "premium":
      return Infinity; // Premium'da sınırsız
    default:
      return 0;
  }
}

/**
 * Kullanıcının bugün soru sorup soramayacağını kontrol eder
 */
export function canAskQuestion(
  plan: SubscriptionPlan,
  dailyQuestionCount: number = 0,
  lastQuestionDate?: string
): { canAsk: boolean; remaining: number } {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Eğer bugün soru sorulmamışsa, sayacı sıfırla
  if (lastQuestionDate !== today) {
    return { canAsk: true, remaining: getDailyQuestionLimit(plan) };
  }

  const limit = getDailyQuestionLimit(plan);
  
  if (limit === Infinity) {
    return { canAsk: true, remaining: Infinity };
  }

  const remaining = limit - dailyQuestionCount;
  return { canAsk: remaining > 0, remaining: Math.max(0, remaining) };
}

/**
 * Plan fiyatlarını döndürür
 */
export function getPlanPrice(plan: SubscriptionPlan): number {
  switch (plan) {
    case "trial":
      return 0;
    case "lite":
      return 99;
    case "premium":
      return 399;
    default:
      return 0;
  }
}

