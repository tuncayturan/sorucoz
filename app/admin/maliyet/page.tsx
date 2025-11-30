"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";

interface ProviderInfo {
  name: string;
  model: string;
  costInfo: {
    inputPricePer1M: number;
    outputPricePer1M: number;
    freeTierLimit: number;
    freeTierType: "requests" | "tokens" | "credits";
    freeTierValue?: number;
  };
}

interface CostStats {
  totalQuestions: number;
  solvedQuestions: number;
  pendingQuestions: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  freeTierLimit: number;
  freeTierUsed: number;
  freeTierRemaining: number;
  isOverFreeTier: boolean;
  monthlyEstimate: number;
  monthlyCostEstimate: number;
}

interface DailyDistribution {
  date: string;
  count: number;
  cost: number;
}

export default function MaliyetPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [stats, setStats] = useState<CostStats | null>(null);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [dailyDistribution, setDailyDistribution] = useState<DailyDistribution[]>([]);
  const [subjectDistribution, setSubjectDistribution] = useState<{ [key: string]: number }>({});
  const [topUsers, setTopUsers] = useState<Array<{ userId: string; count: number }>>([]);

  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (!user) {
        router.replace("/landing");
      } else if (userData?.role !== "admin") {
        router.replace("/home");
      }
    }
  }, [user, userData, authLoading, userDataLoading, router]);

  useEffect(() => {
    if (user && userData?.role === "admin") {
      fetchCostStats();
    }
  }, [user, userData, period]);

  const fetchCostStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/cost-stats?period=${period}`);
      
      if (!response.ok) {
        throw new Error("İstatistikler alınamadı");
      }
      
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setProvider(data.provider || null);
        setDailyDistribution(data.dailyDistribution || []);
        setSubjectDistribution(data.subjectDistribution || {});
        setTopUsers(data.topUsers || []);
      }
    } catch (error) {
      console.error("Maliyet istatistikleri hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("tr-TR").format(num);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  };

  if (authLoading || userDataLoading || !user || userData?.role !== "admin") {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const maxDailyCount = dailyDistribution.length > 0 
    ? Math.max(...dailyDistribution.map(d => d.count))
    : 1;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Maliyet Yönetimi</h1>
              <p className="text-gray-600">AI API kullanım istatistikleri ve maliyet takibi</p>
            </div>
            {provider && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div className="text-sm font-semibold text-gray-700 mb-1">Aktif Provider</div>
                <div className="text-lg font-bold text-gray-900">
                  {provider.name === "gemini" && "🤖"}
                  {provider.name === "openai" && "🧠"}
                  {provider.name === "groq" && "⚡"}
                  {provider.name === "together" && "🌟"}
                  {" "}
                  {provider.name === "gemini" && "Google Gemini"}
                  {provider.name === "openai" && "OpenAI"}
                  {provider.name === "groq" && "Groq"}
                  {provider.name === "together" && "Together AI"}
                </div>
                <div className="text-xs text-gray-600 mt-1">{provider.model}</div>
                <div className="text-xs text-gray-500 mt-2">
                  Input: ${provider.costInfo.inputPricePer1M}/1M | Output: ${provider.costInfo.outputPricePer1M}/1M
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Period Selector */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod("daily")}
              className={`px-4 py-2 rounded-xl font-semibold transition ${
                period === "daily"
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Günlük
            </button>
            <button
              onClick={() => setPeriod("weekly")}
              className={`px-4 py-2 rounded-xl font-semibold transition ${
                period === "weekly"
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Haftalık
            </button>
            <button
              onClick={() => setPeriod("monthly")}
              className={`px-4 py-2 rounded-xl font-semibold transition ${
                period === "monthly"
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Aylık
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : stats ? (
          <>
            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Toplam Soru */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-2xl">
                    ❓
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Toplam Soru</h3>
                <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalQuestions)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Çözülen: {formatNumber(stats.solvedQuestions)} | Bekleyen: {formatNumber(stats.pendingQuestions)}
                </p>
              </div>

              {/* Tahmini Maliyet */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-2xl">
                    💵
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Tahmini Maliyet</h3>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.estimatedCost)}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Aylık tahmin: {formatCurrency(stats.monthlyCostEstimate)}
                </p>
              </div>

              {/* Ücretsiz Tier */}
              <div className={`bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6 ${
                stats.isOverFreeTier ? "ring-2 ring-red-500" : ""
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                    stats.isOverFreeTier 
                      ? "bg-gradient-to-br from-red-500 to-pink-600"
                      : "bg-gradient-to-br from-yellow-400 to-orange-500"
                  }`}>
                    {stats.isOverFreeTier ? "⚠️" : "🆓"}
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Ücretsiz Tier</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {provider?.costInfo.freeTierType === "credits" 
                    ? formatCurrency(stats.freeTierUsed)
                    : formatNumber(Math.round(stats.freeTierUsed))
                  } / {provider?.costInfo.freeTierType === "credits" 
                    ? formatCurrency(stats.freeTierLimit)
                    : stats.freeTierLimit
                  }
                </p>
                <p className={`text-xs mt-2 ${
                  stats.isOverFreeTier ? "text-red-600 font-semibold" : "text-gray-500"
                }`}>
                  {stats.isOverFreeTier 
                    ? "⚠️ Limit aşıldı!" 
                    : `Kalan: ${provider?.costInfo.freeTierType === "credits"
                      ? formatCurrency(stats.freeTierRemaining)
                      : formatNumber(Math.round(stats.freeTierRemaining))
                    }`
                  }
                </p>
                {provider && (
                  <p className="text-xs text-gray-400 mt-1">
                    {provider.costInfo.freeTierType === "requests" && "Günlük istek limiti"}
                    {provider.costInfo.freeTierType === "credits" && "Başlangıç kredisi"}
                    {provider.costInfo.freeTierType === "tokens" && "Token limiti"}
                  </p>
                )}
              </div>

              {/* Token Kullanımı */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-2xl">
                    🔢
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 mb-1">Token Kullanımı</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(stats.estimatedInputTokens + stats.estimatedOutputTokens)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Input: {formatNumber(stats.estimatedInputTokens)} | Output: {formatNumber(stats.estimatedOutputTokens)}
                </p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Günlük Dağılım Grafiği */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Günlük Soru Dağılımı (Son 7 Gün)</h2>
                <div className="space-y-4">
                  {dailyDistribution.map((day, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-20 text-xs text-gray-600 font-medium">
                        {formatDate(day.date)}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                          style={{ width: `${(day.count / maxDailyCount) * 100}%` }}
                        >
                          {day.count > 0 && (
                            <span className="text-xs font-semibold text-white">{day.count}</span>
                          )}
                        </div>
                      </div>
                      <div className="w-24 text-xs text-gray-600 text-right">
                        {formatCurrency(day.cost)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ders Bazında Dağılım */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Ders Bazında Dağılım</h2>
                <div className="space-y-3">
                  {Object.entries(subjectDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([subject, count]) => {
                      const percentage = (count / stats.totalQuestions) * 100;
                      return (
                        <div key={subject} className="flex items-center gap-4">
                          <div className="w-32 text-sm text-gray-700 font-medium truncate">
                            {subject}
                          </div>
                          <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-16 text-sm text-gray-600 text-right font-semibold">
                            {count}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Top Users */}
            {topUsers.length > 0 && (
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">En Çok Soru Soran Kullanıcılar (Top 10)</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sıra</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Kullanıcı ID</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Soru Sayısı</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Tahmini Maliyet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topUsers.map((user, index) => {
                        const userCost = calculateCost(
                          user.count * AVG_INPUT_TOKENS,
                          user.count * AVG_OUTPUT_TOKENS * 0.8 // %80 çözülmüş varsayımı
                        );
                        return (
                          <tr key={user.userId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm text-gray-600">#{index + 1}</td>
                            <td className="py-3 px-4 text-sm text-gray-900 font-mono truncate max-w-xs">
                              {user.userId}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700 text-right font-semibold">
                              {formatNumber(user.count)}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-700 text-right">
                              {formatCurrency(userCost)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg border border-blue-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">💡 Maliyet Hesaplama</h3>
                <p className="text-sm text-gray-700 mb-3">
                  {provider 
                    ? `Maliyetler ${provider.name === "gemini" ? "Google Gemini" : provider.name === "openai" ? "OpenAI" : provider.name === "groq" ? "Groq" : "Together AI"} ${provider.model} modeli fiyatlandırmasına göre hesaplanmaktadır:`
                    : "Maliyetler aktif AI provider'ın fiyatlandırmasına göre hesaplanmaktadır:"
                  }
                </p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Input: $0.075 / 1M tokens</li>
                  <li>• Output: $0.30 / 1M tokens</li>
                  <li>• Ortalama: ~500 input + 1,500 output token/soru</li>
                  <li>• Tahmini maliyet: ~$0.0005/soru</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-lg border border-yellow-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">🆓 Ücretsiz Tier</h3>
                <p className="text-sm text-gray-700 mb-3">
                  Google Gemini API ücretsiz tier limitleri:
                </p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Günde 60 istek ücretsiz</li>
                  <li>• Dakikada 15 istek rate limit</li>
                  <li>• Görsel analizi dahil</li>
                  <li>• Limit aşılırsa ücretli tier devreye girer</li>
                </ul>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-12 text-center">
            <p className="text-gray-500">İstatistikler yüklenemedi</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function (same as API)
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputPricePer1M = 0.075;
  const outputPricePer1M = 0.30;
  const inputCost = (inputTokens / 1_000_000) * inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * outputPricePer1M;
  return inputCost + outputCost;
}

const AVG_INPUT_TOKENS = 500;
const AVG_OUTPUT_TOKENS = 1500;

