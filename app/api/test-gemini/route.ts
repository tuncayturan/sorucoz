import { NextRequest, NextResponse } from "next/server";

/**
 * Gemini API Test Endpoint
 * Bu endpoint API key'in çalışıp çalışmadığını test eder
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        { 
          error: "GEMINI_API_KEY bulunamadı",
          apiKeyExists: false,
          apiKeyLength: 0
        },
        { status: 500 }
      );
    }

    // API key bilgileri (güvenlik için sadece başlangıcı)
    const apiKeyStart = apiKey.substring(0, 10);
    const apiKeyLength = apiKey.length;

    // Basit bir test isteği - v1 API ve gemini-2.5-flash modeli kullanıyoruz
    const testUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    console.log("🧪 Gemini API test ediliyor...");
    console.log("🔑 API Key başlangıç:", apiKeyStart + "...");
    console.log("📏 API Key uzunluk:", apiKeyLength);

    const response = await fetch(testUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Merhaba, bu bir test mesajıdır. Lütfen 'Test başarılı' yanıtını verin."
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 50,
        },
      }),
    });

    const responseStatus = response.status;
    const responseStatusText = response.statusText;

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error("❌ Gemini API Test Hatası:", {
        status: responseStatus,
        statusText: responseStatusText,
        error: errorData
      });

      return NextResponse.json({
        success: false,
        apiKeyExists: true,
        apiKeyLength: apiKeyLength,
        apiKeyStart: apiKeyStart + "...",
        status: responseStatus,
        statusText: responseStatusText,
        error: errorData,
        message: "API key mevcut ama Gemini API'ye erişim başarısız"
      }, { status: responseStatus });
    }

    const data = await response.json();
    console.log("✅ Gemini API Test Başarılı:", {
      hasCandidates: !!data.candidates,
      candidatesLength: data.candidates?.length || 0
    });

    return NextResponse.json({
      success: true,
      apiKeyExists: true,
      apiKeyLength: apiKeyLength,
      apiKeyStart: apiKeyStart + "...",
      status: responseStatus,
      statusText: responseStatusText,
      response: {
        hasCandidates: !!data.candidates,
        candidatesLength: data.candidates?.length || 0,
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı"
      },
      message: "API key çalışıyor!"
    });
  } catch (error: any) {
    console.error("❌ Test endpoint hatası:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Test sırasında bir hata oluştu",
        message: "Test endpoint'inde hata oluştu"
      },
      { status: 500 }
    );
  }
}

