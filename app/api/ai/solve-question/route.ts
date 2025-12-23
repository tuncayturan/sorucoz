import { NextRequest, NextResponse } from "next/server";
import { solveQuestion } from "@/lib/ai-service";

/**
 * AI servisi kullanarak soruyu adım adım çözer
 * Firestore'daki AI ayarlarına göre provider seçilir
 */
async function solveQuestionWithAI(imageUrl: string, ders: string): Promise<{
  steps: Array<{ step: number; explanation: string; calculation?: string }>;
  finalAnswer: string;
} | null> {
  // AI servisi kullan (Firestore ayarlarına göre)
  return await solveQuestion(imageUrl, ders);
}

/**
 * @deprecated Bu fonksiyon artık kullanılmıyor, solveQuestionWithAI kullanın
 * Eski Gemini implementasyonu (geriye dönük uyumluluk için)
 */
async function solveQuestionWithGemini(imageUrl: string, ders: string): Promise<{
  steps: Array<{ step: number; explanation: string; calculation?: string }>;
  finalAnswer: string;
} | null> {
  // Yeni AI servisini kullan
  return await solveQuestion(imageUrl, ders);
}

/**
 * @deprecated Eski implementasyon - sadece geriye dönük uyumluluk için
 */
async function solveQuestionWithGeminiOld(imageUrl: string, ders: string): Promise<{
  steps: Array<{ step: number; explanation: string; calculation?: string }>;
  finalAnswer: string;
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY_NOT_FOUND");
  }
  
  // API key'in ilk birkaç karakterini logla (güvenlik için tamamını değil)
  try {
    // Görseli base64'e çevir
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Görsel yüklenemedi: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    // MIME type'ı belirle
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png") ? "image/png" : 
                     contentType.includes("webp") ? "image/webp" : 
                     "image/jpeg";

    // API key'i logla (güvenlik için sadece başlangıcı)
      // Gemini API endpoint - v1 API ve gemini-2.0-flash-001 modeli kullanıyoruz (thinking modu yok)
      const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Sen bir ${ders} öğretmenisin. Verilen soruyu adım adım, detaylı bir şekilde çözmelisin. 
                  Her adımı numaralandır ve açık bir şekilde açıkla. Matematiksel işlemler varsa göster.
                  Türkçe olarak, öğrencinin anlayabileceği şekilde açıkla.
                  
                  JSON formatında döndür:
                  {
                    "steps": [
                      {"step": 1, "explanation": "İlk adım açıklaması", "calculation": "varsa hesaplama"},
                      {"step": 2, "explanation": "İkinci adım açıklaması", "calculation": "varsa hesaplama"}
                    ],
                    "finalAnswer": "Final cevap"
                  }`,
                },
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
              maxOutputTokens: 4000, // Thinking modu olmadığı için daha fazla token kullanabiliriz
              // responseMimeType v1 API'de desteklenmiyor, kaldırıldı
            },
        }),
      }
    );

    if (!response.ok) {
      // Detaylı hata loglama
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      // Rate limit hatası kontrolü
      if (response.status === 429) {
        throw new Error("RATE_LIMIT_EXCEEDED");
      }
      
      // API key hatası kontrolü
      if (response.status === 400 || response.status === 401) {
        const errorMsg = errorData.error?.message || errorData.message || errorText || "";
        // 401 hatası her zaman API key problemi
        if (response.status === 401) {
          throw new Error("INVALID_API_KEY");
        }
        
        if (errorMsg.toLowerCase().includes("api key") || 
            errorMsg.toLowerCase().includes("invalid") ||
            errorMsg.toLowerCase().includes("unauthorized") ||
            errorMsg.toLowerCase().includes("permission")) {
          throw new Error("INVALID_API_KEY");
        }
      }
      
      // Quota hatası kontrolü
      const errorMessage = errorData.error?.message || errorData.message || "";
      if (errorMessage.toLowerCase().includes("quota") || 
          errorMessage.toLowerCase().includes("exceeded")) {
        throw new Error("QUOTA_EXCEEDED");
      }
      
      // Genel hata
      throw new Error(`Gemini API hatası: ${response.status} - ${errorMessage || response.statusText}`);
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Finish reason kontrolü
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      // MAX_TOKENS durumunda bile kısmi yanıt olabilir, kontrol et
      if (!content || content.trim() === "") {
        throw new Error("Gemini API token limiti aşıldı. Lütfen daha kısa bir soru deneyin veya tekrar deneyin.");
      }
    }
    
    if (!content || content.trim() === "") {
      throw new Error("Gemini API'den boş yanıt alındı. Lütfen tekrar deneyin.");
    }
    
    // Markdown code block formatını temizle (```json ... ```)
    content = content.trim();
    
    // Eğer içerik JSON ile başlamıyorsa, JSON kısmını bul
    if (!content.startsWith("{")) {
      // ```json veya ``` ile başlayan JSON bloğunu bul
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        content = jsonMatch[1];
      } else {
        // JSON bloğu yoksa, ilk { karakterinden itibaren al
        const jsonStart = content.indexOf("{");
        if (jsonStart !== -1) {
          content = content.substring(jsonStart);
        }
      }
    }
    
    // Markdown code block formatını temizle
    if (content.startsWith("```json")) {
      content = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    } else if (content.startsWith("```")) {
      content = content.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    content = content.trim();
    
    
    try {
      // JSON parse dene
      let solution;
      try {
        solution = JSON.parse(content);
      } catch (parseError: any) {
        // JSON parse başarısız, içeriği düzeltmeyi dene
        // Önce JSON bloğunu bul (```json ... ``` veya { ... })
        let fixedContent = content;
        
        // Eğer hala JSON ile başlamıyorsa, JSON kısmını bul
        if (!fixedContent.trim().startsWith("{")) {
          // İlk { karakterinden itibaren al
          const jsonStart = fixedContent.indexOf("{");
          if (jsonStart !== -1) {
            fixedContent = fixedContent.substring(jsonStart);
          }
        }
        
        // JSON'da yaygın sorunları düzelt
        // Eksik kapanış parantezleri/braketleri bul ve düzelt
        const openBraces = (fixedContent.match(/\{/g) || []).length;
        const closeBraces = (fixedContent.match(/\}/g) || []).length;
        const openBrackets = (fixedContent.match(/\[/g) || []).length;
        const closeBrackets = (fixedContent.match(/\]/g) || []).length;
        
        // Eksik kapanışları ekle
        if (openBraces > closeBraces) {
          fixedContent += '\n' + '}'.repeat(openBraces - closeBraces);
        }
        if (openBrackets > closeBrackets) {
          fixedContent += '\n' + ']'.repeat(openBrackets - closeBrackets);
        }
        
        // Tekrar parse et
        try {
          solution = JSON.parse(fixedContent);
        } catch (secondError) {
          // Hala başarısız, içeriği direkt kullan
          throw parseError; // İlk hatayı fırlat, fallback mekanizması devreye girsin
        }
      }
      
      // Steps kontrolü - eğer steps yoksa veya array değilse, oluştur
      if (!solution.steps || !Array.isArray(solution.steps)) {
        // Eğer steps yoksa ama başka bir format varsa, onu kullan
        if (solution.step || solution.explanation) {
          solution.steps = [{
            step: solution.step || 1,
            explanation: solution.explanation || solution.content || "Açıklama bulunamadı",
            calculation: solution.calculation || undefined,
          }];
        } else {
          // Hiçbir şey yoksa, basit bir çözüm oluştur
          solution.steps = [{
            step: 1,
            explanation: content.substring(0, 500) || "Çözüm oluşturulamadı",
            calculation: undefined,
          }];
        }
      }
      return {
        steps: solution.steps.map((step: any, index: number) => ({
          step: step.step || index + 1,
          explanation: step.explanation || step.content || "Açıklama bulunamadı",
          calculation: step.calculation || undefined,
        })),
        finalAnswer: solution.finalAnswer || solution.answer || solution.result || "Cevap bulunamadı",
      };
    } catch (parseError: any) {
      // JSON parse başarısız olursa, içeriği direkt kullan
      return {
        steps: [{
          step: 1,
          explanation: content.substring(0, 1000) || "Çözüm oluşturulamadı",
          calculation: undefined,
        }],
        finalAnswer: "Çözüm oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.",
      };
    }
  } catch (error: any) {
    // Rate limit, quota, invalid API key veya parse hatası ise throw et
    if (error.message === "RATE_LIMIT_EXCEEDED" || 
        error.message === "QUOTA_EXCEEDED" ||
        error.message === "INVALID_API_KEY" ||
        error.message.includes("JSON parse") ||
        error.message.includes("boş yanıt") ||
        error.message.includes("formatı hatalı")) {
      throw error;
    }
    
    // Diğer hatalar için null döndür
    return null;
  }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, ders } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl gerekli" }, { status: 400 });
    }

    if (!ders) {
      return NextResponse.json({ error: "ders gerekli" }, { status: 400 });
    }

    // API key kontrolü (POST handler'da)
    const apiKeyCheck = process.env.GEMINI_API_KEY;
    if (!apiKeyCheck || apiKeyCheck.trim() === "") {
      throw new Error("GEMINI_API_KEY_NOT_FOUND");
    }
    // AI servisi ile soruyu çöz (Firestore ayarlarına göre)
    let solution;
    try {
      solution = await solveQuestionWithAI(imageUrl, ders);
    } catch (apiError: any) {
      // API'den gelen hataları direkt throw et
      throw apiError;
    }
    
    if (!solution) {
      throw new Error("Gemini API ile soru çözülemedi. API key mevcut ama yanıt alınamadı. Lütfen API key'in geçerli olduğundan emin olun.");
    }

    return NextResponse.json(solution);
  } catch (error: any) {
    const errorMessage = error.message || "Soruyu çözerken bir hata oluştu";
    
    // Gemini API key yoksa
    if (errorMessage.includes("GEMINI_API_KEY") || errorMessage === "GEMINI_API_KEY_NOT_FOUND") {
      return NextResponse.json(
        { 
          error: "Gemini API anahtarı yapılandırılmamış. Lütfen .env.local dosyasına GEMINI_API_KEY=your_api_key_here ekleyin ve development server'ı yeniden başlatın.",
          code: "API_KEY_NOT_FOUND"
        },
        { status: 500 }
      );
    }
    
    // Invalid API key hatası
    if (errorMessage === "INVALID_API_KEY" || errorMessage.toLowerCase().includes("invalid") || errorMessage.toLowerCase().includes("api key")) {
      return NextResponse.json(
        { 
          error: "Gemini API anahtarı geçersiz veya yetkisiz. Lütfen Google AI Studio'dan yeni bir API key oluşturun ve .env.local dosyasına ekleyin.",
          code: "INVALID_API_KEY"
        },
        { status: 401 }
      );
    }
    
    // Rate limit hatası
    if (errorMessage === "RATE_LIMIT_EXCEEDED") {
      return NextResponse.json(
        { 
          error: "Gemini API rate limit aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin. (Dakikada 15 istek limiti)",
          code: "RATE_LIMIT_EXCEEDED"
        },
        { status: 429 }
      );
    }
    
    // Quota hatası için özel mesaj (fallback mekanizması çalıştıysa farklı mesaj)
    if (errorMessage === "QUOTA_EXCEEDED" || 
        errorMessage.toLowerCase().includes("quota") ||
        errorMessage.toLowerCase().includes("resource exhausted") ||
        errorMessage.toLowerCase().includes("tüm ai servisleri başarısız")) {
      
      // Eğer tüm servisler başarısız olduysa
      if (errorMessage.toLowerCase().includes("tüm ai servisleri başarısız")) {
        return NextResponse.json(
          { 
            error: "Tüm AI servislerinin kullanım limitleri dolmuş. Lütfen birkaç dakika bekleyip tekrar deneyin veya API limitlerinizi kontrol edin.",
            code: "ALL_PROVIDERS_EXHAUSTED"
          },
          { status: 429 }
        );
      }
      
      // Sadece primary provider başarısız olduysa (fallback çalıştı ama başarısız)
      return NextResponse.json(
        { 
          error: "AI servis limiti aşıldı. Sistem otomatik olarak alternatif servisleri denedi ancak başarısız oldu. Lütfen birkaç dakika bekleyip tekrar deneyin.",
          code: "QUOTA_EXCEEDED"
        },
        { status: 429 }
      );
    }
    
    // JSON parse veya format hatası
    if (errorMessage.includes("JSON parse") || errorMessage.includes("formatı hatalı") || errorMessage.includes("boş yanıt")) {
      return NextResponse.json(
        { 
          error: "Gemini API'den geçersiz yanıt alındı. Lütfen tekrar deneyin.",
          code: "INVALID_RESPONSE",
          details: errorMessage
        },
        { status: 500 }
      );
    }
    
    // Genel hata
    return NextResponse.json(
      { 
        error: errorMessage,
        code: "UNKNOWN_ERROR"
      },
      { status: 500 }
    );
  }
}

