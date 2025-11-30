import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AISettings {
  provider: "gemini" | "openai" | "groq" | "together";
  model: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  togetherApiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Firestore'dan AI ayarlarını alır
 */
export async function getAISettings(): Promise<AISettings | null> {
  try {
    const settingsRef = doc(db, "siteSettings", "main");
    const snapshot = await getDoc(settingsRef);
    
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.aiSettings) {
        return data.aiSettings as AISettings;
      }
    }
    
    // Varsayılan ayarlar (Gemini)
    return {
      provider: "gemini",
      model: "gemini-2.0-flash-001",
      geminiApiKey: process.env.GEMINI_API_KEY || "",
      maxTokens: 4000,
      temperature: 0.3,
    };
  } catch (error) {
    console.error("AI ayarları alınırken hata:", error);
    // Fallback: Environment variable'dan Gemini API key
    return {
      provider: "gemini",
      model: "gemini-2.0-flash-001",
      geminiApiKey: process.env.GEMINI_API_KEY || "",
      maxTokens: 4000,
      temperature: 0.3,
    };
  }
}

/**
 * Seçilen provider'a göre API key'i döndürür
 */
export function getAPIKey(settings: AISettings): string {
  switch (settings.provider) {
    case "gemini":
      return settings.geminiApiKey || process.env.GEMINI_API_KEY || "";
    case "openai":
      return settings.openaiApiKey || process.env.OPENAI_API_KEY || "";
    case "groq":
      return settings.groqApiKey || process.env.GROQ_API_KEY || "";
    case "together":
      return settings.togetherApiKey || process.env.TOGETHER_API_KEY || "";
    default:
      return process.env.GEMINI_API_KEY || "";
  }
}

