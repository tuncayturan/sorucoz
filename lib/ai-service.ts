import { getAISettings, getAPIKey, type AISettings } from "./ai-config";

/**
 * Ders tespiti için AI servisi
 */
export async function detectSubject(imageUrl: string): Promise<string | null> {
  const settings = await getAISettings();
  if (!settings) return null;

  const apiKey = getAPIKey(settings);
  if (!apiKey) {
    return null;
  }

  switch (settings.provider) {
    case "gemini":
      return await detectSubjectWithGemini(imageUrl, apiKey, settings.model);
    case "openai":
      return await detectSubjectWithOpenAI(imageUrl, apiKey, settings.model);
    case "groq":
      return await detectSubjectWithGroq(imageUrl, apiKey, settings.model);
    case "together":
      return await detectSubjectWithTogether(imageUrl, apiKey, settings.model);
    default:
      return await detectSubjectWithGemini(imageUrl, apiKey, "gemini-2.0-flash-001");
  }
}

/**
 * Soru çözme için AI servisi (fallback mekanizması ile)
 */
export async function solveQuestion(
  imageUrl: string,
  ders: string
): Promise<{
  steps: Array<{ step: number; explanation: string; calculation?: string }>;
  finalAnswer: string;
} | null> {
  const settings = await getAISettings();
  if (!settings) return null;

  const primaryApiKey = getAPIKey(settings);
  if (!primaryApiKey) {
    throw new Error("API key bulunamadı");
  }

  // İlk provider'ı dene
  let lastError: Error | null = null;
  
  try {
    switch (settings.provider) {
      case "gemini":
        return await solveQuestionWithGemini(imageUrl, ders, primaryApiKey, settings);
      case "openai":
        return await solveQuestionWithOpenAI(imageUrl, ders, primaryApiKey, settings);
      case "groq":
        return await solveQuestionWithGroq(imageUrl, ders, primaryApiKey, settings);
      case "together":
        return await solveQuestionWithTogether(imageUrl, ders, primaryApiKey, settings);
      default:
        return await solveQuestionWithGemini(imageUrl, ders, primaryApiKey, settings);
    }
  } catch (error: any) {
    lastError = error;
    const errorMessage = error.message || "";
    
    // 429 (quota/rate limit) hatası durumunda fallback yap
    if (errorMessage.includes("429") || 
        errorMessage.includes("QUOTA_EXCEEDED") || 
        errorMessage.includes("RATE_LIMIT_EXCEEDED") ||
        errorMessage.toLowerCase().includes("resource exhausted") ||
        errorMessage.toLowerCase().includes("quota")) {
      // Fallback provider'ları sırayla dene
      const fallbackProviders = [
        { 
          name: "openai", 
          func: solveQuestionWithOpenAI,
          defaultModel: "gpt-4o-mini"
        },
        { 
          name: "groq", 
          func: solveQuestionWithGroq,
          defaultModel: "llama-3.1-70b-versatile"
        },
        { 
          name: "together", 
          func: solveQuestionWithTogether,
          defaultModel: "meta-llama/Llama-3-70b-chat-hf"
        },
      ];
      
      // Primary provider'ı fallback listesinden çıkar
      const filteredFallbacks = fallbackProviders.filter(
        p => p.name !== settings.provider
      );
      
      for (const fallback of filteredFallbacks) {
        try {
          // Fallback provider için settings oluştur
          const fallbackSettings: AISettings = { 
            ...settings, 
            provider: fallback.name as any,
            model: settings.model || fallback.defaultModel
          };
          
          // Fallback provider için API key al
          const fallbackApiKey = getAPIKey(fallbackSettings);
          
          if (!fallbackApiKey || fallbackApiKey.trim() === "") {
            continue;
          }
          
          const result = await fallback.func(imageUrl, ders, fallbackApiKey, fallbackSettings);
          
          if (result) {
            return result;
          }
        } catch (fallbackError: any) {
          const errorMsg = fallbackError.message || "";
          lastError = fallbackError;
          continue; // Sonraki fallback'i dene
        }
      }
      
      // Tüm fallback'ler başarısız oldu
      throw new Error(
        `Tüm AI servisleri başarısız oldu. Son hata: ${lastError?.message || "Bilinmeyen hata"}. ` +
        `Lütfen birkaç dakika bekleyip tekrar deneyin veya API limitlerinizi kontrol edin.`
      );
    }
    
    // 429 hatası değilse, hatayı direkt fırlat
    throw error;
  }
}

