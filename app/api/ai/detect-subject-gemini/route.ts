import { NextRequest, NextResponse } from "next/server";

/**
 * Google Gemini API kullanarak görüntüden ders tespiti yapar
 * Ücretsiz tier: Günde 60 istek
 */
async function detectSubjectWithGemini(imageUrl: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {    return "Bilinmeyen";
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
                  text: `                  Bu soru görüntüsünü analiz et ve hangi derse ait olduğunu tespit et. 
                  KPSS için genişletilmiş dersler: Matematik, Geometri, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler, Sayısal Mantık, Sözel Mantık, Eğitim Bilimleri, Gelişim, Din Kültürü ve Ahlak Bilgisi, Okul Öncesi, Rehberlik, Sınıf Öğretmenliği, İngilizce, Almanca, İtalyanca, Arapça.
                  Sadece ders adını döndür, başka bir şey yazma. Örnek: "Matematik", "Fizik", "Kimya", "Edebiyat", "Beden Eğitimi" vb.
                  
                  ÖNEMLİ KURALLAR:
                  - Sayılar, rakamlar, denklemler, formüller, toplama, çıkarma, çarpma, bölme, işlem, hesaplama, problem çözme görüyorsan → "Matematik" döndür (Geometri spesifik terimleri yoksa)
                  - Açı, üçgen, dörtgen, çember, daire, alan, çevre, hacim, geometrik şekiller görüyorsan → "Geometri" döndür
                  - Eğer matematik sorusu görüyorsan (sayılar, denklemler, formüller varsa ama geometrik şekiller yoksa) mutlaka "Matematik" döndür.
                  Eğer şiir, roman, hikaye, edebiyat tarihi görüyorsan → "Edebiyat"
                  Eğer spor, beden, jimnastik, atletizm görüyorsan → "Beden Eğitimi"
                  Eğer güncel olaylar, haber, son gelişmeler görüyorsan → "Güncel Olaylar"
                  Eğer anayasa, hukuk, yasa, demokrasi, meclis görüyorsan → "Vatandaşlık"
                  Eğer sayı dizileri, sayı bulmacaları, sayısal akıl yürütme görüyorsan → "Sayısal Mantık"
                  Eğer kelime ilişkileri, cümle mantığı, paragraf mantığı, sözel akıl yürütme görüyorsan → "Sözel Mantık"
                  Eğer açı, üçgen, dörtgen, çember, alan, çevre, hacim görüyorsan → "Geometri"
                  Eğer eğitim, öğretim yöntemleri, eğitim programları görüyorsan → "Eğitim Bilimleri"
                  Eğer çocuk gelişimi, ergen gelişimi, bilişsel gelişim görüyorsan → "Gelişim"
                  Eğer din, ahlak, islam, kur'an, ibadet görüyorsan → "Din Kültürü ve Ahlak Bilgisi"
                  Eğer anaokulu, kreş, erken çocukluk görüyorsan → "Okul Öncesi"
                  Eğer rehberlik, psikolojik danışmanlık görüyorsan → "Rehberlik"
                  Eğer sınıf öğretmenliği, ilkokul görüyorsan → "Sınıf Öğretmenliği"
                  Eğer English, ingilizce kelime, ingilizce dilbilgisi görüyorsan → "İngilizce"
                  Eğer German, almanca kelime, almanca dilbilgisi görüyorsan → "Almanca"
                  Eğer Italian, italyanca kelime, italyanca dilbilgisi görüyorsan → "İtalyanca"
                  Eğer Arabic, arapça kelime, arapça dilbilgisi görüyorsan → "Arapça"`,
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
            temperature: 0.05, // Daha deterministik sonuçlar için düşürüldü
            maxOutputTokens: 20,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));      // Quota hatası kontrolü
      if (error.error?.message?.toLowerCase().includes("quota") || 
          error.error?.code === 429) {        return "Bilinmeyen";
      }
      
      return "Bilinmeyen";
    }

    const data = await response.json();
    const detectedSubject = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Bilinmeyen";
    
    // Ders adını normalize et
    const normalizedSubject = normalizeSubjectName(detectedSubject);
    return normalizedSubject;
  } catch (error) {    return "Bilinmeyen";
  }
}

