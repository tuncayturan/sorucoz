import { NextRequest, NextResponse } from "next/server";

/**
 * Gemini API'de mevcut modelleri listeler
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        { error: "GEMINI_API_KEY bulunamadı" },
        { status: 500 }
      );
    }

    // Farklı API versiyonlarını deneyelim
    const apiVersions = [
      { version: "v1", url: `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}` },
      { version: "v1beta", url: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}` },
    ];

    const results: any[] = [];

    for (const { version, url } of apiVersions) {
      try {        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            version,
            success: true,
            models: data.models || [],
            modelNames: (data.models || []).map((m: any) => m.name).filter((name: string) => 
              name && name.includes("gemini")
            ),
          });
        } else {
          const errorText = await response.text();
          results.push({
            version,
            success: false,
            status: response.status,
            error: errorText,
          });
        }
      } catch (error: any) {
        results.push({
          version,
          success: false,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      recommendedModel: results
        .find(r => r.success && r.modelNames && r.modelNames.length > 0)
        ?.modelNames?.[0] || "Model bulunamadı",
    });
  } catch (error: any) {    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Model listesi alınamadı"
      },
      { status: 500 }
    );
  }
}

