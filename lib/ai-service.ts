import { getAISettings, getAPIKey, type AISettings } from "./ai-config";

/**
 * Ders tespiti için AI servisi
 */
export async function detectSubject(imageUrl: string): Promise<string | null> {
  const settings = await getAISettings();
  if (!settings) return null;

  const apiKey = getAPIKey(settings);
  if (!apiKey) {
    console.warn("API key bulunamadı");
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
 * Soru çözme için AI servisi
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

  const apiKey = getAPIKey(settings);
  if (!apiKey) {
    throw new Error("API key bulunamadı");
  }

  switch (settings.provider) {
    case "gemini":
      return await solveQuestionWithGemini(imageUrl, ders, apiKey, settings);
    case "openai":
      return await solveQuestionWithOpenAI(imageUrl, ders, apiKey, settings);
    case "groq":
      return await solveQuestionWithGroq(imageUrl, ders, apiKey, settings);
    case "together":
      return await solveQuestionWithTogether(imageUrl, ders, apiKey, settings);
    default:
      return await solveQuestionWithGemini(imageUrl, ders, apiKey, settings);
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

Dersler: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel, Fen Bilgisi, Sosyal Bilgiler

Sadece ders adını yaz, başka bir şey yazma.`;

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
            temperature: 0.3,
            maxOutputTokens: 50,
          },
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const subject = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    return subject;
  } catch (error) {
    console.error("Gemini ders tespiti hatası:", error);
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
      throw new Error(errorData.error?.message || "Gemini API hatası");
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
    console.error("Gemini soru çözme hatası:", error);
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

KPSS için genişletilmiş dersler: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler

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
      console.error("OpenAI API hatası:", errorData);
      return null;
    }

    const data = await response.json();
    const subject = data.choices?.[0]?.message?.content?.trim() || null;
    return subject;
  } catch (error) {
    console.error("OpenAI ders tespiti hatası:", error);
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
    console.error("OpenAI soru çözme hatası:", error);
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
    console.warn("⚠️ Groq vision desteği sınırlı. Görsel analizi için Gemini veya OpenAI önerilir.");
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error("Groq: Görsel yüklenemedi");
      return null;
    }

    // Groq'un vision modelleri yok, bu yüzden sadece text prompt ile deniyoruz
    // Bu çalışmayabilir, kullanıcıya bilgi veriyoruz
    const prompt = `Bu soru hangi derse ait? Sadece ders adını yaz.

KPSS için genişletilmiş dersler: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler

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
      console.error("Groq API hatası:", errorData);
      
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
    console.error("Groq ders tespiti hatası:", error);
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
    console.warn("⚠️ Groq vision desteği sınırlı. Görsel analizi için Gemini veya OpenAI önerilir.");
    
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
    console.error("Groq soru çözme hatası:", error);
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

KPSS için genişletilmiş dersler: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler

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
      console.error("Together AI API hatası:", errorData);
      return null;
    }

    const data = await response.json();
    const subject = data.choices?.[0]?.message?.content?.trim() || null;
    return subject;
  } catch (error) {
    console.error("Together AI ders tespiti hatası:", error);
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
    console.error("Together AI soru çözme hatası:", error);
    throw error;
  }
}

