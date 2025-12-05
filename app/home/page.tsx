"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import HomeHeader from "@/components/HomeHeader";
import SideMenu from "@/components/SideMenu";
import PopupMessage from "@/components/PopupMessage";
import StudentFooter from "@/components/StudentFooter";
import { checkSubscriptionStatus, getTrialDaysLeft, getSubscriptionDaysLeft, canAskQuestion, getDailyQuestionLimit, isFreemiumMode, hasAIAccess, type SubscriptionPlan } from "@/lib/subscriptionUtils";
import { shouldRedirectToPremium } from "@/lib/subscriptionGuard";
import { collection, query, where, orderBy, getDocs, onSnapshot, Timestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { requestNotificationPermission, saveFCMTokenToUser } from "@/lib/fcmUtils";
import { sendEmailVerification } from "firebase/auth";
import Toast from "@/components/ui/Toast";

const SUBJECT_COLORS: { [key: string]: string } = {
  "Matematik": "from-blue-500 to-indigo-600",
  "Fizik": "from-purple-500 to-pink-600",
  "Kimya": "from-green-500 to-emerald-600",
  "Biyoloji": "from-red-500 to-rose-600",
  "Türkçe": "from-yellow-500 to-orange-600",
  "Tarih": "from-amber-500 to-yellow-600",
  "Coğrafya": "from-teal-500 to-cyan-600",
  "Felsefe": "from-indigo-500 to-purple-600",
  "Vatandaşlık": "from-blue-500 to-cyan-600",
  "Güncel": "from-gray-500 to-slate-600",
  "Fen Bilgisi": "from-emerald-500 to-teal-600",
  "Sosyal Bilgiler": "from-orange-500 to-amber-600",
  "Bilinmeyen": "from-gray-500 to-gray-600",
};

const SUBJECT_ICONS: { [key: string]: string } = {
  "Matematik": "🔢",
  "Fizik": "⚛️",
  "Kimya": "🧪",
  "Biyoloji": "🔬",
  "Türkçe": "📝",
  "Tarih": "📜",
  "Coğrafya": "🌍",
  "Felsefe": "💭",
  "Vatandaşlık": "📋",
  "Güncel": "📰",
  "Fen Bilgisi": "🔬",
  "Sosyal Bilgiler": "🌐",
  "Bilinmeyen": "❓",
};

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading, refresh: refreshUserData } = useUserData();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [todayQuestionsCount, setTodayQuestionsCount] = useState(0);
  const [recentQuestions, setRecentQuestions] = useState<any[]>([]);
  const [totalQuestionsCount, setTotalQuestionsCount] = useState(0);
  const [workDuration, setWorkDuration] = useState<string>("");
  const [solvedQuestionsCount, setSolvedQuestionsCount] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [showEmailVerificationBanner, setShowEmailVerificationBanner] = useState(false);
  const [sendingVerificationEmail, setSendingVerificationEmail] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({
    message: "",
    type: "info",
    isVisible: false,
  });
  
  const displayName = userData?.name || user?.displayName || "Öğrenci";
  const isPremium = userData?.premium || false;

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  // Bitiş tarihini formatlama
  const formatEndDate = (endDate: any) => {
    if (!endDate) return "";
    const date = endDate.toDate ? endDate.toDate() : new Date(endDate.seconds * 1000);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  
  const subscriptionStatus = userData
    ? checkSubscriptionStatus(
        userData.trialEndDate || null,
        userData.subscriptionEndDate || null,
        userData.premium,
        userData.createdAt,
        userData.subscriptionPlan
      )
    : null;
  const trialDaysLeft = userData ? getTrialDaysLeft(userData.trialEndDate || null, userData.createdAt) : 0;
  const subscriptionDaysLeft = userData ? getSubscriptionDaysLeft(userData.subscriptionEndDate || null) : 0;
  
  // Plan'ı subscription status'e göre belirle
  let currentPlan: SubscriptionPlan = userData?.subscriptionPlan || "trial";
  if (subscriptionStatus === "trial") {
    currentPlan = "trial";
  } else if (subscriptionStatus === "active" && userData?.subscriptionPlan) {
    currentPlan = userData.subscriptionPlan;
  } else if (subscriptionStatus === "freemium") {
    currentPlan = "freemium";
  }
  
  // FREEMIUM kontrolü
  const isExpired = subscriptionStatus === "expired";
  const isFreemium = isFreemiumMode(currentPlan, subscriptionStatus || "trial");
  const canUseAI = hasAIAccess(currentPlan, isExpired);
  
  // Günlük soru bilgisi
  const questionInfo = userData
    ? canAskQuestion(
        currentPlan,
        userData.dailyQuestionCount || 0,
        userData.lastQuestionDate
      )
    : { canAsk: true, remaining: Infinity };
  const dailyLimit = getDailyQuestionLimit(currentPlan, isExpired);

  // Çevrimiçi durumunu güncelle
  useOnlineStatus();

  // Kullanıcı giriş yapmamışsa landing sayfasına yönlendir
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/landing");
    }
  }, [user, authLoading, router]);

  // Email doğrulama kontrolü - sadece email ile kayıt olanlar için
  useEffect(() => {
    if (!user || !userData) return;
    
    // Google ile giriş yapanlar için banner gösterme
    const isGoogleUser = user.providerData?.some((p: any) => p.providerId === 'google.com');
    if (isGoogleUser) {
      setShowEmailVerificationBanner(false);
      return;
    }

    // Admin tarafından eklenmiş veya emailVerified:true olanlar için banner gösterme
    if (userData.emailVerified === true) {
      setShowEmailVerificationBanner(false);
      return;
    }

    // Email ile kayıt olmuş ve doğrulanmamış kullanıcılar için banner göster
    if (userData.emailVerified === false) {
      setShowEmailVerificationBanner(true);
    }
  }, [user, userData]);

  // Role kontrolü - sadece student buraya erişebilir
  useEffect(() => {
    if (userData && userData.role !== "student") {
      if (userData.role === "admin") {
        router.replace("/admin");
      } else if (userData.role === "coach") {
        router.replace("/coach");
      }
    }
  }, [userData, router]);

  // Abonelik süresi dolmuşsa premium sayfasına yönlendir
  useEffect(() => {
    if (!authLoading && !userDataLoading && user && userData && userData.role === "student") {
      if (shouldRedirectToPremium(userData)) {
        router.replace("/premium");
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  // Giriş yapan öğrenci için bildirim izni yoksa iste
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user || !userData || userData.role !== "student") return;

    // Kullanıcı bildirimleri tamamen kapattıysa zorlamayalım
    if (userData.notificationsEnabled === false) return;

    if (!("Notification" in window)) return;

    // Zaten izin verdiyse tekrar sorma
    if (Notification.permission === "granted") return;

    // Kullanıcı daha önce 'block' ettiyse, tarayıcı ayarlarından açması gerekir
    if (Notification.permission === "denied") return;

    // 'default' durumunda, nazikçe izin iste
    requestNotificationPermission()
      .then((token) => {
        if (token) {
          return saveFCMTokenToUser(user.uid, token);
        }
      })
      .catch((err) => {
        console.error("[Home] Bildirim izni alınırken hata:", err);
      });
  }, [user, userData]);

  // Scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop;
      setShowScrollTop(scrollPosition > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Sayfa odağa geldiğinde veriyi yenile (plan değişikliklerini yakalamak için)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        refreshUserData();
        fetchTodayQuestions();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, refreshUserData]);

  // Bugünkü soru sayısını çek
  useEffect(() => {
    if (user) {
      fetchTodayQuestions();
    }
  }, [user]);

  // Yaklaşan etkinlikleri çek
  useEffect(() => {
    if (!user || userData?.role !== "student") return;

    const unsubscribeFunctions: (() => void)[] = [];
    const coachesMap = new Map<string, { name: string; photoURL?: string | null; title?: string | null }>();
    const allEventsMap = new Map<string, any>(); // eventId -> event

    const setupEventListeners = async () => {
      try {
        // Tüm coach'ları bul
        const usersRef = collection(db, "users");
        const coachesQuery = query(usersRef, where("role", "==", "coach"));
        const coachesSnapshot = await getDocs(coachesQuery);

        // Coach isimlerini, profil resimlerini ve ünvanlarını kaydet
        coachesSnapshot.docs.forEach((coachDoc) => {
          const coachData = coachDoc.data();
          coachesMap.set(coachDoc.id, {
            name: coachData.name || "Coach",
            photoURL: coachData.photoURL || null,
            title: coachData.title || null, // Coach ünvanı
          });
        });

        // Tüm etkinlikleri birleştirip en yakın olanı bul
        const updateUpcomingEvent = () => {
          const now = new Date();
          const upcomingEventsList: any[] = [];

          allEventsMap.forEach((event) => {
            const eventDate = event.date?.toDate?.() || new Date(event.date?.seconds * 1000);
            if (eventDate >= now) {
              upcomingEventsList.push(event);
            }
          });

          // Tarihe göre sırala ve en yakın tarihli etkinliği al
          upcomingEventsList.sort((a, b) => {
            const aTime = a.date?.toDate?.()?.getTime() || 0;
            const bTime = b.date?.toDate?.()?.getTime() || 0;
            return aTime - bTime;
          });

          // En yakın tarihli etkinliği göster (sadece 1 tane)
          setUpcomingEvents(upcomingEventsList.slice(0, 1));
        };

        // Her coach'un etkinliklerini real-time dinle
        coachesSnapshot.docs.forEach((coachDoc) => {
          const coachId = coachDoc.id;
          const eventsRef = collection(db, "users", coachId, "events");
          const eventsQuery = query(eventsRef, orderBy("date", "asc"));

          const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
            // Bu coach'un eski etkinliklerini kaldır
            allEventsMap.forEach((event, eventId) => {
              if (event.coachId === coachId) {
                allEventsMap.delete(eventId);
              }
            });

            // Yeni etkinlikleri ekle
            snapshot.forEach((eventDoc) => {
              const eventData = eventDoc.data();
              const coachInfo = coachesMap.get(coachId) || { name: "Coach", photoURL: null, title: null };
              allEventsMap.set(eventDoc.id, {
                id: eventDoc.id,
                coachId,
                coachName: coachInfo.name,
                coachPhotoURL: coachInfo.photoURL,
                coachTitle: coachInfo.title, // Coach ünvanı
                ...eventData,
                date: eventData.date,
              });
            });

            // Tüm etkinliklerden en yakın olanı seç
            updateUpcomingEvent();
          });

          unsubscribeFunctions.push(unsubscribe);
        });
      } catch (error) {
        console.error("Etkinlikler yüklenirken hata:", error);
      }
    };

    setupEventListeners();

    return () => {
      unsubscribeFunctions.forEach((unsub) => unsub());
    };
  }, [user, userData]);

  const fetchTodayQuestions = async () => {
    if (!user) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = Timestamp.fromDate(today);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = Timestamp.fromDate(tomorrow);

      const questionsRef = collection(db, "users", user.uid, "sorular");
      
      // Bugünkü sorular
      const todayQ = query(
        questionsRef,
        where("createdAt", ">=", todayStart),
        where("createdAt", "<", tomorrowStart),
        orderBy("createdAt", "desc")
      );
      
      const todaySnapshot = await getDocs(todayQ);
      setTodayQuestionsCount(todaySnapshot.size);

      // Tüm sorular (toplam sayı için)
      const allQ = query(
        questionsRef,
        orderBy("createdAt", "desc")
      );
      
      const allSnapshot = await getDocs(allQ);
      setTotalQuestionsCount(allSnapshot.size);

      // Çözülen sorular (solved status)
      let solvedCount = 0;
      const recentData: any[] = [];
      allSnapshot.forEach((doc) => {
        const data = doc.data();
        recentData.push({
          id: doc.id,
          ...data,
        });
        if (data.status === "solved") {
          solvedCount++;
        }
      });
      setSolvedQuestionsCount(solvedCount);
      setRecentQuestions(recentData.slice(0, 5));
    } catch (error) {
      console.error("Bugünkü sorular yüklenirken hata:", error);
      // Hata durumunda userData'dan al
      const today = new Date().toISOString().split("T")[0];
      if (userData?.lastQuestionDate === today) {
        setTodayQuestionsCount(userData.dailyQuestionCount || 0);
      } else {
        setTodayQuestionsCount(0);
      }
    }
  };

  // Çalışma süresini hesapla
  useEffect(() => {
    if (userData?.createdAt) {
      const calculateWorkDuration = () => {
        const createdAt = userData.createdAt?.toDate?.() || new Date(userData.createdAt?.seconds * 1000);
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffDays > 0) {
          setWorkDuration(`${diffDays} gün`);
        } else if (diffHours > 0) {
          setWorkDuration(`${diffHours} saat`);
        } else {
          setWorkDuration(`${diffMinutes} dakika`);
        }
      };

      calculateWorkDuration();
      // Her dakika güncelle
      const interval = setInterval(calculateWorkDuration, 60000);
      return () => clearInterval(interval);
    }
  }, [userData?.createdAt]);

  // Email doğrulama gönder
  const handleSendVerificationEmail = async () => {
    if (!user) return;

    try {
      setSendingVerificationEmail(true);
      await sendEmailVerification(user);
      showToast("✅ Doğrulama emaili gönderildi! Lütfen email kutunuzu kontrol edin.", "success");
    } catch (error: any) {
      console.error("Email gönderme hatası:", error);
      if (error.code === "auth/too-many-requests") {
        showToast("⚠️ Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.", "error");
      } else {
        showToast("❌ Email gönderilemedi. Lütfen tekrar deneyin.", "error");
      }
    } finally {
      setSendingVerificationEmail(false);
    }
  };

  // Email doğrulandı olarak işaretle
  const handleDismissVerificationBanner = async () => {
    if (!user || !userData) return;

    try {
      // Firestore'da emailVerified'ı true yap
      await updateDoc(doc(db, "users", user.uid), {
        emailVerified: true,
      });
      setShowEmailVerificationBanner(false);
      showToast("✅ Email doğrulama banner'ı kapatıldı.", "success");
    } catch (error) {
      console.error("Banner kapatma hatası:", error);
    }
  };

  // Premium/Lite bitince otomatik Trial'a döndür, Trial bitince Freemium'a geçir
  useEffect(() => {
    if (!user || !userData) return;
    
    const plan = userData.subscriptionPlan || "trial";
    const status = subscriptionStatus;
    
    // 1. Lite veya Premium süresi dolmuşsa → 7 günlük yeni Trial ver
    if ((plan === "lite" || plan === "premium") && status === "expired") {
      console.log("[Home] Premium/Lite süresi doldu, Trial'a geri dönüyor...");
      
      const now = new Date();
      const trialEndDate = new Date(now);
      trialEndDate.setDate(trialEndDate.getDate() + 7);
      
      const userRef = doc(db, "users", user.uid);
      updateDoc(userRef, {
        subscriptionPlan: "trial",
        subscriptionStatus: "trial",
        trialStartDate: Timestamp.fromDate(now),
        trialEndDate: Timestamp.fromDate(trialEndDate),
        premium: false,
        dailyQuestionCount: 0,
        lastQuestionDate: now.toISOString().split("T")[0],
      }).then(() => {
        console.log("[Home] ✅ Kullanıcı Trial'a döndürüldü");
        showToast("Aboneliğiniz bitti. 7 günlük yeni Trial başlatıldı! Planınızı yenileyin.", "info");
        refreshUserData();
      }).catch((error) => {
        console.error("[Home] Trial'a döndürme hatası:", error);
      });
    }
    
    // 2. Trial süresi dolmuşsa ve Firestore'da hala "trial" olarak işaretliyse → Freemium'a geçir
    if (plan === "trial" && status === "freemium" && (userData.subscriptionPlan as any) !== "freemium") {
      console.log("[Home] Trial süresi doldu, Freemium moduna geçiliyor...");
      
      const now = new Date();
      const userRef = doc(db, "users", user.uid);
      updateDoc(userRef, {
        subscriptionPlan: "freemium",
        subscriptionStatus: "freemium",
        premium: false,
        dailyQuestionCount: 0,
        lastQuestionDate: now.toISOString().split("T")[0],
      }).then(() => {
        console.log("[Home] ✅ Kullanıcı Freemium moduna geçirildi");
        showToast("Trial süreniz bitti. Freemium moduna geçtiniz. Premium için plan seçin!", "info");
        refreshUserData();
      }).catch((error) => {
        console.error("[Home] Freemium'a geçme hatası:", error);
      });
    }
  }, [user, userData, subscriptionStatus]);

  // Yükleniyor veya kullanıcı yoksa hiçbir şey gösterme
  if (authLoading || userDataLoading || !user) {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
      <PopupMessage />
      <HomeHeader onMenuClick={() => setIsMenuOpen(true)} />
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      
      <div className="flex justify-center items-start px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="w-full max-w-sm lg:max-w-4xl xl:max-w-6xl">
          {/* HEADER - Premium */}
          <div className="mb-8 animate-slideFade">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Ana Sayfa</h1>
            <p className="text-gray-600">Hoş geldin, {displayName}</p>
          </div>

          {/* EMAIL VERIFICATION BANNER */}
          {showEmailVerificationBanner && (
            <div className="mb-6 animate-slideFade">
              <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-3xl p-5 shadow-[0_15px_35px_rgba(251,146,60,0.3)] border border-yellow-300/30 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                        <span className="text-2xl">📧</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-lg mb-2">Email Adresini Doğrula</h3>
                        <p className="text-white/90 text-sm leading-relaxed mb-4">
                          Hesabını güvenli tutmak için email adresini doğrulamanız gerekiyor. 
                          Email kutunuzu kontrol edin veya yeni doğrulama linki gönderin.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleSendVerificationEmail}
                            disabled={sendingVerificationEmail}
                            className="px-4 py-2 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {sendingVerificationEmail ? (
                              <>
                                <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                                <span>Gönderiliyor...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span>Email Gönder</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleDismissVerificationBanner}
                            className="px-4 py-2 bg-white/20 text-white font-semibold rounded-xl hover:bg-white/30 transition text-sm backdrop-blur-sm"
                          >
                            Daha Sonra
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowEmailVerificationBanner(false)}
                      className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition backdrop-blur-sm flex-shrink-0"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop: Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN - Main Actions */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* BUGÜNKÜ HEDEF CARD - Enhanced */}
              <div className="animate-slideFade" style={{ animationDelay: "0.1s" }}>
                <div className="bg-gradient-to-br from-white via-white to-blue-50/30 backdrop-blur-xl rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 relative overflow-hidden">
                  {/* Decorative gradient circle */}
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl"></div>
                  
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-gray-900 font-bold text-lg">Bugünkü Hedefin</h3>
                            <p className="text-xs text-gray-500">Günlük ilerleme</p>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-1.5 rounded-full font-semibold shadow-md">
                        {dailyLimit === Infinity ? "Sınırsız" : `${dailyLimit} soru`}
                      </span>
                    </div>
                    
                    <div className="mb-5 space-y-3">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-700 font-semibold text-sm">Bugün Sorulan Sorular</span>
                          <span className="text-2xl font-bold text-blue-600">{todayQuestionsCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 text-sm">Kalan Soru Hakkı</span>
                          <span className={`text-xl font-bold ${
                            questionInfo.remaining > 0 ? "text-green-600" : "text-red-600"
                          }`}>
                            {questionInfo.remaining === Infinity ? "∞" : questionInfo.remaining}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {dailyLimit === Infinity 
                          ? "Sınırsız soru sorabilirsin, koçunla gün sonu değerlendirmesi yap."
                          : `En az ${dailyLimit} zor soruyu çöz, koçunla gün sonu değerlendirmesi yap.`
                        }
                      </p>
                    </div>
                    
                    {/* Enhanced Progress bar */}
                    {dailyLimit !== Infinity && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-500 font-medium">İlerleme</span>
                          <span className="text-gray-700 font-bold">
                            {todayQuestionsCount} / {dailyLimit} tamamlandı
                          </span>
                        </div>
                        <div className="w-full bg-gray-200/60 rounded-full h-3 overflow-hidden shadow-inner">
                          <div 
                            className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500 h-3 rounded-full transition-all duration-700 ease-out shadow-lg relative"
                            style={{ width: `${Math.min((todayQuestionsCount / dailyLimit) * 100, 100)}%` }}
                          >
                            <div className="absolute inset-0 bg-white/30 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SORU SOR BUTONU - Enhanced */}
              <div className="animate-slideFade" style={{ animationDelay: "0.2s" }}>
                <button
                  onClick={() => router.push("/soru-sor")}
                  className="w-full group relative overflow-hidden py-5 rounded-3xl text-white font-bold text-lg
                           bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600
                           shadow-[0_20px_50px_rgba(59,130,246,0.4)]
                           active:scale-[0.98] transition-all duration-300
                           hover:shadow-[0_25px_60px_rgba(59,130,246,0.5)]
                           hover:scale-[1.02]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Soru Sor</span>
                  </div>
                </button>
              </div>

              {/* SON ÇÖZÜLEN SORULAR - Premium */}
              <div className="animate-slideFade" style={{ animationDelay: "0.4s" }}>
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden mb-6">
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-200/20 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900">Son Sorular</h2>
                    </div>
                {recentQuestions.length === 0 ? (
                  <div className="min-h-[200px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-bold mb-2 text-lg">Henüz soru yüklemedin</p>
                      <p className="text-sm text-gray-500 mb-4 font-medium">
                        İlk sorunu yüklemek için yukarıdaki{" "}
                        <span className="font-bold text-blue-600">Soru Sor</span>{" "}
                        butonuna tıkla.
                      </p>
                      <button
                        onClick={() => router.push("/soru-sor")}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition active:scale-[0.98]"
                      >
                        Soru Sor →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentQuestions.map((soru) => (
                      <div
                        key={soru.id}
                        onClick={() => router.push(`/sorularim/${soru.id}`)}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-white backdrop-blur-xl cursor-pointer transition-all hover:shadow-md border border-white/50 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <div className={`w-12 h-12 bg-gradient-to-br ${SUBJECT_COLORS[soru.ders || "Bilinmeyen"] || "from-gray-500 to-gray-600"} rounded-xl flex items-center justify-center text-2xl shadow-lg`}>
                          {SUBJECT_ICONS[soru.ders || "Bilinmeyen"] || "❓"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{soru.ders || "Bilinmeyen"}</p>
                          <p className="text-xs text-gray-500 font-medium">
                            {soru.createdAt?.toDate?.()?.toLocaleDateString("tr-TR") || "Tarih yok"}
                          </p>
                        </div>
                        <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                          soru.status === "solved"
                            ? "bg-green-100 text-green-700"
                            : soru.status === "answered"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {soru.status === "solved" ? "✓ Çözüldü" : soru.status === "answered" ? "✓ Yanıtlandı" : "⏸ Beklemede"}
                        </span>
                      </div>
                    ))}
                    <button
                      onClick={() => router.push("/sorularim")}
                      className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-bold text-sm hover:shadow-lg transition active:scale-[0.98]"
                    >
                      Tümünü Gör →
                    </button>
                  </div>
                )}
                  </div>
                </div>
              </div>

              {/* PAKET BİLGİLERİ BANNER'I - Sol Kolonun Altında */}
              {/* FREEMIUM BANNER */}
              {isFreemium && (
                <div className="animate-slideFade">
                  <div
                    onClick={() => router.push("/premium")}
                    className="bg-gradient-to-r from-gray-700 via-gray-800 to-gray-900 rounded-3xl p-5 shadow-[0_15px_35px_rgba(0,0,0,0.3)] border border-gray-600/30 cursor-pointer active:scale-[0.98] transition-all hover:shadow-[0_20px_45px_rgba(0,0,0,0.4)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                          <span className="text-2xl">🆓</span>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg mb-1">Freemium Mod</h3>
                          <p className="text-gray-300 text-sm">
                            Günde sadece <span className="font-bold text-white">{dailyLimit} soru</span> sorabilirsin • Bugün: <span className="font-bold text-white">{todayQuestionsCount}</span> soru • Kalan: <span className={`font-bold ${questionInfo.remaining > 0 ? "text-green-300" : "text-red-300"}`}>{questionInfo.remaining}</span> / {dailyLimit} • ❌ AI Çözüm Yok
                          </p>
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition text-sm">
                        Premium Al
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PLAN BANNER'LARI */}
              {subscriptionStatus && !isFreemium && (
                <div className="animate-slideFade space-y-4">
                  {/* Trial Bitiyor Uyarısı */}
                  {subscriptionStatus === "trial" && trialDaysLeft <= 2 && trialDaysLeft > 0 && (
                    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-4 shadow-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⏰</span>
                        <div className="flex-1">
                          <h4 className="text-white font-bold text-sm">Trial Süreniz Bitiyor!</h4>
                          <p className="text-white/90 text-xs">
                            {trialDaysLeft} gün kaldı! Premium'a geçin, sınırsız soru + AI çözüm kazanın.
                          </p>
                        </div>
                        <button 
                          onClick={() => router.push("/premium")}
                          className="px-3 py-1.5 bg-white text-orange-600 font-bold rounded-lg text-xs hover:bg-orange-50 transition"
                        >
                          Plan Seç
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Abonelik Bitiyor Uyarısı */}
                  {subscriptionStatus === "active" && (currentPlan === "lite" || currentPlan === "premium") && subscriptionDaysLeft <= 7 && subscriptionDaysLeft > 0 && (
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-4 shadow-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div className="flex-1">
                          <h4 className="text-white font-bold text-sm">Aboneliğiniz Bitiyor!</h4>
                          <p className="text-white/90 text-xs">
                            {subscriptionDaysLeft} gün kaldı! Şimdi yenilerseniz %15 indirim kazanın.
                          </p>
                        </div>
                        <button 
                          onClick={() => router.push("/premium")}
                          className="px-3 py-1.5 bg-white text-red-600 font-bold rounded-lg text-xs hover:bg-red-50 transition"
                        >
                          Yenile
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Trial Plan Banner */}
                  {subscriptionStatus === "trial" && (
                    <div
                      onClick={() => router.push("/premium")}
                      className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-3xl p-5 shadow-[0_15px_35px_rgba(59,130,246,0.3)] border border-blue-400/30 cursor-pointer active:scale-[0.98] transition-all hover:shadow-[0_20px_45px_rgba(59,130,246,0.4)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <span className="text-2xl">🆓</span>
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-lg mb-1">Trial Plan</h3>
                            <p className="text-blue-100 text-sm">
                              {trialDaysLeft > 0 ? (
                                <>
                                  Kalan süre: <span className="font-bold">{trialDaysLeft} gün</span> • Bugün: <span className="font-bold text-white">{todayQuestionsCount}</span> soru soruldu • Kalan: <span className={`font-bold ${questionInfo.remaining > 0 ? "text-green-200" : "text-red-200"}`}>{questionInfo.remaining}</span> / {dailyLimit} soru
                                </>
                              ) : (
                                "Trial süresi doldu"
                              )}
                            </p>
                          </div>
                        </div>
                        <button className="px-4 py-2 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition text-sm">
                          Plan Seç
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Lite Plan Banner */}
                  {subscriptionStatus === "active" && currentPlan === "lite" && (
                    <div
                      onClick={() => router.push("/premium")}
                      className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 rounded-3xl p-5 shadow-[0_15px_35px_rgba(59,130,246,0.3)] border border-blue-400/30 cursor-pointer active:scale-[0.98] transition-all hover:shadow-[0_20px_45px_rgba(59,130,246,0.4)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <span className="text-2xl">📚</span>
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-lg mb-1">Lite Plan</h3>
                            <p className="text-blue-100 text-sm">
                              {subscriptionDaysLeft > 0 ? (
                                <>
                                  Bitiş: <span className="font-bold">{formatEndDate(userData.subscriptionEndDate)}</span>
                                  {' '}({subscriptionDaysLeft} gün)
                                </>
                              ) : (
                                "Abonelik süresi doldu"
                              )}
                            </p>
                            <p className="text-blue-200 text-xs mt-1">
                              Bugün: <span className="font-bold text-white">{todayQuestionsCount}</span> soru • Kalan: <span className={`font-bold ${questionInfo.remaining > 0 ? "text-green-200" : "text-red-200"}`}>{questionInfo.remaining}</span> / {dailyLimit}
                            </p>
                          </div>
                        </div>
                        <button className="px-4 py-2 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition text-sm">
                          Yükselt
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Premium Plan Banner */}
                  {subscriptionStatus === "active" && currentPlan === "premium" && (
                    <div
                      onClick={() => router.push("/premium")}
                      className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-3xl p-5 shadow-[0_15px_35px_rgba(251,146,60,0.3)] border border-yellow-400/30 cursor-pointer active:scale-[0.98] transition-all hover:shadow-[0_20px_45px_rgba(251,146,60,0.4)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <span className="text-2xl">⭐</span>
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-lg mb-1">Premium Plan</h3>
                            <p className="text-yellow-100 text-sm">
                              {subscriptionDaysLeft > 0 ? (
                                <>
                                  Bitiş: <span className="font-bold">{formatEndDate(userData.subscriptionEndDate)}</span>
                                  {' '}({subscriptionDaysLeft} gün)
                                </>
                              ) : (
                                "Abonelik süresi doldu"
                              )}
                            </p>
                            <p className="text-yellow-200 text-xs mt-1">
                              Bugün: <span className="font-bold text-white">{todayQuestionsCount}</span> soru • Sınırsız soru hakkı
                            </p>
                          </div>
                        </div>
                        <button className="px-4 py-2 bg-white text-orange-600 font-bold rounded-xl hover:bg-orange-50 transition text-sm">
                          Yönet
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expired Banner */}
                  {subscriptionStatus === "expired" && (
                    <div
                      onClick={() => router.push("/premium")}
                      className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 rounded-3xl p-5 shadow-[0_15px_35px_rgba(239,68,68,0.3)] border border-red-400/30 cursor-pointer active:scale-[0.98] transition-all hover:shadow-[0_20px_45px_rgba(239,68,68,0.4)]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                            <span className="text-2xl">⚠️</span>
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-lg mb-1">Üyelik Süresi Doldu</h3>
                            <p className="text-red-100 text-sm">Plan satın alarak devam edebilirsin</p>
                          </div>
                        </div>
                        <button className="px-4 py-2 bg-white text-red-600 font-bold rounded-xl hover:bg-red-50 transition text-sm">
                          Plan Seç
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN - Side Cards */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* KOÇ CARD - Enhanced */}
              <div className="animate-slideFade" style={{ animationDelay: "0.3s" }}>
                <div
                  className="bg-gradient-to-br from-white via-white to-green-50/30 backdrop-blur-xl rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.1)] border border-white/80 cursor-pointer active:scale-[0.98] transition-all duration-300 hover:shadow-[0_25px_70px_rgba(0,0,0,0.15)] hover:scale-[1.02] relative overflow-hidden group"
                  onClick={() => router.push("/mesajlar")}
                >
                  {/* Decorative gradient */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-full blur-2xl"></div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-2 bg-green-100 px-3 py-1.5 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-700 font-semibold">Çevrimiçi</span>
                      </div>
                    </div>
                    
                    <h3 className="text-gray-900 font-bold text-lg mb-2">Koçunla Konuş</h3>
                    <p className="text-gray-600 text-sm leading-relaxed mb-4">
                      Takıldığın konuları sor, çalışma planını birlikte düzenleyin.
                    </p>
                    
                    <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm group-hover:gap-3 transition-all">
                      <span>Mesaj Gönder</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* YAKLAŞAN ETKİNLİKLER CARD - Freemium kullanıcılar için gizli */}
              {!isFreemium && (
                <div className="animate-slideFade" style={{ animationDelay: "0.5s" }}>
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-200/20 rounded-full blur-3xl"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <h3 className="text-2xl font-bold text-gray-900">Yaklaşan Etkinlikler</h3>
                        </div>
                      </div>
                    {upcomingEvents.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">Henüz yaklaşan etkinlik yok</p>
                      </div>
                    ) : (
                      <div>
                        {upcomingEvents.map((event) => {
                          const eventDate = event.date?.toDate?.() || new Date(event.date?.seconds * 1000);
                          const formattedDate = eventDate.toLocaleDateString("tr-TR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          const isToday = new Date().toDateString() === eventDate.toDateString();
                          const isTomorrow = new Date(Date.now() + 86400000).toDateString() === eventDate.toDateString();

                          return (
                            <div
                              key={event.id}
                              className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100 hover:shadow-md transition"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                      event.type === "meeting"
                                        ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                                        : "bg-gray-100 text-gray-800"
                                    }`}>
                                      {event.type === "meeting" ? "🎥 Canlı Toplantı" : "📅 Diğer"}
                                    </span>
                                    {(isToday || isTomorrow) && (
                                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
                                        {isToday ? "Bugün" : "Yarın"}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="font-bold text-gray-900 text-lg mb-2">{event.title}</h4>
                                  {event.description && (
                                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{event.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                  <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <span className="font-medium">{formattedDate}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                  {event.coachPhotoURL ? (
                                    <img
                                      src={event.coachPhotoURL}
                                      alt={event.coachName}
                                      className="w-8 h-8 rounded-full object-cover border-2 border-green-200"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                                      <span className="text-xs font-bold text-blue-600">
                                        {event.coachName.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium">{event.coachName}</span>
                                    {event.coachTitle && (
                                      <p className="text-xs text-green-600 font-medium">{event.coachTitle}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {upcomingEvents.length > 0 && (
                      <button
                        onClick={() => router.push("/etkinlikler")}
                        className="w-full mt-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:shadow-lg transition active:scale-[0.98]"
                      >
                        Tüm Etkinlikleri Gör
                      </button>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* QUICK STATS CARD - Premium */}
              <div className="animate-slideFade" style={{ animationDelay: "0.6s" }}>
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-white/70 relative overflow-hidden">
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-200/20 rounded-full blur-3xl"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900">Hızlı İstatistikler</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 backdrop-blur-xl rounded-2xl p-4 shadow-[0_5px_20px_rgba(0,0,0,0.08)] border border-white/50">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 font-medium mb-1">Toplam Soru</p>
                            <p className="text-2xl font-bold text-gray-900">{totalQuestionsCount}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-xl rounded-2xl p-4 shadow-[0_5px_20px_rgba(0,0,0,0.08)] border border-white/50">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 font-medium mb-1">Çözülen Soru</p>
                            <p className="text-2xl font-bold text-gray-900">{solvedQuestionsCount}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 backdrop-blur-xl rounded-2xl p-4 shadow-[0_5px_20px_rgba(0,0,0,0.08)] border border-white/50">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-md">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 font-medium mb-1">Çalışma Süresi</p>
                            <p className="text-2xl font-bold text-gray-900">{workDuration || "0 dk"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push("/istatistikler")}
                      className="w-full mt-6 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-bold text-sm hover:shadow-lg transition active:scale-[0.98]"
                    >
                      Tümünü Gör
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-[0_10px_30px_rgba(59,130,246,0.4)] flex items-center justify-center transition-all duration-300 ${
          showScrollTop
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-90 pointer-events-none"
        } active:scale-95 hover:shadow-[0_15px_40px_rgba(59,130,246,0.5)]`}
        aria-label="Yukarı git"
      >
        <svg
          className="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
      
      <StudentFooter />

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
