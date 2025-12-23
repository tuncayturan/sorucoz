"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserData } from "@/hooks/useUserData";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Toast from "@/components/ui/Toast";

interface AISettings {
  provider: "gemini" | "openai" | "groq" | "together";
  model: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  groqApiKey?: string;
  togetherApiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

const AI_PROVIDERS = {
  gemini: {
    name: "Google Gemini",
    icon: "🤖",
    models: [
      { value: "gemini-2.0-flash-001", label: "Gemini 2.0 Flash (Önerilen)" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
    apiKeyName: "geminiApiKey",
    apiKeyLabel: "Gemini API Key",
    apiKeyPlaceholder: "AIza...",
    apiKeyUrl: "https://aistudio.google.com/app/api-keys",
    description: "Ücretsiz tier: Günde 60 istek. Görsel analizi mükemmel.",
  },
  openai: {
    name: "OpenAI",
    icon: "🧠",
    models: [
      { value: "gpt-4o", label: "GPT-4o (Önerilen)" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini (Daha ucuz)" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (En ucuz)" },
    ],
    apiKeyName: "openaiApiKey",
    apiKeyLabel: "OpenAI API Key",
    apiKeyPlaceholder: "sk-...",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    description: "Güçlü modeller. Token bazlı ücretlendirme.",
  },
  groq: {
    name: "Groq",
    icon: "⚡",
    models: [
      { value: "llama-3.1-70b-versatile", label: "Llama 3.1 70B Versatile (Önerilen)" },
      { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
      { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    ],
    apiKeyName: "groqApiKey",
    apiKeyLabel: "Groq API Key",
    apiKeyPlaceholder: "gsk_...",
    apiKeyUrl: "https://console.groq.com",
    description: "Çok hızlı. Ücretsiz tier: Günde 14,400 istek. Not: Vision desteği sınırlı, görsel analiz için Gemini veya OpenAI önerilir.",
  },
  together: {
    name: "Together AI",
    icon: "🌟",
    models: [
      { value: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo", label: "Llama 3.2 11B Vision" },
    ],
    apiKeyName: "togetherApiKey",
    apiKeyLabel: "Together AI API Key",
    apiKeyPlaceholder: "...",
    apiKeyUrl: "https://api.together.xyz",
    description: "$25 başlangıç kredisi. İyi görsel modeller.",
  },
};

export default function AIYonetimiPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userData, loading: userDataLoading } = useUserData();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AISettings>({
    provider: "gemini",
    model: "gemini-2.0-flash-001",
    maxTokens: 4000,
    temperature: 0.3,
  });
  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({});
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
      fetchSettings();
    }
  }, [user, userData]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const settingsRef = doc(db, "siteSettings", "main");
      const snapshot = await getDoc(settingsRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.aiSettings) {
          setSettings(data.aiSettings as AISettings);
        }
      }
    } catch (error) {      showToast("AI ayarları yüklenirken bir hata oluştu.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.provider || !settings.model) {
      showToast("Lütfen provider ve model seçin.", "error");
      return;
    }

    // Seçilen provider için API key kontrolü (zorunlu)
    const providerInfo = AI_PROVIDERS[settings.provider as keyof typeof AI_PROVIDERS];
    const apiKeyField = providerInfo.apiKeyName as keyof AISettings;
    
    if (!settings[apiKeyField] || (settings[apiKeyField] as string).trim() === "") {
      showToast(`Lütfen ${providerInfo.name} API key girin.`, "error");
      return;
    }

    // Fallback provider'lar için uyarı (zorunlu değil ama önerilir)
    const fallbackProviders = Object.entries(AI_PROVIDERS).filter(([key]) => key !== settings.provider);
    const missingFallbacks = fallbackProviders.filter(([key, provider]) => {
      const apiKeyField = provider.apiKeyName as keyof AISettings;
      return !settings[apiKeyField] || (settings[apiKeyField] as string).trim() === "";
    });

    if (missingFallbacks.length > 0) {
      const missingNames = missingFallbacks.map(([, provider]) => provider.name).join(", ");
      showToast(
        `Uyarı: Fallback API key'leri girilmedi (${missingNames}). Ana provider'ın limiti dolduğunda alternatif servisler kullanılamayacak.`,
        "info"
      );
    }

    try {
      setSaving(true);
      const settingsRef = doc(db, "siteSettings", "main");
      const currentSettings = await getDoc(settingsRef);
      
      const currentData = currentSettings.exists() ? currentSettings.data() : {};
      
      await setDoc(settingsRef, {
        ...currentData,
        aiSettings: settings,
      }, { merge: true });

      showToast("AI ayarları başarıyla kaydedildi!", "success");
    } catch (error) {      showToast("AI ayarları kaydedilirken bir hata oluştu.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (provider: keyof typeof AI_PROVIDERS) => {
    const providerInfo = AI_PROVIDERS[provider];
    setSettings({
      ...settings,
      provider,
      model: providerInfo.models[0].value,
    });
  };

  const toggleApiKeyVisibility = (key: string) => {
    setShowApiKey((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const maskApiKey = (key: string | undefined): string => {
    if (!key) return "";
    if (key.length <= 8) return "••••••••";
    return key.substring(0, 4) + "••••••••" + key.substring(key.length - 4);
  };

  if (authLoading || userDataLoading || !user || userData?.role !== "admin") {
    return (
      <div className="h-screen w-full flex justify-center items-center bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1]">
        <div className="text-gray-400">Yükleniyor...</div>
      </div>
    );
  }

  const currentProvider = AI_PROVIDERS[settings.provider as keyof typeof AI_PROVIDERS];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#f3f4f8] to-[#e5e7f1] p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Yönetimi</h1>
          <p className="text-gray-600">Yapay zeka modeli ve API key ayarları</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Provider Selection */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">AI Provider Seçimi</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                  <button
                    key={key}
                    onClick={() => handleProviderChange(key as keyof typeof AI_PROVIDERS)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      settings.provider === key
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{provider.icon}</div>
                      <div className="flex-1 text-left">
                        <h3 className="font-bold text-gray-900 mb-1">{provider.name}</h3>
                        <p className="text-xs text-gray-600">{provider.description}</p>
                      </div>
                      {settings.provider === key && (
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selection */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Model Seçimi</h2>
              <select
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {currentProvider.models.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            {/* API Keys - Primary Provider */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Ana Provider API Key</h2>
              <p className="text-sm text-gray-600 mb-4">Seçili provider için API key (zorunlu)</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {currentProvider.apiKeyLabel}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey[currentProvider.apiKeyName] ? "text" : "password"}
                      value={settings[currentProvider.apiKeyName as keyof AISettings] as string || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          [currentProvider.apiKeyName]: e.target.value,
                        })
                      }
                      placeholder={currentProvider.apiKeyPlaceholder}
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility(currentProvider.apiKeyName)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showApiKey[currentProvider.apiKeyName] ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    API key almak için:{" "}
                    <a
                      href={currentProvider.apiKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      {currentProvider.apiKeyUrl}
                    </a>
                  </p>
                  {settings[currentProvider.apiKeyName as keyof AISettings] && (
                    <p className="text-xs text-gray-500 mt-1">
                      Mevcut key: {maskApiKey(settings[currentProvider.apiKeyName as keyof AISettings] as string)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Fallback API Keys */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-lg border border-amber-200 p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="text-2xl">🔄</div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Fallback API Keys</h2>
                  <p className="text-sm text-gray-600">
                    Ana provider'ın quota/rate limit hatası durumunda otomatik olarak kullanılacak alternatif API key'ler (isteğe bağlı ama önerilir)
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {Object.entries(AI_PROVIDERS)
                  .filter(([key]) => key !== settings.provider)
                  .map(([key, provider]) => {
                    const apiKeyField = provider.apiKeyName as keyof AISettings;
                    return (
                      <div key={key} className="bg-white/80 rounded-xl p-4 border border-amber-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{provider.icon}</span>
                          <label className="block text-sm font-medium text-gray-700">
                            {provider.apiKeyLabel}
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type={showApiKey[provider.apiKeyName] ? "text" : "password"}
                            value={settings[apiKeyField] as string || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                [apiKeyField]: e.target.value,
                              })
                            }
                            placeholder={provider.apiKeyPlaceholder}
                            className="w-full px-4 py-2 pr-10 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => toggleApiKeyVisibility(provider.apiKeyName)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showApiKey[provider.apiKeyName] ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          <a
                            href={provider.apiKeyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 underline"
                          >
                            API key al →
                          </a>
                        </p>
                        {settings[apiKeyField] && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Key mevcut: {maskApiKey(settings[apiKeyField] as string)}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-800">
                  <strong>💡 İpucu:</strong> Fallback API key'lerini girerseniz, ana provider'ın limiti dolduğunda sistem otomatik olarak alternatif provider'ları deneyecektir. Bu sayede kesintisiz hizmet sağlanır.
                </p>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Gelişmiş Ayarlar</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    value={settings.maxTokens || 4000}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxTokens: parseInt(e.target.value) || 4000,
                      })
                    }
                    min="100"
                    max="32000"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maksimum çıktı token sayısı</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.temperature || 0.3}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        temperature: parseFloat(e.target.value) || 0.3,
                      })
                    }
                    min="0"
                    max="2"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">0.0 (deterministik) - 2.0 (yaratıcı)</p>
                </div>
              </div>
            </div>

            {/* Current Settings Info */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg border border-blue-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Mevcut Ayarlar</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Ana Provider:</span>
                  <span className="text-gray-900">{currentProvider.name} {currentProvider.icon}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Model:</span>
                  <span className="text-gray-900">{settings.model}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Ana API Key:</span>
                  <span className="text-gray-900 font-mono text-xs">
                    {settings[currentProvider.apiKeyName as keyof AISettings]
                      ? `✓ ${maskApiKey(settings[currentProvider.apiKeyName as keyof AISettings] as string)}`
                      : "❌ Belirtilmemiş"}
                  </span>
                </div>
                <div className="pt-2 border-t border-blue-200">
                  <span className="font-semibold text-gray-700 block mb-2">Fallback API Keys:</span>
                  <div className="space-y-1 pl-2">
                    {Object.entries(AI_PROVIDERS)
                      .filter(([key]) => key !== settings.provider)
                      .map(([key, provider]) => {
                        const apiKeyField = provider.apiKeyName as keyof AISettings;
                        const hasKey = settings[apiKeyField] && (settings[apiKeyField] as string).trim() !== "";
                        return (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-600">{provider.icon} {provider.name}:</span>
                            <span className={hasKey ? "text-green-600 font-mono" : "text-gray-400"}>
                              {hasKey
                                ? `✓ ${maskApiKey(settings[apiKeyField] as string)}`
                                : "❌ Belirtilmemiş"}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
              </button>
            </div>
          </div>
        )}
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}

