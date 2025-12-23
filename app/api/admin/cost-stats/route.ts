import { NextRequest, NextResponse } from "next/server";
import { collection, query, where, getDocs, Timestamp, collectionGroup } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  calculateCostWithSettings,
  getAverageTokens,
  getProviderCostInfo,
  type CostCalculation,
} from "@/lib/ai-cost-calculator";
import { getAISettings } from "@/lib/ai-config";

/**
 * Admin maliyet istatistiklerini döndürür
 * GET /api/admin/cost-stats?period=daily|weekly|monthly
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "daily"; // daily, weekly, monthly

    // Tarih aralığını belirle
    const now = new Date();
    let startDate: Date;
    
    if (period === "daily") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "weekly") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.now();

    // Tüm kullanıcıların sorularını topla
    const allQuestions: Array<{
      userId: string;
      createdAt: Timestamp;
      ders: string;
      status: string;
    }> = [];

    // Tüm kullanıcıları al
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);

    // Her kullanıcının sorularını topla
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const questionsRef = collection(db, "users", userId, "sorular");
      const questionsQuery = query(
        questionsRef,
        where("createdAt", ">=", startTimestamp),
        where("createdAt", "<=", endTimestamp)
      );
      
      const questionsSnapshot = await getDocs(questionsQuery);
      questionsSnapshot.docs.forEach((questionDoc) => {
        const data = questionDoc.data();
        allQuestions.push({
          userId,
          createdAt: data.createdAt,
          ders: data.ders || "Bilinmeyen",
          status: data.status || "pending",
        });
      });
    }

    // AI ayarlarını al
    const aiSettings = await getAISettings();
    const provider = aiSettings?.provider || "gemini";
    const model = aiSettings?.model || "gemini-2.0-flash-001";
    const costInfo = getProviderCostInfo(provider, model);
    const avgTokens = getAverageTokens(provider);

    // İstatistikleri hesapla
    const totalQuestions = allQuestions.length;
    const solvedQuestions = allQuestions.filter(q => q.status === "solved" || q.status === "answered").length;
    const pendingQuestions = allQuestions.filter(q => q.status === "pending").length;

    // Token kullanımı tahmini (provider'a göre ortalama)
    const estimatedInputTokens = totalQuestions * avgTokens.input;
    const estimatedOutputTokens = solvedQuestions * avgTokens.output;
    const totalInputTokens = estimatedInputTokens;
    const totalOutputTokens = estimatedOutputTokens;

    // Maliyet hesaplama (provider'a göre)
    const costResult = await calculateCostWithSettings(totalInputTokens, totalOutputTokens);
    const estimatedCost = costResult.cost;

    // Free tier hesaplama
    let freeTierLimit = costInfo.freeTierLimit;
    let freeTierUsed: number;
    let freeTierRemaining: number;
    let isOverFreeTier: boolean;

    if (costInfo.freeTierType === "requests") {
      // İstek bazlı free tier (Gemini, Groq)
      freeTierUsed = period === "daily" ? totalQuestions : (totalQuestions / (period === "weekly" ? 7 : 30));
      freeTierRemaining = Math.max(0, freeTierLimit - freeTierUsed);
      isOverFreeTier = freeTierUsed > freeTierLimit;
    } else if (costInfo.freeTierType === "credits") {
      // Kredi bazlı free tier (OpenAI, Together AI)
      freeTierLimit = costInfo.freeTierValue || 0;
      freeTierUsed = estimatedCost;
      freeTierRemaining = Math.max(0, freeTierLimit - freeTierUsed);
      isOverFreeTier = freeTierUsed > freeTierLimit;
    } else {
      // Tokens bazlı (şimdilik kullanılmıyor)
      freeTierUsed = 0;
      freeTierRemaining = 0;
      isOverFreeTier = false;
    }

    // Günlük dağılım (son 7 gün için)
    const dailyDistribution: Array<{ date: string; count: number; cost: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);
      
      const dayStartTimestamp = Timestamp.fromDate(dayStart);
      const dayEndTimestamp = Timestamp.fromDate(dayEnd);
      
      const dayQuestions = allQuestions.filter(q => {
        const qDate = q.createdAt.toDate();
        return qDate >= dayStart && qDate < dayEnd;
      });
      
      const daySolved = dayQuestions.filter(q => q.status === "solved" || q.status === "answered").length;
      const dayInputTokens = dayQuestions.length * avgTokens.input;
      const dayOutputTokens = daySolved * avgTokens.output;
      const dayCostResult = await calculateCostWithSettings(dayInputTokens, dayOutputTokens);
      const dayCostValue = dayCostResult.cost;
      
      dailyDistribution.push({
        date: dateStr,
        count: dayQuestions.length,
        cost: dayCostValue,
      });
    }

    // Ders bazında dağılım
    const subjectDistribution: { [key: string]: number } = {};
    allQuestions.forEach(q => {
      subjectDistribution[q.ders] = (subjectDistribution[q.ders] || 0) + 1;
    });

    // Kullanıcı bazında dağılım (top 10)
    const userDistribution: { [key: string]: number } = {};
    allQuestions.forEach(q => {
      userDistribution[q.userId] = (userDistribution[q.userId] || 0) + 1;
    });
    const topUsers = Object.entries(userDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    // Aylık tahmin (mevcut günlük ortalamaya göre)
    const daysInPeriod = period === "daily" ? 1 : period === "weekly" ? 7 : 30;
    const avgDailyQuestions = totalQuestions / daysInPeriod;
    const monthlyEstimate = avgDailyQuestions * 30;
    const monthlyCostResult = await calculateCostWithSettings(
      monthlyEstimate * avgTokens.input,
      (monthlyEstimate * 0.8) * avgTokens.output // %80 çözülmüş varsayımı
    );
    const monthlyCostEstimate = monthlyCostResult.cost;

    return NextResponse.json({
      success: true,
      period,
      provider: {
        name: provider,
        model: model,
        costInfo: {
          inputPricePer1M: costInfo.inputPricePer1M,
          outputPricePer1M: costInfo.outputPricePer1M,
          freeTierLimit: costInfo.freeTierLimit,
          freeTierType: costInfo.freeTierType,
          freeTierValue: costInfo.freeTierValue,
        },
      },
      stats: {
        totalQuestions,
        solvedQuestions,
        pendingQuestions,
        estimatedInputTokens: totalInputTokens,
        estimatedOutputTokens: totalOutputTokens,
        estimatedCost,
        freeTierLimit,
        freeTierUsed: Math.round(freeTierUsed * 100) / 100,
        freeTierRemaining: Math.round(freeTierRemaining * 100) / 100,
        isOverFreeTier,
        monthlyEstimate: Math.round(monthlyEstimate),
        monthlyCostEstimate: Math.round(monthlyCostEstimate * 100) / 100,
      },
      dailyDistribution,
      subjectDistribution,
      topUsers,
      dateRange: {
        start: startTimestamp.toDate().toISOString(),
        end: endTimestamp.toDate().toISOString(),
      },
    });
  } catch (error: any) {    return NextResponse.json(
      {
        error: error.message || "Maliyet istatistikleri alınamadı",
      },
      { status: 500 }
    );
  }
}