// Gemini Implementation
async function detectSubjectWithGemini(
  imageUrl: string,
  apiKey: string,
  model: string
): Promise<string | null> {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return null;

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

    const prompt = `Bu soru hangi derse ait? Sadece ders adını yaz.

Dersler: Matematik, Geometri, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler, Sayısal Mantık, Sözel Mantık, Eğitim Bilimleri, Gelişim, Din Kültürü ve Ahlak Bilgisi, Okul Öncesi, Rehberlik, Sınıf Öğretmenliği, İngilizce, Almanca, İtalyanca, Arapça

ÖNEMLİ KURALLAR:
- Sayılar, rakamlar, denklemler, formüller, toplama, çıkarma, çarpma, bölme, işlem, hesaplama, problem çözme görüyorsan → "Matematik" yaz (Geometri spesifik terimleri yoksa)
- Açı, üçgen, dörtgen, çember, daire, alan, çevre, hacim, geometrik şekiller görüyorsan → "Geometri" yaz
- Spor, beden eğitimi, jimnastik, atletizm, futbol, basketbol, voleybol, fiziksel aktivite, egzersiz, antrenman, fitness, sağlık, kas, iskelet, motor, koordinasyon, denge, esneklik, dayanıklılık, kuvvet, hız, çeviklik görüyorsan → "Beden Eğitimi" yaz (ÖNEMLİ: Tarih ile karıştırma! Spor, beden, jimnastik, atletizm, futbol, basketbol, voleybol, egzersiz, antrenman, fitness, kas, iskelet, motor, koordinasyon görüyorsan MUTLAKA Beden Eğitimi'dir!)
- Osmanlı, göktürk, cumhuriyet, savaş, padişah, sultan, fetih görüyorsan → "Tarih" yaz (ÖNEMLİ: Beden Eğitimi ile karıştırma! Spor, beden, jimnastik varsa Beden Eğitimi'dir)
- Sadece ders adını yaz, başka bir şey yazma.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.05, // Daha deterministik sonuçlar için düşürüldü
            maxOutputTokens: 50,
          },
        }),
      }
    );

    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const subject = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    return subject;
  } catch (error) {
    return null;
  }
}

async function solveQuestionWithGemini(
  imageUrl: string,
  ders: string,
  apiKey: string,
  settings: AISettings
): Promise<{
  steps: Array<{ step: number; explanation: string; calculation?: string }>;
  finalAnswer: string;
} | null> {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Görsel yüklenemedi: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

    const prompt = `Sen bir ${ders} öğretmenisin. Verilen soruyu adım adım, detaylı bir şekilde çözmelisin. 
Her adımı numaralandır ve açık bir şekilde açıkla. Matematiksel işlemler varsa göster.
Türkçe olarak, öğrencinin anlayabileceği şekilde açıkla.

JSON formatında döndür:
{
  "steps": [
    {"step": 1, "explanation": "İlk adım açıklaması", "calculation": "varsa hesaplama"},
    {"step": 2, "explanation": "İkinci adım açıklaması", "calculation": "varsa hesaplama"}
  ],
  "finalAnswer": "Final cevap"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${settings.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: settings.temperature || 0.3,
            maxOutputTokens: settings.maxTokens || 4000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || "Gemini API hatası";
      
      // 429 (quota/rate limit) hatası kontrolü
      if (response.status === 429 || 
          errorMessage.toLowerCase().includes("resource exhausted") ||
          errorMessage.toLowerCase().includes("quota") ||
          errorMessage.toLowerCase().includes("rate limit")) {
        throw new Error(`QUOTA_EXCEEDED: ${errorMessage}`);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // JSON parse
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON formatı bulunamadı");
    }

    const solution = JSON.parse(jsonMatch[0]);
    return {
      steps: solution.steps || [],
      finalAnswer: solution.finalAnswer || "",
    };
  } catch (error) {
    throw error;
  }
}

// OpenAI Implementation
async function detectSubjectWithOpenAI(
  imageUrl: string,
  apiKey: string,
  model: string
): Promise<string | null> {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return null;

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

    const prompt = `Bu soru hangi derse ait? Sadece ders adını yaz.

KPSS için genişletilmiş dersler: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler, Sayısal Mantık, Sözel Mantık

Sadece ders adını yaz, başka bir şey yazma.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return null;
    }

    const data = await response.json();
    const subject = data.choices?.[0]?.message?.content?.trim() || null;
    return subject;
  } catch (error) {
    return null;
  }
}

async function solveQuestionWithOpenAI(
  imageUrl: string,
  ders: string,
  apiKey: string,
  settings: AISettings
): Promise<{
  steps: Array<{ step: number; explanation: string; calculation?: string }>;
  finalAnswer: string;
} | null> {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Görsel yüklenemedi: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

    // JSON mode için özel prompt (GPT-4o ve GPT-4o-mini destekler)
    const supportsJsonMode = settings.model?.includes("gpt-4o") || settings.model?.includes("gpt-4-turbo");
    
    const prompt = supportsJsonMode
      ? `Sen bir ${ders} öğretmenisin. Verilen soruyu adım adım, detaylı bir şekilde çözmelisin. 
Her adımı numaralandır ve açık bir şekilde açıkla. Matematiksel işlemler varsa göster.
Türkçe olarak, öğrencinin anlayabileceği şekilde açıkla.

Sadece JSON formatında döndür, başka bir şey yazma:
{
  "steps": [
    {"step": 1, "explanation": "İlk adım açıklaması", "calculation": "varsa hesaplama"},
    {"step": 2, "explanation": "İkinci adım açıklaması", "calculation": "varsa hesaplama"}
  ],
  "finalAnswer": "Final cevap"
}`
      : `Sen bir ${ders} öğretmenisin. Verilen soruyu adım adım, detaylı bir şekilde çözmelisin. 
Her adımı numaralandır ve açık bir şekilde açıkla. Matematiksel işlemler varsa göster.
Türkçe olarak, öğrencinin anlayabileceği şekilde açıkla.

JSON formatında döndür:
{
  "steps": [
    {"step": 1, "explanation": "İlk adım açıklaması", "calculation": "varsa hesaplama"},
    {"step": 2, "explanation": "İkinci adım açıklaması", "calculation": "varsa hesaplama"}
  ],
  "finalAnswer": "Final cevap"
}`;

    const requestBody: any = {
      model: settings.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: settings.maxTokens || 4000,
      temperature: settings.temperature || 0.3,
    };

    // JSON mode sadece destekleyen modeller için
    if (supportsJsonMode) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "OpenAI API hatası");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // JSON parse - eğer JSON mode kullanılmadıysa, JSON'u extract et
    let solution;
    if (supportsJsonMode) {
      solution = JSON.parse(content);
    } else {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("JSON formatı bulunamadı");
      }
      solution = JSON.parse(jsonMatch[0]);
    }

    return {
      steps: solution.steps || [],
      finalAnswer: solution.finalAnswer || "",
    };
  } catch (error) {
    throw error;
  }
}

// Groq Implementation
// NOT: Groq'un mevcut modelleri vision desteği sağlamıyor veya sınırlı
// Vision için Gemini veya OpenAI kullanılması önerilir
async function detectSubjectWithGroq(
  imageUrl: string,
  apiKey: string,
  model: string
): Promise<string | null> {
  try {
    // Groq'un vision desteği sınırlı, bu yüzden görseli base64'e çevirip text olarak göndermeye çalışıyoruz
    // Ancak bu yaklaşım çalışmayabilir çünkü Groq modelleri vision desteklemiyor olabilir
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {      return null;
    }

    // Groq'un vision modelleri yok, bu yüzden sadece text prompt ile deniyoruz
    // Bu çalışmayabilir, kullanıcıya bilgi veriyoruz
    const prompt = `Bu soru hangi derse ait? Sadece ders adını yaz.

KPSS için genişletilmiş dersler: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler, Sayısal Mantık, Sözel Mantık

Sadece ders adını yaz, başka bir şey yazma.

NOT: Groq modelleri vision desteği sağlamıyor. Görsel analizi için Gemini veya OpenAI kullanın.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Model decommissioned hatası
      if (errorData.error?.message?.includes("decommissioned") || 
          errorData.error?.message?.includes("no longer supported")) {
        throw new Error(`Groq model '${model}' kullanımdan kaldırılmış. Lütfen AI Yönetimi sayfasından güncel bir model seçin.`);
      }
      
      return null;
    }

    const data = await response.json();
    const subject = data.choices?.[0]?.message?.content?.trim() || null;
    return subject;
  } catch (error: any) {
    if (error.message?.includes("decommissioned") || error.message?.includes("kullanımdan kaldırılmış")) {
      throw error; // Bu hatayı yukarı fırlat ki kullanıcı görsün
    }
    return null;
  }
}

