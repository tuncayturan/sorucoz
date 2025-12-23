import { NextRequest, NextResponse } from "next/server";

/**
 * Google Gemini API kullanarak görüntüden ders tespiti yapar
 * Ücretsiz tier: Günde 60 istek
 */
async function detectSubjectWithGemini(imageUrl: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn("GEMINI_API_KEY bulunamadı, basit tespit kullanılıyor");
    return "Bilinmeyen";
  }

  try {
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
                  text: `Bu soru görüntüsünü analiz et ve hangi derse ait olduğunu tespit et. 
                  KPSS için genişletilmiş dersler: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler.
                  Sadece ders adını döndür, başka bir şey yazma. Örnek: "Matematik", "Fizik", "Kimya", "Edebiyat", "Beden Eğitimi" vb.
                  Eğer matematik sorusu görüyorsan (sayılar, denklemler, formüller, geometrik şekiller varsa) mutlaka "Matematik" döndür.
                  Eğer şiir, roman, hikaye, edebiyat tarihi görüyorsan → "Edebiyat"
                  Eğer spor, beden, jimnastik, atletizm görüyorsan → "Beden Eğitimi"
                  Eğer güncel olaylar, haber, son gelişmeler görüyorsan → "Güncel Olaylar"
                  Eğer anayasa, hukuk, yasa, demokrasi, meclis görüyorsan → "Vatandaşlık"`,
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: await fetch(imageUrl)
                      .then((res) => res.arrayBuffer())
                      .then((buffer) => Buffer.from(buffer).toString("base64")),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 20,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("Gemini API hatası:", error);
      
      // Quota hatası kontrolü
      if (error.error?.message?.toLowerCase().includes("quota") || 
          error.error?.code === 429) {
        console.warn("Gemini quota dolmuş, basit tespit kullanılıyor");
        return "Bilinmeyen";
      }
      
      return "Bilinmeyen";
    }

    const data = await response.json();
    const detectedSubject = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Bilinmeyen";
    
    // Ders adını normalize et
    const normalizedSubject = normalizeSubjectName(detectedSubject);
    return normalizedSubject;
  } catch (error) {
    console.error("Gemini API çağrı hatası:", error);
    return "Bilinmeyen";
  }
}

/**
 * Ders adını normalize eder
 */
function normalizeSubjectName(subject: string): string {
  const lowerSubject = subject.toLowerCase().trim();
  
  const SUBJECT_KEYWORDS: { [key: string]: string[] } = {
    "Matematik": ["matematik", "mat", "sayı", "denklem", "fonksiyon", "türev", "integral", "geometri"],
    "Fizik": ["fizik", "kuvvet", "hareket", "enerji", "elektrik", "manyetizma"],
    "Kimya": ["kimya", "molekül", "atom", "element", "reaksiyon"],
    "Biyoloji": ["biyoloji", "hücre", "dna", "protein", "genetik"],
    "Türkçe": ["türkçe", "dil", "dilbilgisi", "yazım", "noktalama", "paragraf"],
    "Edebiyat": ["edebiyat", "şiir", "roman", "hikaye", "öykü", "deneme", "makale", "tiyatro", "şair", "yazar", "edebi"],
    "Tarih": ["tarih", "osmanlı", "savaş", "devlet"],
    "Coğrafya": ["coğrafya", "harita", "iklim", "nüfus"],
    "Felsefe": ["felsefe", "düşünce", "mantık", "etik"],
    "Vatandaşlık": ["vatandaşlık", "vatandaş", "anayasa", "hukuk", "yasa", "kanun", "demokrasi", "meclis", "bakan", "siyaset", "seçim"],
    "Güncel Olaylar": ["güncel", "güncel olaylar", "aktüel", "haber", "güncel konular", "son gelişmeler"],
    "Beden Eğitimi": ["beden eğitimi", "beden", "spor", "atletizm", "koşu", "jimnastik", "futbol", "basketbol", "voleybol", "fiziksel aktivite", "egzersiz", "sağlık"],
  };
  
  for (const [subjectName, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    if (keywords.some((keyword) => lowerSubject.includes(keyword))) {
      return subjectName;
    }
  }
  
  if (lowerSubject.includes("matematik") || lowerSubject.includes("math")) {
    return "Matematik";
  }
  
  return "Bilinmeyen";
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl gerekli" }, { status: 400 });
    }

    // Gemini API ile ders tespiti
    const subject = await detectSubjectWithGemini(imageUrl);

    return NextResponse.json({ subject });
  } catch (error: any) {
    console.error("Ders tespit hatası:", error);
    return NextResponse.json(
      { error: error.message || "Ders tespit edilemedi" },
      { status: 500 }
    );
  }
}

