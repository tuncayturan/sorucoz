import { getAISettings, type AISettings } from "./ai-config";

/**
 * Provider bazında maliyet hesaplama fonksiyonları
 */

export interface CostCalculation {
  inputPricePer1M: number;
  outputPricePer1M: number;
  freeTierLimit: number; // Günlük ücretsiz istek limiti
  freeTierType: "requests" | "tokens" | "credits"; // Ücretsiz tier tipi
  freeTierValue?: number; // Ücretsiz tier değeri (tokens veya credits için)
}

/**
 * Provider'a göre maliyet bilgilerini döndürür
 */
export function getProviderCostInfo(provider: string, model?: string): CostCalculation {
  switch (provider) {
    case "gemini":
      // Gemini 2.0 Flash fiyatlandırması (2025)
      if (model?.includes("2.0-flash")) {
        return {
          inputPricePer1M: 0.075, // $0.075 / 1M tokens
          outputPricePer1M: 0.30, // $0.30 / 1M tokens
          freeTierLimit: 60, // Günde 60 istek ücretsiz
          freeTierType: "requests",
        };
      } else if (model?.includes("1.5-pro")) {
        return {
          inputPricePer1M: 1.25, // $1.25 / 1M tokens
          outputPricePer1M: 5.00, // $5.00 / 1M tokens
          freeTierLimit: 60, // Günde 60 istek ücretsiz
          freeTierType: "requests",
        };
      } else {
        // Gemini 1.5 Flash (varsayılan)
        return {
          inputPricePer1M: 0.075, // $0.075 / 1M tokens
          outputPricePer1M: 0.30, // $0.30 / 1M tokens
          freeTierLimit: 60, // Günde 60 istek ücretsiz
          freeTierType: "requests",
        };
      }

    case "openai":
      if (model?.includes("gpt-4o")) {
        return {
          inputPricePer1M: 2.50, // $2.50 / 1M tokens (gpt-4o)
          outputPricePer1M: 10.00, // $10.00 / 1M tokens
          freeTierLimit: 0, // Ücretsiz tier yok (sadece $5 başlangıç kredisi)
          freeTierType: "credits",
          freeTierValue: 5.0, // $5 başlangıç kredisi
        };
      } else if (model?.includes("gpt-4o-mini")) {
        return {
          inputPricePer1M: 0.15, // $0.15 / 1M tokens
          outputPricePer1M: 0.60, // $0.60 / 1M tokens
          freeTierLimit: 0,
          freeTierType: "credits",
          freeTierValue: 5.0,
        };
      } else if (model?.includes("gpt-4-turbo")) {
        return {
          inputPricePer1M: 10.00, // $10.00 / 1M tokens
          outputPricePer1M: 30.00, // $30.00 / 1M tokens
          freeTierLimit: 0,
          freeTierType: "credits",
          freeTierValue: 5.0,
        };
      } else {
        // GPT-3.5 Turbo
        return {
          inputPricePer1M: 0.50, // $0.50 / 1M tokens
          outputPricePer1M: 1.50, // $1.50 / 1M tokens
          freeTierLimit: 0,
          freeTierType: "credits",
          freeTierValue: 5.0,
        };
      }

    case "groq":
      // Groq ücretsiz tier: Günde 14,400 istek
      return {
        inputPricePer1M: 0.00, // Ücretsiz tier'da ücretsiz
        outputPricePer1M: 0.00, // Ücretsiz tier'da ücretsiz
        freeTierLimit: 14400, // Günde 14,400 istek ücretsiz
        freeTierType: "requests",
      };

    case "together":
      // Together AI: $25 başlangıç kredisi
      return {
        inputPricePer1M: 0.00, // Başlangıç kredisi ile ücretsiz
        outputPricePer1M: 0.00,
        freeTierLimit: 0,
        freeTierType: "credits",
        freeTierValue: 25.0, // $25 başlangıç kredisi
      };

    default:
      // Varsayılan: Gemini
      return {
        inputPricePer1M: 0.075,
        outputPricePer1M: 0.30,
        freeTierLimit: 60,
        freeTierType: "requests",
      };
  }
}

/**
 * Maliyet hesaplama fonksiyonu
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  provider: string,
  model?: string
): number {
  const costInfo = getProviderCostInfo(provider, model);
  
  const inputCost = (inputTokens / 1_000_000) * costInfo.inputPricePer1M;
  const outputCost = (outputTokens / 1_000_000) * costInfo.outputPricePer1M;
  
  return inputCost + outputCost;
}

/**
 * Ortalama token kullanımı (provider'a göre)
 */
export function getAverageTokens(provider: string): { input: number; output: number } {
  switch (provider) {
    case "gemini":
      return { input: 500, output: 1500 }; // Görsel + prompt
    case "openai":
      return { input: 600, output: 1800 }; // Vision API biraz daha fazla token kullanır
    case "groq":
      return { input: 550, output: 1600 };
    case "together":
      return { input: 550, output: 1600 };
    default:
      return { input: 500, output: 1500 };
  }
}

/**
 * Firestore'dan AI ayarlarını alıp maliyet hesaplar
 */
export async function calculateCostWithSettings(
  inputTokens: number,
  outputTokens: number
): Promise<{ cost: number; provider: string; model?: string; costInfo: CostCalculation }> {
  const settings = await getAISettings();
  if (!settings) {
    // Varsayılan: Gemini
    const costInfo = getProviderCostInfo("gemini", "gemini-2.0-flash-001");
    return {
      cost: calculateCost(inputTokens, outputTokens, "gemini", "gemini-2.0-flash-001"),
      provider: "gemini",
      model: "gemini-2.0-flash-001",
      costInfo,
    };
  }

  const costInfo = getProviderCostInfo(settings.provider, settings.model);
  const cost = calculateCost(inputTokens, outputTokens, settings.provider, settings.model);

  return {
    cost,
    provider: settings.provider,
    model: settings.model,
    costInfo,
  };
}