async function solveQuestionWithGroq(
  imageUrl: string,
  ders: string,
  apiKey: string,
  settings: AISettings
): Promise<{
  steps: Array<{ step: number; explanation: string; calculation?: string }>;
  finalAnswer: string;
} | null> {
  try {
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Görsel yüklenemedi: ${imageResponse.status}`);
    }

    // Groq'un vision modelleri yok veya sınırlı, bu yüzden görseli base64'e çevirip text olarak göndermeye çalışıyoruz
    // Ancak bu yaklaşım çalışmayabilir
    const prompt = `Sen bir ${ders} öğretmenisin. Verilen soruyu adım adım, detaylı bir şekilde çözmelisin. 
Her adımı numaralandır ve açık bir şekilde açıkla. Matematiksel işlemler varsa göster.
Türkçe olarak, öğrencinin anlayabileceği şekilde açıkla.

Sadece JSON formatında döndür, başka bir şey yazma:
{
  "steps": [
    {"step": 1, "explanation": "İlk adım açıklaması", "calculation": "varsa hesaplama"},
    {"step": 2, "explanation": "İkinci adım açıklaması", "calculation": "varsa hesaplama"}
  ],
  "finalAnswer": "Final cevap"
}

NOT: Groq modelleri vision desteği sağlamıyor. Görsel analizi için Gemini veya OpenAI kullanın.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: settings.maxTokens || 4000,
        temperature: settings.temperature || 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || "Groq API hatası";
      
      // Model decommissioned hatası
      if (errorMessage.includes("decommissioned") || 
          errorMessage.includes("no longer supported")) {
        throw new Error(`Groq model '${settings.model}' kullanımdan kaldırılmış. Lütfen AI Yönetimi sayfasından güncel bir model seçin.`);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // JSON parse
    let solution;
    try {
      solution = JSON.parse(content);
    } catch (e) {
      // Eğer JSON parse başarısız olursa, JSON'u extract et
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("JSON formatı bulunamadı");
      }
      solution = JSON.parse(jsonMatch[0]);
    }

    return {
      steps: solution.steps || [],
      finalAnswer: solution.finalAnswer || "",
    };
  } catch (error: any) {
    if (error.message?.includes("decommissioned") || error.message?.includes("kullanımdan kaldırılmış")) {
      throw error; // Bu hatayı yukarı fırlat ki kullanıcı görsün
    }
    throw error;
  }
}

