import { NextRequest, NextResponse } from "next/server";

/**
 * Google Gemini API kullanarak soruyu adım adım çözer
 * Ücretsiz tier: Günde 60 istek
 */
async function solveQuestionWithGemini(imageUrl: string, ders: string): Promise<{
  steps: Array<{ step: number; explanation: string; calculation?: string }>;
  finalAnswer: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY bulunamadı");
  }

  try {
    // Görseli base64'e çevir
    const imageBase64 = await fetch(imageUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => Buffer.from(buffer).toString("base64"));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
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
                    mime_type: "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      let errorMessage = "Soruyu çözerken hata oluştu";
      try {
        const error = await response.json();
        errorMessage = error.error?.message || errorMessage;
        
        // Quota hatası kontrolü
        if (errorMessage.toLowerCase().includes("quota") || 
            error.error?.code === 429) {
          throw new Error("QUOTA_EXCEEDED");
        }
      } catch (e: any) {
        if (e.message === "QUOTA_EXCEEDED") {
          throw e;
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    try {
      const solution = JSON.parse(content);
      
      // Steps array kontrolü
      if (!Array.isArray(solution.steps)) {
        throw new Error("Steps array formatı hatalı");
      }
      
      return {
        steps: solution.steps.map((step: any, index: number) => ({
          step: step.step || index + 1,
          explanation: step.explanation || "Açıklama bulunamadı",
          calculation: step.calculation || undefined,
        })),
        finalAnswer: solution.finalAnswer || "Cevap bulunamadı",
      };
    } catch (parseError) {
      // JSON parse hatası durumunda fallback
      const lines = content.split('\n').filter((line: string) => line.trim());
      return {
        steps: lines.map((line: string, index: number) => ({
          step: index + 1,
          explanation: line.trim(),
        })),
        finalAnswer: lines[lines.length - 1] || "Cevap analiz ediliyor...",
      };
    }
  } catch (error: any) {
    throw error;
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

    // Gemini API ile soruyu çöz
    const solution = await solveQuestionWithGemini(imageUrl, ders);

    return NextResponse.json(solution);
  } catch (error: any) {    const errorMessage = error.message || "Soruyu çözerken bir hata oluştu";
    
    // Gemini API key yoksa
    if (errorMessage.includes("GEMINI_API_KEY")) {
      return NextResponse.json(
        { error: "Gemini API anahtarı yapılandırılmamış. Lütfen .env.local dosyasına GEMINI_API_KEY ekleyin." },
        { status: 500 }
      );
    }
    
    // Quota hatası için özel mesaj
    if (errorMessage === "QUOTA_EXCEEDED" || errorMessage.toLowerCase().includes("quota")) {
      return NextResponse.json(
        { 
          error: "Gemini API kotası dolmuş. Lütfen Google AI Studio'dan kullanım limitlerinizi kontrol edin.",
          code: "QUOTA_EXCEEDED"
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