/**
 * Ders adını normalize eder
 */
function normalizeSubjectName(subject: string): string {
  if (!subject) return "Bilinmeyen";
  
  const lowerSubject = subject.toLowerCase().trim();
  
  // ÖNCE Beden Eğitimi için özel kontrol (çok erken)
  if (lowerSubject.includes("beden eğitimi") || lowerSubject.includes("beden egitimi") ||
      lowerSubject.includes("beden") || lowerSubject.includes("spor") ||
      lowerSubject.includes("atletizm") || lowerSubject.includes("koşu") ||
      lowerSubject.includes("yürüyüş") || lowerSubject.includes("jimnastik") ||
      lowerSubject.includes("futbol") || lowerSubject.includes("basketbol") ||
      lowerSubject.includes("voleybol") || lowerSubject.includes("tenis") ||
      lowerSubject.includes("yüzme") || lowerSubject.includes("fiziksel aktivite") ||
      lowerSubject.includes("egzersiz") || lowerSubject.includes("antrenman") ||
      lowerSubject.includes("fitness") || lowerSubject.includes("sağlık") ||
      lowerSubject.includes("beslenme") || lowerSubject.includes("kas") ||
      lowerSubject.includes("iskelet") || lowerSubject.includes("kalp") ||
      lowerSubject.includes("dolaşım") || lowerSubject.includes("solunum") ||
      lowerSubject.includes("motor") || lowerSubject.includes("koordinasyon") ||
      lowerSubject.includes("denge") || lowerSubject.includes("esneklik") ||
      lowerSubject.includes("dayanıklılık") || lowerSubject.includes("kuvvet") ||
      lowerSubject.includes("hız") || lowerSubject.includes("çeviklik")) {
    return "Beden Eğitimi";
  }
  
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
    "Sayısal Mantık": ["sayısal mantık", "sayısal", "mantık", "akıl yürütme", "sayı dizileri", "sayı bulmacaları", "matematiksel mantık", "sayısal akıl yürütme", "sayısal problem", "sayısal test", "sayısal yetenek", "sayısal düşünme"],
    "Sözel Mantık": ["sözel mantık", "sözel", "mantık", "akıl yürütme", "sözel akıl yürütme", "sözel problem", "sözel test", "sözel yetenek", "sözel düşünme", "kelime ilişkileri", "cümle mantığı", "paragraf mantığı", "metin analizi", "sözel bulmaca"],
    "Geometri": ["geometri", "geometrik", "açı", "üçgen", "dörtgen", "çember", "daire", "alan", "çevre", "hacim", "koordinat", "vektör"],
    "Eğitim Bilimleri": ["eğitim bilimleri", "eğitim", "eğitim psikolojisi", "öğretim yöntemleri", "eğitim programları", "öğrenme teorileri"],
    "Gelişim": ["gelişim", "gelişim psikolojisi", "çocuk gelişimi", "ergen gelişimi", "bilişsel gelişim", "sosyal gelişim"],
    "Din Kültürü ve Ahlak Bilgisi": ["din kültürü", "din", "ahlak", "islam", "kur'an", "ibadet", "namaz", "oruç"],
    "Okul Öncesi": ["okul öncesi", "anaokulu", "kreş", "erken çocukluk", "okul öncesi eğitim"],
    "Rehberlik": ["rehberlik", "psikolojik danışmanlık", "mesleki rehberlik", "eğitsel rehberlik"],
    "Sınıf Öğretmenliği": ["sınıf öğretmenliği", "sınıf öğretmeni", "ilkokul", "sınıf yönetimi"],
    "İngilizce": ["ingilizce", "english", "ingiliz dili", "ingilizce dilbilgisi", "ingilizce kelime"],
    "Almanca": ["almanca", "german", "alman dili", "almanca dilbilgisi", "almanca kelime"],
    "İtalyanca": ["italyanca", "italian", "italyan dili", "italyanca dilbilgisi", "italyanca kelime"],
    "Arapça": ["arapça", "arabic", "arap dili", "arapça dilbilgisi", "arapça kelime"],
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
  } catch (error: any) {    return NextResponse.json(
      { error: error.message || "Ders tespit edilemedi" },
      { status: 500 }
    );
  }
}

