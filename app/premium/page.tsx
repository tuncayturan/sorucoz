"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { checkSubscriptionStatus, getTrialDaysLeft, getSubscriptionDaysLeft, getPlanPrice, isFreemiumMode, type SubscriptionPlan } from "@/lib/subscriptionUtils";
import { doc, updateDoc, Timestamp, collection, query, where, getDocs, increment, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import Toast from "@/components/ui/Toast";
import StudentFooter from "@/components/StudentFooter";

export default function PremiumPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { userData, loading, refresh: refreshUserData } = useUserData();
  const { settings } = useSiteSettings();
  const [processing, setProcessing] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [validatedReferralCode, setValidatedReferralCode] = useState<{
    code: string;
    discountPercent: number;
    id: string;
  } | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"manual" | "iyzico" | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/landing");
    }
  }, [user, loading, router]);

  if (loading || !user || !userData) {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const subscriptionStatus = checkSubscriptionStatus(
    userData.trialEndDate || null,
    userData.subscriptionEndDate || null,
    userData.premium,
    userData.createdAt,
    userData.subscriptionPlan
  );
  const trialDaysLeft = getTrialDaysLeft(userData.trialEndDate || null, userData.createdAt);
  const subscriptionDaysLeft = getSubscriptionDaysLeft(userData.subscriptionEndDate || null);
  const currentPlan = userData.subscriptionPlan || "trial";
  const isFreemium = isFreemiumMode(currentPlan, subscriptionStatus);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const validateReferralCode = async (code: string) => {
    if (!code.trim()) {
      setValidatedReferralCode(null);
      return;
    }

    try {
      setValidatingCode(true);
      const codesRef = collection(db, "referralCodes");
      const q = query(codesRef, where("code", "==", code.trim().toUpperCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        showToast("Geçersiz referans kodu.", "error");
        setValidatedReferralCode(null);
        return;
      }

      const codeData = snapshot.docs[0].data();
      const codeId = snapshot.docs[0].id;

      // Kod aktif mi?
      if (!codeData.isActive) {
        showToast("Bu referans kodu aktif değil.", "error");
        setValidatedReferralCode(null);
        return;
      }

      // Maksimum kullanım limiti kontrolü
      if (codeData.maxUsage && codeData.usageCount >= codeData.maxUsage) {
        showToast("Bu referans kodu kullanım limitine ulaşmış.", "error");
        setValidatedReferralCode(null);
        return;
      }

      setValidatedReferralCode({
        code: codeData.code,
        discountPercent: codeData.discountPercent,
        id: codeId,
      });
      showToast(`%${codeData.discountPercent} indirim kodu uygulandı!`, "success");
    } catch (error) {
      console.error("Referans kodu doğrulanırken hata:", error);
      showToast("Kod doğrulanırken bir hata oluştu.", "error");
      setValidatedReferralCode(null);
    } finally {
      setValidatingCode(false);
    }
  };

  const handlePurchase = async (plan: SubscriptionPlan, isYearly: boolean = false) => {
    if (!user) return;

    // Trial plan'ı satın alınamaz
    if (plan === "trial") {
      showToast("Trial planı zaten aktif!", "info");
      return;
    }
    
    const subscriptionDays = isYearly ? 365 : 30;

    // Premium'dan Lite'a geçiş kontrolü
    if (currentPlan === "premium" && plan === "lite" && subscriptionStatus === "active") {
      const daysLeft = subscriptionDaysLeft;
      if (daysLeft > 0) {
        showToast(
          `Premium plan'dan Lite plan'a geçiş için mevcut aboneliğinizin bitmesini beklemeniz gerekiyor. Kalan süre: ${daysLeft} gün`,
          "info"
        );
        return;
      }
    }

    // Ödeme yöntemini kontrol et
    try {
      const settingsRef = doc(db, "adminSettings", "paymentMethods");
      const settingsSnap = await getDoc(settingsRef);
      const paymentMethods = settingsSnap.exists() ? settingsSnap.data().methods : [];
      const iyzicoSettings = paymentMethods.find((m: any) => m.id === "iyzico");

      // iyzico aktifse ödeme başlat
      if (iyzicoSettings && iyzicoSettings.enabled && iyzicoSettings.apiKey && iyzicoSettings.secretKey) {
        await initializeIyzicoPayment(plan, isYearly);
        return;
      }
    } catch (error) {
      console.error("Ödeme yöntemi kontrolü hatası:", error);
    }

    // Manuel ödeme (fallback)
    await handleManualPayment(plan, isYearly);
  };

  const initializeIyzicoPayment = async (plan: SubscriptionPlan, isYearly: boolean) => {
    try {
      setProcessing(plan);

      // Fiyat hesaplama (admin'den gelen fiyatlar veya varsayılan)
      const litePriceMonthly = settings.litePlanPrice || 99;
      const premiumPriceMonthly = settings.premiumPlanPrice || 399;
      const yearlyDiscountPercent = settings.yearlyDiscountPercent || 15;
      const discountMultiplier = 1 - (yearlyDiscountPercent / 100);
      const litePriceYearly = Math.round(litePriceMonthly * 12 * discountMultiplier);
      const premiumPriceYearly = Math.round(premiumPriceMonthly * 12 * discountMultiplier);

      const basePrice = isYearly
        ? (plan === "premium" ? premiumPriceYearly : litePriceYearly)
        : (plan === "premium" ? premiumPriceMonthly : litePriceMonthly);

      let finalPrice = basePrice;
      if (validatedReferralCode) {
        const discountAmount = Math.round((basePrice * validatedReferralCode.discountPercent) / 100);
        finalPrice = basePrice - discountAmount;
      }

      // iyzico ödeme başlat
      const response = await fetch("/api/payment/iyzico/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.uid,
          plan,
          billingPeriod: isYearly ? "yearly" : "monthly",
          referralCode: validatedReferralCode?.code || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Ödeme başlatılamadı");
      }

      // iyzico ödeme formunu göster
      if (data.htmlContent) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "https://sandbox-api.iyzipay.com/payment/3dsecure/initialize";
        form.innerHTML = data.htmlContent;
        document.body.appendChild(form);
        form.submit();
      } else {
        throw new Error("Ödeme formu alınamadı");
      }
    } catch (error: any) {
      console.error("iyzico ödeme hatası:", error);
      showToast(error.message || "Ödeme başlatılamadı. Manuel ödeme ile devam ediliyor...", "error");
      // Hata durumunda manuel ödemeye geç
      await handleManualPayment(plan, isYearly);
    } finally {
      setProcessing(null);
    }
  };

  const handleManualPayment = async (plan: SubscriptionPlan, isYearly: boolean) => {
    if (!user) return;

    const subscriptionDays = isYearly ? 365 : 30;

    try {
      setProcessing(plan);

      const now = new Date();
      const userRef = doc(db, "users", user.uid);

      // Referans kodunu kullanım sayısını artır (sadece manuel ödemede)
      if (validatedReferralCode) {
        try {
          const codeRef = doc(db, "referralCodes", validatedReferralCode.id);
          await updateDoc(codeRef, {
            usageCount: increment(1),
          });
        } catch (error) {
          console.error("Referans kodu kullanım sayısı güncellenirken hata:", error);
        }
      }

      // Lite'dan Premium'a geçiş
      if (currentPlan === "lite" && plan === "premium" && subscriptionStatus === "active") {
        const subscriptionEndDate = new Date(now);
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);

        await updateDoc(userRef, {
          premium: true,
          subscriptionPlan: "premium",
          subscriptionStatus: "active",
          subscriptionStartDate: Timestamp.fromDate(now),
          subscriptionEndDate: Timestamp.fromDate(subscriptionEndDate),
          dailyQuestionCount: 0,
          lastQuestionDate: now.toISOString().split("T")[0],
        });

        refreshUserData();
        showToast("Premium plan başarıyla aktif edildi! (Manuel ödeme)", "success");
      } else if (currentPlan === "premium" && plan === "lite") {
        showToast("Premium plan'dan Lite plan'a geçiş için aboneliğinizin bitmesini bekleyin.", "info");
      } else {
        // Yeni abonelik
        const subscriptionEndDate = new Date(now);
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + subscriptionDays);

        await updateDoc(userRef, {
          premium: plan === "premium",
          subscriptionPlan: plan,
          subscriptionStatus: "active",
          subscriptionStartDate: Timestamp.fromDate(now),
          subscriptionEndDate: Timestamp.fromDate(subscriptionEndDate),
          billingPeriod: isYearly ? "yearly" : "monthly",
          dailyQuestionCount: 0,
          lastQuestionDate: now.toISOString().split("T")[0],
        });

        refreshUserData();
        const periodText = isYearly ? "yıllık" : "aylık";
        showToast(`${plan === "lite" ? "Lite" : "Premium"} plan (${periodText}) başarıyla aktif edildi! (Manuel ödeme)`, "success");
      }

      setTimeout(() => {
        router.push("/home");
      }, 1500);
    } catch (error) {
      console.error("Purchase error:", error);
      showToast("Ödeme işlemi başarısız. Lütfen tekrar deneyin.", "error");
    } finally {
      setProcessing(null);
    }
  };

  // Admin'den fiyatları ve indirim oranını al veya varsayılan kullan
  const litePriceMonthly = settings.litePlanPrice || 99;
  const premiumPriceMonthly = settings.premiumPlanPrice || 399;
  const yearlyDiscountPercent = settings.yearlyDiscountPercent || 15;
  
  // Yıllık fiyatlar (12 ay - admin'den gelen indirim oranı)
  const discountMultiplier = 1 - (yearlyDiscountPercent / 100);
  const litePriceYearly = Math.round(litePriceMonthly * 12 * discountMultiplier);
  const premiumPriceYearly = Math.round(premiumPriceMonthly * 12 * discountMultiplier);

  const plans = [
    {
      id: "lite" as SubscriptionPlan,
      name: "Lite",
      priceMonthly: litePriceMonthly,
      priceYearly: litePriceYearly,
      icon: "📚",
      colorClass: "from-blue-500 to-indigo-600",
      bgColorClass: "from-blue-50 to-indigo-50",
      borderColorClass: "border-blue-200",
      features: [
        "Günde 10 soru",
        "AI çözüm desteği",
        "Koç desteği",
        "Temel istatistikler",
        "Email desteği",
      ],
    },
    {
      id: "premium" as SubscriptionPlan,
      name: "Premium",
      priceMonthly: premiumPriceMonthly,
      priceYearly: premiumPriceYearly,
      icon: "⭐",
      colorClass: "from-yellow-400 via-orange-500 to-red-500",
      bgColorClass: "from-yellow-50 to-orange-50",
      borderColorClass: "border-yellow-200",
      popular: true,
      features: [
        "Sınırsız soru sorma",
        "Gelişmiş AI çözüm",
        "Özel koç desteği",
        "Detaylı istatistikler",
        "Öncelikli destek",
        "Gelişmiş analizler",
      ],
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <div className="flex justify-center items-start px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="w-full max-w-6xl">
          
          {/* Header */}
          <div className="text-center mb-8 animate-slideFade">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-4xl">⭐</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Abonelik Planları</h1>
            <p className="text-gray-600">İhtiyacına uygun planı seç, soru çözmeye başla</p>
          </div>

          {/* Trial Status */}
          {subscriptionStatus === "trial" && !isFreemium && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-6 mb-6 border border-blue-200 animate-slideFade">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">🆓 Ücretsiz Deneme</h3>
                  <p className="text-gray-600 text-sm">
                    {trialDaysLeft > 0 ? (
                      <>
                        Kalan süre: <span className="font-bold text-blue-600">{trialDaysLeft} gün</span> • 
                        Günde 3 soru + AI çözüm
                      </>
                    ) : (
                      "Trial süresi doldu"
                    )}
                  </p>
                </div>
                <div className="text-3xl">🆓</div>
              </div>
            </div>
          )}

          {/* Freemium Status */}
          {isFreemium && (
            <div className="bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 rounded-3xl p-6 mb-6 border border-gray-600 animate-slideFade">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">🆓 Freemium Mod</h3>
                  <p className="text-gray-300 text-sm mb-3">
                    Trial süreniz doldu. Şu an kısıtlı moddasınız:
                  </p>
                  <ul className="text-gray-400 text-xs space-y-1">
                    <li>✅ Günde 1 soru sorabilirsiniz</li>
                    <li>❌ AI çözüm yok (sadece coach desteği)</li>
                    <li>✅ Eski sorularınızı görebilirsiniz</li>
                  </ul>
                  <p className="text-yellow-300 text-sm mt-3 font-bold">
                    💎 Premium'a geçin → Sınırsız soru + AI çözüm!
                  </p>
                </div>
                <div className="text-4xl">🆓</div>
              </div>
            </div>
          )}

          {/* Current Plan Info */}
          {subscriptionStatus === "active" && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-6 mb-6 border border-green-200 animate-slideFade">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {currentPlan === "lite" ? "📚 Lite Plan" : "⭐ Premium Plan"} Aktif
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {subscriptionDaysLeft > 0 ? (
                      <>Kalan süre: <span className="font-bold text-green-600">{subscriptionDaysLeft} gün</span></>
                    ) : (
                      "Abonelik süresi doldu"
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Referral Code Input */}
          <div className="mb-6 animate-slideFade">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                  🎟️
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Referans Kodu</h3>
                  <p className="text-sm text-gray-600">İndirim kodu varsa girin</p>
                </div>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => {
                    setReferralCode(e.target.value.toUpperCase());
                    if (validatedReferralCode) {
                      setValidatedReferralCode(null);
                    }
                  }}
                  onBlur={() => {
                    if (referralCode.trim()) {
                      validateReferralCode(referralCode);
                    }
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-500/20 transition-all font-mono text-lg font-bold"
                  placeholder="KOD GİRİN (örn: TOPLULUK10)"
                  disabled={validatingCode}
                />
                {validatedReferralCode && (
                  <button
                    onClick={() => {
                      setReferralCode("");
                      setValidatedReferralCode(null);
                    }}
                    className="px-4 py-3 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 transition-all"
                  >
                    Kaldır
                  </button>
                )}
              </div>
              {validatingCode && (
                <p className="text-sm text-gray-500 mt-2">Kod doğrulanıyor...</p>
              )}
              {validatedReferralCode && (
                <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-sm font-bold text-green-700">
                    ✓ %{validatedReferralCode.discountPercent} indirim uygulandı!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Billing Period Toggle */}
          <div className="flex justify-center mb-6 animate-slideFade">
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-2 shadow-lg border border-white/60 inline-flex gap-2">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-6 py-3 rounded-xl font-bold transition-all ${
                  billingPeriod === "monthly"
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Aylık
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`px-6 py-3 rounded-xl font-bold transition-all relative ${
                  billingPeriod === "yearly"
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Yıllık
                <span className="ml-2 text-xs bg-yellow-400 text-gray-900 px-2 py-0.5 rounded-full font-bold">
                  %{yearlyDiscountPercent} İndirim
                </span>
              </button>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlan === plan.id && subscriptionStatus === "active";
              const isProcessing = processing === plan.id;
              
              // Premium'dan Lite'a geçiş engellendi mi?
              const isDowngradeBlocked = currentPlan === "premium" && plan.id === "lite" && subscriptionStatus === "active" && subscriptionDaysLeft > 0;
              
              // Fiyatları belirle (referans kodu indirimi ile)
              let basePrice = billingPeriod === "yearly" ? plan.priceYearly : plan.priceMonthly;
              let finalPrice = basePrice;
              let discountAmount = 0;

              if (validatedReferralCode) {
                discountAmount = Math.round((basePrice * validatedReferralCode.discountPercent) / 100);
                finalPrice = basePrice - discountAmount;
              }

              const displayPrice = finalPrice;
              const monthlyEquivalent = billingPeriod === "yearly" ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
              const savingsAmount = billingPeriod === "yearly" ? (plan.priceMonthly * 12 - plan.priceYearly) : 0;

              return (
                <div
                  key={plan.id}
                  className={`bg-gradient-to-br from-white via-white ${
                    plan.id === "lite" ? "to-blue-50/30" : "to-yellow-50/30"
                  } backdrop-blur-xl rounded-3xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 relative overflow-hidden animate-slideFade ${
                    plan.popular ? "ring-2 ring-yellow-400" : ""
                  }`}
                >
                  {/* Decorative gradient */}
                  <div
                    className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${
                      plan.id === "lite"
                        ? "from-blue-400/20 to-indigo-400/20"
                        : "from-yellow-400/20 via-orange-400/20 to-red-400/20"
                    } rounded-full blur-3xl`}
                  ></div>
                  
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute top-6 right-6 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      Popüler
                    </div>
                  )}

                  <div className="relative z-10">
                    {/* Plan Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`w-12 h-12 bg-gradient-to-br ${
                          plan.id === "lite"
                            ? "from-blue-500 to-indigo-600"
                            : "from-yellow-400 via-orange-500 to-red-500"
                        } rounded-2xl flex items-center justify-center text-2xl shadow-lg`}
                      >
                        {plan.icon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
                        <p className="text-sm text-gray-500">
                          {billingPeriod === "yearly" ? "Yıllık abonelik" : "Aylık abonelik"}
                        </p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      {validatedReferralCode && discountAmount > 0 && (
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm text-gray-500 line-through">{basePrice}₺</span>
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                            %{validatedReferralCode.discountPercent} İndirim
                          </span>
                        </div>
                      )}
                      {billingPeriod === "yearly" ? (
                        <>
                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-4xl font-bold text-gray-900">{displayPrice}₺</span>
                            <span className="text-gray-500">/yıl</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-600">
                              ({monthlyEquivalent}₺/ay)
                            </span>
                            {savingsAmount > 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                                {savingsAmount}₺ tasarruf
                              </span>
                            )}
                            {validatedReferralCode && discountAmount > 0 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">
                                {discountAmount}₺ ek indirim
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-gray-900">{displayPrice}₺</span>
                          <span className="text-gray-500">/ay</span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-3 mb-8">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-5 h-5 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-700">{feature}</p>
                        </div>
                      ))}
                    </div>

                    {/* Purchase Button */}
                    <button
                      onClick={() => handlePurchase(plan.id, billingPeriod === "yearly")}
                      disabled={isProcessing || isCurrentPlan || isDowngradeBlocked}
                      className={`w-full py-4 rounded-2xl text-white font-bold text-lg
                               bg-gradient-to-r ${
                                 plan.id === "lite"
                                   ? "from-blue-500 to-indigo-600"
                                   : "from-yellow-400 via-orange-500 to-red-500"
                               }
                               shadow-[0_20px_50px_rgba(0,0,0,0.2)]
                               active:scale-[0.98] transition-all duration-300
                               hover:shadow-[0_25px_60px_rgba(0,0,0,0.3)]
                               hover:scale-[1.02]
                               disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                    >
                      {isProcessing
                        ? "İşleniyor..."
                        : isCurrentPlan
                        ? "Aktif Plan"
                        : isDowngradeBlocked
                        ? `Mevcut abonelik bitene kadar bekleyin (${subscriptionDaysLeft} gün)`
                        : billingPeriod === "yearly"
                        ? `${plan.name} Plan'a Geç - ${displayPrice}₺/yıl`
                        : `${plan.name} Plan'a Geç - ${displayPrice}₺/ay`}
                    </button>
                    
                    {/* Downgrade Warning */}
                    {isDowngradeBlocked && (
                      <p className="mt-2 text-xs text-gray-500 text-center">
                        Premium plan'dan Lite plan'a geçiş için mevcut aboneliğinizin bitmesini beklemeniz gerekiyor.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trial Plan Info */}
          <div className="bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-xl rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 relative overflow-hidden animate-slideFade mb-6">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                  🆓
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Trial</h2>
                  <p className="text-sm text-gray-500">7 günlük ücretsiz deneme</p>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-900">Ücretsiz</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-700">Günde 3 soru</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-700">Tüm özelliklere erişim</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-700">Otomatik olarak başlar</p>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="text-center text-sm text-gray-500">
            <p>Güvenli ödeme • İstediğin zaman iptal et • Aylık veya Yıllık ödeme seçenekleri</p>
          </div>
        </div>
      </div>

      {/* Toast Message */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
      
      <StudentFooter />
    </div>
  );
}
