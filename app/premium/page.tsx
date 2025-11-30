"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { checkSubscriptionStatus, getTrialDaysLeft, getSubscriptionDaysLeft, getPlanPrice, type SubscriptionPlan } from "@/lib/subscriptionUtils";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import HomeHeader from "@/components/HomeHeader";
import Toast from "@/components/ui/Toast";
import StudentFooter from "@/components/StudentFooter";

export default function PremiumPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { userData, loading, refresh: refreshUserData } = useUserData();
  const [processing, setProcessing] = useState<string | null>(null);
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
    userData.createdAt
  );
  const trialDaysLeft = getTrialDaysLeft(userData.trialEndDate || null, userData.createdAt);
  const subscriptionDaysLeft = getSubscriptionDaysLeft(userData.subscriptionEndDate || null);
  const currentPlan = userData.subscriptionPlan || "trial";

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const handlePurchase = async (plan: SubscriptionPlan) => {
    if (!user) return;

    // Trial plan'ı satın alınamaz
    if (plan === "trial") {
      showToast("Trial planı zaten aktif!", "info");
      return;
    }

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

    try {
      setProcessing(plan);

      // TODO: Burada ödeme entegrasyonu yapılacak (Stripe, iyzico, vb.)
      // Şimdilik manuel olarak plan'ı aktif ediyoruz
      
      const now = new Date();
      const userRef = doc(db, "users", user.uid);
      
      // Lite'dan Premium'a geçiş: Hemen geçiş, yeni 30 günlük abonelik
      if (currentPlan === "lite" && plan === "premium" && subscriptionStatus === "active") {
        const subscriptionEndDate = new Date(now);
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // 1 ay sonra

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
        showToast("Premium plan başarıyla aktif edildi! (Test modu)", "success");
      } 
      // Premium'dan Lite'a geçiş: Mevcut abonelik bitene kadar bekle (yukarıda kontrol edildi)
      // Bu durumda buraya gelmemeli, ama yine de kontrol edelim
      else if (currentPlan === "premium" && plan === "lite") {
        // Bu durum zaten yukarıda kontrol edildi ve engellendi
        showToast("Premium plan'dan Lite plan'a geçiş için aboneliğinizin bitmesini bekleyin.", "info");
      }
      // Yeni abonelik (Trial'dan veya expired'dan)
      else {
        const subscriptionEndDate = new Date(now);
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // 1 ay sonra

        await updateDoc(userRef, {
          premium: plan === "premium",
          subscriptionPlan: plan,
          subscriptionStatus: "active",
          subscriptionStartDate: Timestamp.fromDate(now),
          subscriptionEndDate: Timestamp.fromDate(subscriptionEndDate),
          dailyQuestionCount: 0,
          lastQuestionDate: now.toISOString().split("T")[0],
        });

        refreshUserData();
        showToast(`${plan === "lite" ? "Lite" : "Premium"} plan başarıyla aktif edildi! (Test modu)`, "success");
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

  const plans = [
    {
      id: "lite" as SubscriptionPlan,
      name: "Lite",
      price: 99,
      period: "ay",
      icon: "📚",
      colorClass: "from-blue-500 to-indigo-600",
      bgColorClass: "from-blue-50 to-indigo-50",
      borderColorClass: "border-blue-200",
      features: [
        "Günde 10 soru sorma hakkı",
        "Koç desteği",
        "Temel istatistikler",
        "Email desteği",
      ],
    },
    {
      id: "premium" as SubscriptionPlan,
      name: "Premium",
      price: 399,
      period: "ay",
      icon: "⭐",
      colorClass: "from-yellow-400 via-orange-500 to-red-500",
      bgColorClass: "from-yellow-50 to-orange-50",
      borderColorClass: "border-yellow-200",
      popular: true,
      features: [
        "Sınırsız soru sorma",
        "Özel koç desteği",
        "Detaylı istatistikler",
        "Öncelikli destek",
        "Gelişmiş analizler",
      ],
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <HomeHeader />
      
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
          {subscriptionStatus === "trial" && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-6 mb-6 border border-blue-200 animate-slideFade">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">🆓 Ücretsiz Deneme</h3>
                  <p className="text-gray-600 text-sm">
                    {trialDaysLeft > 0 ? (
                      <>Kalan süre: <span className="font-bold text-blue-600">{trialDaysLeft} gün</span></>
                    ) : (
                      "Trial süresi doldu"
                    )}
                  </p>
                </div>
                <div className="text-3xl">🆓</div>
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

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlan === plan.id && subscriptionStatus === "active";
              const isProcessing = processing === plan.id;
              
              // Premium'dan Lite'a geçiş engellendi mi?
              const isDowngradeBlocked = currentPlan === "premium" && plan.id === "lite" && subscriptionStatus === "active" && subscriptionDaysLeft > 0;

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
                        <p className="text-sm text-gray-500">Aylık abonelik</p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900">{plan.price}₺</span>
                        <span className="text-gray-500">/{plan.period}</span>
                      </div>
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
                      onClick={() => handlePurchase(plan.id)}
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
                        : `${plan.name} Plan'a Geç - ${plan.price}₺/ay`}
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
                  <h2 className="text-2xl font-bold text-gray-900">Trial Plan</h2>
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
                  <p className="text-sm text-gray-700">7 gün boyunca sınırsız soru sorma</p>
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
            <p>Güvenli ödeme • İstediğin zaman iptal et • Tüm planlar aylık</p>
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
