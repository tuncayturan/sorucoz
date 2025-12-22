import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AISettings {
  provider?: "gemini" | "openai" | "groq" | "together";
  model?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  togetherApiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

interface SiteSettings {
  logo?: string;
  icon?: string;
  favicon?: string;
  siteName?: string;
  footerCopyright?: string;
  footerDescription?: string;
  notificationSound?: string;
  landingVideoUrl?: string;
  aiSettings?: AISettings;
  litePlanPrice?: number;
  premiumPlanPrice?: number;
  yearlyDiscountPercent?: number;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settingsRef = doc(db, "siteSettings", "main");

    // Real-time listener
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SiteSettings);
      } else {
        // Default values if no settings exist
        setSettings({});
      }
      setLoading(false);
    }, (error) => {
      console.error("Site settings error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { settings, loading };
}
