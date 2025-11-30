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
    console.error("❌ GEMINI_API_KEY bulunamadı veya boş!");
    throw new Error("GEMINI_API_KEY_NOT_FOUND");
  }
  
  // API key'in ilk birkaç karakterini logla (güvenlik için tamamını değil)
  console.log("✅ GEMINI_API_KEY okundu, başlangıç:", apiKey.substring(0, 10) + "...");

  try {
    // Görseli base64'e çevir
    console.log("🖼️ Görsel yükleniyor:", imageUrl.substring(0, 100) + "...");
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      console.error("❌ Görsel yükleme hatası:", imageResponse.status, imageResponse.statusText);
      throw new Error(`Görsel yüklenemedi: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    console.log("✅ Görsel base64'e çevrildi, boyut:", imageBase64.length, "karakter");
    
    // MIME type'ı belirle
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png") ? "image/png" : 
                     contentType.includes("webp") ? "image/webp" : 
                     "image/jpeg";

    // API key'i logla (güvenlik için sadece başlangıcı)
    console.log("🔑 API Key kullanılıyor, başlangıç:", apiKey.substring(0, 10) + "...", "uzunluk:", apiKey.length);
    console.log("📝 Ders:", ders);
    
      // Gemini API endpoint - v1 API ve gemini-2.0-flash-001 modeli kullanıyoruz (thinking modu yok)
      const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`;
    console.log("🌐 API URL (key gizli):", apiUrl.replace(apiKey, "***"));
    console.log("📤 Gemini API'ye istek gönderiliyor...");
    
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
      
      console.error("❌ Gemini API Hatası:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      // Rate limit hatası kontrolü
      if (response.status === 429) {
        console.warn("Gemini API rate limit aşıldı");
        throw new Error("RATE_LIMIT_EXCEEDED");
      }
      
      // API key hatası kontrolü
      if (response.status === 400 || response.status === 401) {
        const errorMsg = errorData.error?.message || errorData.message || errorText || "";
        console.error("❌ API Key Hatası Detayları:", {
          status: response.status,
          statusText: response.statusText,
          errorMessage: errorMsg,
          fullError: errorData,
          errorText: errorText.substring(0, 500) // İlk 500 karakter
        });
        
        // 401 hatası her zaman API key problemi
        if (response.status === 401) {
          console.error("❌ 401 Unauthorized - API Key geçersiz veya yetkisiz!");
          console.error("🔍 Kontrol edin:");
          console.error("   1. API key'in Google AI Studio'da aktif olduğundan emin olun");
          console.error("   2. Gemini API'nin Google Cloud Console'da etkin olduğundan emin olun");
          console.error("   3. API key'in doğru kopyalandığından emin olun (boşluk, tırnak yok)");
          console.error("   4. Server'ın yeniden başlatıldığından emin olun");
          throw new Error("INVALID_API_KEY");
        }
        
        if (errorMsg.toLowerCase().includes("api key") || 
            errorMsg.toLowerCase().includes("invalid") ||
            errorMsg.toLowerCase().includes("unauthorized") ||
            errorMsg.toLowerCase().includes("permission")) {
          console.error("❌ API Key geçersiz veya yetkisiz!");
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
    console.log("✅ Gemini API yanıtı alındı:", {
      hasCandidates: !!data.candidates,
      candidatesLength: data.candidates?.length || 0
    });
    
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Finish reason kontrolü
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      console.warn("⚠️ Token limiti aşıldı, yanıt kesilmiş olabilir");
      // MAX_TOKENS durumunda bile kısmi yanıt olabilir, kontrol et
      if (!content || content.trim() === "") {
        console.error("❌ Gemini API'den boş yanıt alındı (MAX_TOKENS):", data);
        throw new Error("Gemini API token limiti aşıldı. Lütfen daha kısa bir soru deneyin veya tekrar deneyin.");
      }
    }
    
    if (!content || content.trim() === "") {
      console.error("❌ Gemini API'den boş yanıt alındı:", data);
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
        console.log("✅ JSON bloğu bulundu ve çıkarıldı");
      } else {
        // JSON bloğu yoksa, ilk { karakterinden itibaren al
        const jsonStart = content.indexOf("{");
        if (jsonStart !== -1) {
          content = content.substring(jsonStart);
          console.log("✅ JSON başlangıcı bulundu, metin kısmı atlandı");
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
    
    console.log("📝 Temizlenmiş içerik (ilk 200 karakter):", content.substring(0, 200));
    
    try {
      // JSON parse dene
      let solution;
      try {
        solution = JSON.parse(content);
      } catch (parseError: any) {
        // JSON parse başarısız, içeriği düzeltmeyi dene
        console.warn("⚠️ İlk JSON parse başarısız, içerik düzeltiliyor...");
        
        // Önce JSON bloğunu bul (```json ... ``` veya { ... })
        let fixedContent = content;
        
        // Eğer hala JSON ile başlamıyorsa, JSON kısmını bul
        if (!fixedContent.trim().startsWith("{")) {
          // İlk { karakterinden itibaren al
          const jsonStart = fixedContent.indexOf("{");
          if (jsonStart !== -1) {
            fixedContent = fixedContent.substring(jsonStart);
            console.log("✅ JSON başlangıcı bulundu (parse hatası sonrası)");
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
          console.log("✅ Düzeltilmiş JSON parse başarılı");
        } catch (secondError) {
          // Hala başarısız, içeriği direkt kullan
          console.error("❌ Düzeltilmiş JSON da parse edilemedi, içerik direkt kullanılıyor");
          throw parseError; // İlk hatayı fırlat, fallback mekanizması devreye girsin
        }
      }
      
      // Steps kontrolü - eğer steps yoksa veya array değilse, oluştur
      if (!solution.steps || !Array.isArray(solution.steps)) {
        console.warn("⚠️ Steps array bulunamadı veya geçersiz, oluşturuluyor...");
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
      
      console.log("✅ Çözüm başarıyla parse edildi, adım sayısı:", solution.steps.length);
      
      return {
        steps: solution.steps.map((step: any, index: number) => ({
          step: step.step || index + 1,
          explanation: step.explanation || step.content || "Açıklama bulunamadı",
          calculation: step.calculation || undefined,
        })),
        finalAnswer: solution.finalAnswer || solution.answer || solution.result || "Cevap bulunamadı",
      };
    } catch (parseError: any) {
      console.error("❌ JSON parse hatası:", {
        error: parseError.message,
        content: content.substring(0, 500) // İlk 500 karakter
      });
      
      // JSON parse başarısız olursa, içeriği direkt kullan
      console.warn("⚠️ JSON parse başarısız, içerik direkt kullanılıyor...");
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
    console.error("❌ Gemini API çağrı hatası:", {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5)
    });
    
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
      console.error("❌ POST Handler: GEMINI_API_KEY bulunamadı!");
      throw new Error("GEMINI_API_KEY_NOT_FOUND");
    }
    
    console.log("✅ POST Handler: GEMINI_API_KEY mevcut, uzunluk:", apiKeyCheck.length);
    
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
    console.error("Soru çözme hatası:", error);
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
    
    // Quota hatası için özel mesaj
    if (errorMessage === "QUOTA_EXCEEDED" || errorMessage.toLowerCase().includes("quota")) {
      return NextResponse.json(
        { 
          error: "Gemini API günlük kullanım limiti doldu. Lütfen ertesi gün tekrar deneyin veya Google AI Studio'dan limitlerinizi kontrol edin. (Günde 60 istek limiti)",
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
    console.error("❌ Beklenmeyen hata:", error);
    return NextResponse.json(
      { 
        error: errorMessage,
        code: "UNKNOWN_ERROR"
      },
      { status: 500 }
    );
  }
}