// Together AI Implementation
async function detectSubjectWithTogether(
  imageUrl: string,
  apiKey: string,
  model: string
): Promise<string | null> {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) return null;

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

    const prompt = `Bu soru hangi derse ait? Sadece ders adını yaz.

KPSS için genişletilmiş dersler: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler, Sayısal Mantık, Sözel Mantık

Sadece ders adını yaz, başka bir şey yazma.`;

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return null;
    }

    const data = await response.json();
    const subject = data.choices?.[0]?.message?.content?.trim() || null;
    return subject;
  } catch (error) {
    return null;
  }
}

async function solveQuestionWithTogether(
  imageUrl: string,
  ders: string,
  apiKey: string,
  settings: AISettings
): Promise<{
  steps: Array<{ step: number; explanation: string; calculation?: string }>;
  finalAnswer: string;
} | null> {
  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Görsel yüklenemedi: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

    const prompt = `Sen bir ${ders} öğretmenisin. Verilen soruyu adım adım, detaylı bir şekilde çözmelisin. 
Her adımı numaralandır ve açık bir şekilde açıkla. Matematiksel işlemler varsa göster.
Türkçe olarak, öğrencinin anlayabileceği şekilde açıkla.

Sadece JSON formatında döndür, başka bir şey yazma:
{
  "steps": [
    {"step": 1, "explanation": "İlk adım açıklaması", "calculation": "varsa hesaplama"},
    {"step": 2, "explanation": "İkinci adım açıklaması", "calculation": "varsa hesaplama"}
  ],
  "finalAnswer": "Final cevap"
}`;

    const response = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: settings.maxTokens || 4000,
        temperature: settings.temperature || 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "Together AI API hatası");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // JSON parse
    let solution;
    try {
      solution = JSON.parse(content);
    } catch (e) {
      // Eğer JSON parse başarısız olursa, JSON'u extract et
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("JSON formatı bulunamadı");
      }
      solution = JSON.parse(jsonMatch[0]);
    }

    return {
      steps: solution.steps || [],
      finalAnswer: solution.finalAnswer || "",
    };
  } catch (error) {
    throw error;
  }
}

