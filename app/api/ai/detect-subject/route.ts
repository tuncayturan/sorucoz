import { NextRequest, NextResponse } from "next/server";
import { detectSubject } from "@/lib/ai-service";

// OpenAI veya başka bir AI servisi kullanılabilir
// Şimdilik basit bir pattern matching ile ders tespiti yapıyoruz
// Gerçek uygulamada OpenAI Vision API veya benzeri bir servis kullanılmalı

const SUBJECT_KEYWORDS: { [key: string]: string[] } = {
  "Matematik": [
    "matematik",
    "mat",
    "sayı",
    "denklem",
    "fonksiyon",
    "türev",
    "integral",
    "geometri",
    "trigonometri",
    "logaritma",
    "limit",
    "küme",
    "olasılık",
    "istatistik",
    "matris",
    "determinant",
    "cebir",
    "kalkülüs",
  ],
  "Fizik": [
    "fizik",
    "kuvvet",
    "hareket",
    "enerji",
    "elektrik",
    "manyetizma",
    "dalga",
    "optik",
    "termodinamik",
    "mekanik",
    "elektromanyetik",
    "atom",
    "nükleer",
    "momentum",
    "ivme",
    "hız",
    "basınç",
    "sıcaklık",
  ],
  "Kimya": [
    "kimya",
    "molekül",
    "atom",
    "element",
    "bileşik",
    "reaksiyon",
    "asit",
    "baz",
    "organik",
    "inorganik",
    "periyodik",
    "bağ",
    "çözelti",
    "kimyasal",
    "valans",
    "iyon",
  ],
  "Biyoloji": [
    "biyoloji",
    "hücre",
    "dna",
    "rna",
    "protein",
    "enzim",
    "sistem",
    "organ",
    "genetik",
    "evrim",
    "ekoloji",
    "bitki",
    "hayvan",
    "canlı",
    "organizma",
    "metabolizma",
  ],
  "Türkçe": [
    "türkçe",
    "dil",
    "anlatım",
    "dilbilgisi",
    "noktalama",
    "yazım",
    "kompozisyon",
    "paragraf",
    "sözcük",
    "kelime",
    "cümle",
    "anlam",
    "anlatım bozukluğu",
  ],
  "Edebiyat": [
    "edebiyat",
    "şiir",
    "roman",
    "hikaye",
    "öykü",
    "deneme",
    "makale",
    "tiyatro",
    "dram",
    "komedi",
    "trajedi",
    "şair",
    "yazar",
    "edebi",
    "edebiyat tarihi",
    "divan edebiyatı",
    "halk edebiyatı",
    "tanzimat",
    "servet-i fünun",
    "milli edebiyat",
    "cumhuriyet dönemi",
    "şiir türleri",
    "nazım",
    "nesir",
  ],
  "Beden Eğitimi": [
    "beden eğitimi",
    "beden",
    "spor",
    "atletizm",
    "koşu",
    "yürüyüş",
    "jimnastik",
    "futbol",
    "basketbol",
    "voleybol",
    "tenis",
    "yüzme",
    "fiziksel aktivite",
    "egzersiz",
    "antrenman",
    "fitness",
    "sağlık",
    "beslenme",
    "kas",
    "iskelet",
    "kalp",
    "dolaşım",
    "solunum",
    "motor",
    "koordinasyon",
    "denge",
    "esneklik",
    "dayanıklılık",
    "kuvvet",
    "hız",
    "çeviklik",
  ],
  "Tarih": [
    "tarih",
    "osmanlı",
    "türk",
    "savaş",
    "devlet",
    "medeniyet",
    "imparatorluk",
    "cumhuriyet",
    "inkılap",
    "göktürk",
    "uygur",
    "selçuklu",
    "beylik",
    "padişah",
    "sultan",
    "fetih",
    "antlaşma",
  ],
  "Coğrafya": [
    "coğrafya",
    "harita",
    "iklim",
    "nüfus",
    "ekonomi",
    "bölge",
    "ülke",
    "şehir",
    "dağ",
    "nehir",
    "akarsu",
    "göl",
    "deniz",
    "ova",
    "plato",
  ],
  "Felsefe": [
    "felsefe",
    "düşünce",
    "mantık",
    "etik",
    "estetik",
    "bilgi",
    "varlık",
    "filozof",
    "felsefi",
  ],
  "Vatandaşlık": [
    "vatandaşlık",
    "vatandaş",
    "anayasa",
    "hukuk",
    "yasa",
    "kanun",
    "hak",
    "özgürlük",
    "demokrasi",
    "meclis",
    "bakan",
    "bakanlık",
    "devlet",
    "yönetim",
    "siyaset",
    "seçim",
    "cumhurbaşkanı",
    "başbakan",
    "bakanlar kurulu",
    "mahkeme",
    "yargı",
    "yasama",
    "yürütme",
    "idare",
    "kamu",
    "özel",
    "sivil toplum",
    "dernek",
    "vakıf",
    "sendika",
    "parti",
    "milletvekili",
    "belediye",
    "vali",
    "kaymakam",
    "muhtar",
    "temel haklar",
    "insan hakları",
    "çocuk hakları",
    "kadın hakları",
    "eşitlik",
    "adalet",
    "laiklik",
    "milliyetçilik",
    "atatürk ilkeleri",
  ],
  "Güncel Olaylar": [
    "güncel",
    "güncel olaylar",
    "aktüel",
    "haber",
    "güncel bilgiler",
    "son gelişmeler",
    "güncel konular",
    "aktüel konular",
    "güncel sorunlar",
    "güncel tartışmalar",
    "güncel ekonomi",
    "güncel siyaset",
    "güncel teknoloji",
    "güncel kültür",
    "güncel sanat",
    "güncel spor",
    "güncel sağlık",
    "güncel eğitim",
    "güncel çevre",
    "güncel enerji",
    "güncel tarım",
    "güncel turizm",
    "güncel ulaşım",
    "güncel iletişim",
    "güncel medya",
    "güncel sosyal medya",
    "güncel dijital",
    "güncel inovasyon",
    "güncel trend",
    "güncel gelişme",
    "güncel değişim",
    "güncel dönüşüm",
  ],
  "Fen Bilgisi": [
    "fen bilgisi",
    "fen",
    "fen ve teknoloji",
    "fen dersi",
    "fen konusu",
    "fen sorusu",
    "fizik kimya biyoloji",
    "doğa bilimleri",
  ],
  "Sosyal Bilgiler": [
    "sosyal bilgiler",
    "sosyal",
    "sosyal dersi",
    "sosyal konusu",
    "sosyal sorusu",
    "tarih coğrafya",
    "sosyal bilimler",
  ],
};

/**
 * Google Gemini API kullanarak görüntüden ders tespiti yapar (ücretsiz)
 */
async function detectSubjectWithGemini(imageUrl: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn("GEMINI_API_KEY bulunamadı, basit tespit kullanılıyor");
    return null;
  }

  try {
    // Görseli base64'e çevir
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error("Görsel yüklenemedi:", imageResponse.status);
      return null;
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString("base64");
    
    // MIME type'ı belirle
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png") ? "image/png" : 
                     contentType.includes("webp") ? "image/webp" : 
                     "image/jpeg";

    const prompt = `Bu soru hangi derse ait? Sadece ders adını yaz.

Dersler: Matematik, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler

Kurallar (KPSS için genişletilmiş):
- Sayılar, denklemler, formüller, geometri varsa → Matematik
- Kuvvet, hareket, enerji, elektrik, optik varsa → Fizik
- Molekül, atom, element, reaksiyon, periyodik tablo varsa → Kimya
- Hücre, DNA, organ, bitki, hayvan varsa → Biyoloji
- Dilbilgisi, yazım, noktalama, paragraf, anlatım bozukluğu varsa → Türkçe
- Şiir, roman, hikaye, edebiyat tarihi, şair, yazar varsa → Edebiyat
- Devletler, savaşlar, osmanlı, göktürk, cumhuriyet varsa → Tarih
- Harita, iklim, nüfus, ülke, şehir varsa → Coğrafya
- Mantık, etik, filozof, felsefi düşünce varsa → Felsefe
- Anayasa, hukuk, yasa, hak, demokrasi, meclis, devlet yönetimi varsa → Vatandaşlık
- Güncel olaylar, haber, son gelişmeler, aktüel konular varsa → Güncel Olaylar
- Spor, beden, jimnastik, atletizm, fiziksel aktivite, sağlık, egzersiz varsa → Beden Eğitimi
- Fizik, kimya, biyoloji konuları birlikte varsa veya fen bilgisi sorusuysa → Fen Bilgisi
- Tarih, coğrafya, vatandaşlık konuları birlikte varsa veya sosyal bilgiler sorusuysa → Sosyal Bilgiler

Sadece ders adını yaz, başka bir şey yazma.`;

    // Thinking modu olmayan model kullanıyoruz (gemini-2.0-flash-001)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`,
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
                  text: prompt,
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
            temperature: 0.1,
            maxOutputTokens: 50, // Thinking modu olmadığı için 50 yeterli
            // responseMimeType v1 API'de desteklenmiyor, kaldırıldı
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      console.error("❌ Gemini API Ders Tespit Hatası:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      // API key hatası
      if (response.status === 401 || response.status === 403) {
        console.error("❌ API Key geçersiz veya yetkisiz!");
      }
      
      // Rate limit
      if (response.status === 429) {
        console.error("❌ Rate limit aşıldı!");
      }
      
      return null;
    }

    const data = await response.json();
    console.log("Gemini API yanıtı:", JSON.stringify(data, null, 2));
    
    // Finish reason kontrolü
    const finishReason = data.candidates?.[0]?.finishReason;
    const candidate = data.candidates?.[0];
    
    if (finishReason === "MAX_TOKENS") {
      console.warn("⚠️ Token limiti aşıldı, yanıt kesilmiş olabilir");
    }
    
    // JSON yanıtını parse et
    let detectedSubject: string | null = null;
    
    try {
      // Content ve parts kontrolü
      if (!candidate?.content?.parts || candidate.content.parts.length === 0) {
        console.error("❌ Content parts bulunamadı:", {
          candidate: candidate,
          finishReason: finishReason,
          hasContent: !!candidate?.content,
          hasParts: !!candidate?.content?.parts,
          partsLength: candidate?.content?.parts?.length || 0
        });
        
        // Eğer MAX_TOKENS ise, belki de kısmi yanıt var, tekrar kontrol et
        if (finishReason === "MAX_TOKENS" && candidate?.content) {
          console.warn("⚠️ MAX_TOKENS durumunda content var, detaylı kontrol ediliyor...");
          // Content objesini detaylı logla
          console.log("📋 Content detayları:", JSON.stringify(candidate.content, null, 2));
        }
        
        return null;
      }
      
      // Önce JSON formatında yanıt gelmiş mi kontrol et
      let responseText = candidate.content.parts[0]?.text?.trim() || "";
      
      if (!responseText) {
        console.error("❌ Response text boş, finishReason:", finishReason);
        // Tüm parts'ı kontrol et
        console.log("📋 Tüm parts:", candidate.content.parts);
        return null;
      }
      
      // Markdown code block formatını temizle (```json ... ```)
      if (responseText) {
        responseText = responseText.trim();
        if (responseText.startsWith("```json")) {
          responseText = responseText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
        } else if (responseText.startsWith("```")) {
          responseText = responseText.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        responseText = responseText.trim();
      }
      
      console.log("📝 Ders tespit yanıtı (temizlenmiş, ilk 200 karakter):", responseText.substring(0, 200));
      
      if (responseText) {
        // Önce JSON formatında mı kontrol et
        if (responseText.trim().startsWith("{")) {
          try {
            // JSON parse et
            const parsedResponse = JSON.parse(responseText);
            detectedSubject = parsedResponse.ders || parsedResponse.subject || null;
            console.log("✅ JSON parse başarılı, ders:", detectedSubject);
          } catch (jsonError) {
            // JSON parse başarısız, direkt metin olarak al
            console.warn("⚠️ JSON parse başarısız, metin olarak alınıyor:", jsonError);
            detectedSubject = responseText.replace(/[{}"']/g, "").split(":")[1]?.trim() || responseText.trim();
          }
        } else {
          // Direkt metin formatında, sadece ders adı
          detectedSubject = responseText.trim();
          console.log("✅ Metin formatında ders:", detectedSubject);
        }
      }
    } catch (parseError) {
      console.error("❌ Parse hatası:", parseError);
      // Direkt metin olarak al
      let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      // Markdown temizle
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```\w*\s*/, "").replace(/\s*```$/, "").trim();
      }
      detectedSubject = responseText || null;
    }
    
    if (detectedSubject) {
      const normalized = normalizeSubjectName(detectedSubject);
      console.log("Tespit edilen ders:", detectedSubject, "→ Normalize:", normalized);
      return normalized;
    }
    
    console.warn("Ders tespit edilemedi, yanıt:", data);
    return null;
  } catch (error) {
    console.error("Gemini API çağrı hatası:", error);
    return null;
  }
}


/**
 * Ders adını normalize eder (büyük/küçük harf, boşluk vb.)
 */
function normalizeSubjectName(subject: string): string {
  if (!subject) return "Bilinmeyen";
  
  const lowerSubject = subject.toLowerCase().trim();
  
  // Önce direkt eşleşme kontrolü (en kesin)
  const subjectNames = Object.keys(SUBJECT_KEYWORDS);
  for (const name of subjectNames) {
    const lowerName = name.toLowerCase();
    // Tam eşleşme veya içeriyor mu kontrol et
    if (lowerSubject === lowerName || lowerSubject.includes(lowerName)) {
      return name;
    }
  }
  
  // Anahtar kelimelere göre eşleştir
  for (const [subjectName, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    if (keywords.some((keyword) => lowerSubject.includes(keyword))) {
      return subjectName;
    }
  }
  
  // Özel durumlar - daha kapsamlı kontrol
  if (lowerSubject.includes("math") || lowerSubject.includes("matematik") || lowerSubject.includes("mat")) {
    return "Matematik";
  }
  if (lowerSubject.includes("physics") || lowerSubject.includes("fizik")) {
    return "Fizik";
  }
  if (lowerSubject.includes("chemistry") || lowerSubject.includes("kimya")) {
    return "Kimya";
  }
  if (lowerSubject.includes("biology") || lowerSubject.includes("biyoloji")) {
    return "Biyoloji";
  }
  if (lowerSubject.includes("turkish") || lowerSubject.includes("türkçe") || lowerSubject.includes("turkce")) {
    return "Türkçe";
  }
  // Tarih için daha kapsamlı kontrol
  if (lowerSubject.includes("history") || lowerSubject.includes("tarih") || 
      lowerSubject.includes("osmanlı") || lowerSubject.includes("osmanli") ||
      lowerSubject.includes("göktürk") || lowerSubject.includes("gokturk") ||
      lowerSubject.includes("uygur") || lowerSubject.includes("cumhuriyet") ||
      lowerSubject.includes("savaş") || lowerSubject.includes("savas") ||
      lowerSubject.includes("devlet") || lowerSubject.includes("medeniyet") ||
      lowerSubject.includes("selçuklu") || lowerSubject.includes("selcuklu") ||
      lowerSubject.includes("padişah") || lowerSubject.includes("padisah")) {
    return "Tarih";
  }
  if (lowerSubject.includes("geography") || lowerSubject.includes("coğrafya") || lowerSubject.includes("cografya")) {
    return "Coğrafya";
  }
  if (lowerSubject.includes("philosophy") || lowerSubject.includes("felsefe")) {
    return "Felsefe";
  }
  // Vatandaşlık için kontrol (genişletilmiş)
  if (lowerSubject.includes("vatandaşlık") || lowerSubject.includes("vatandaslik") ||
      lowerSubject.includes("vatandaş") || lowerSubject.includes("vatandas") ||
      lowerSubject.includes("anayasa") || lowerSubject.includes("hukuk") ||
      lowerSubject.includes("yasa") || lowerSubject.includes("kanun") ||
      lowerSubject.includes("demokrasi") || lowerSubject.includes("meclis") ||
      lowerSubject.includes("bakan") || lowerSubject.includes("siyaset") ||
      lowerSubject.includes("seçim") || lowerSubject.includes("secim") ||
      lowerSubject.includes("cumhurbaşkanı") || lowerSubject.includes("cumhurbaskani") ||
      lowerSubject.includes("başbakan") || lowerSubject.includes("basbakan") ||
      lowerSubject.includes("bakanlar kurulu") || lowerSubject.includes("mahkeme") ||
      lowerSubject.includes("yargı") || lowerSubject.includes("yargi") ||
      lowerSubject.includes("yasama") || lowerSubject.includes("yürütme") ||
      lowerSubject.includes("yurutme") || lowerSubject.includes("idare") ||
      lowerSubject.includes("kamu") || lowerSubject.includes("sivil toplum") ||
      lowerSubject.includes("dernek") || lowerSubject.includes("vakıf") ||
      lowerSubject.includes("vakif") || lowerSubject.includes("sendika") ||
      lowerSubject.includes("parti") || lowerSubject.includes("milletvekili") ||
      lowerSubject.includes("belediye") || lowerSubject.includes("vali") ||
      lowerSubject.includes("kaymakam") || lowerSubject.includes("muhtar") ||
      lowerSubject.includes("temel haklar") || lowerSubject.includes("insan hakları") ||
      lowerSubject.includes("insan haklari") || lowerSubject.includes("çocuk hakları") ||
      lowerSubject.includes("cocuk haklari") || lowerSubject.includes("kadın hakları") ||
      lowerSubject.includes("kadin haklari") || lowerSubject.includes("eşitlik") ||
      lowerSubject.includes("esitlik") || lowerSubject.includes("adalet") ||
      lowerSubject.includes("laiklik") || lowerSubject.includes("milliyetçilik") ||
      lowerSubject.includes("milliyetcilik") || lowerSubject.includes("atatürk ilkeleri") ||
      lowerSubject.includes("ataturk ilkeleri")) {
    return "Vatandaşlık";
  }
  // Edebiyat için kontrol (Türkçe'den ayrı)
  if (lowerSubject.includes("edebiyat") || lowerSubject.includes("şiir") ||
      lowerSubject.includes("roman") || lowerSubject.includes("hikaye") ||
      lowerSubject.includes("öykü") || lowerSubject.includes("deneme") ||
      lowerSubject.includes("makale") || lowerSubject.includes("tiyatro") ||
      lowerSubject.includes("dram") || lowerSubject.includes("komedi") ||
      lowerSubject.includes("trajedi") || lowerSubject.includes("şair") ||
      lowerSubject.includes("yazar") || lowerSubject.includes("edebi") ||
      lowerSubject.includes("nazım") || lowerSubject.includes("nesir") ||
      lowerSubject.includes("divan edebiyatı") || lowerSubject.includes("halk edebiyatı") ||
      lowerSubject.includes("tanzimat") || lowerSubject.includes("servet-i fünun") ||
      lowerSubject.includes("milli edebiyat") || lowerSubject.includes("cumhuriyet dönemi")) {
    return "Edebiyat";
  }
  // Beden Eğitimi için kontrol
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
  // Güncel Olaylar için kontrol (genişletilmiş)
  if (lowerSubject.includes("güncel") || lowerSubject.includes("guncel") ||
      lowerSubject.includes("aktüel") || lowerSubject.includes("aktuel") ||
      lowerSubject.includes("haber") || lowerSubject.includes("güncel olaylar") ||
      lowerSubject.includes("guncel olaylar") || lowerSubject.includes("güncel konular") ||
      lowerSubject.includes("güncel sorunlar") || lowerSubject.includes("güncel tartışmalar") ||
      lowerSubject.includes("güncel ekonomi") || lowerSubject.includes("güncel siyaset") ||
      lowerSubject.includes("güncel teknoloji") || lowerSubject.includes("güncel kültür") ||
      lowerSubject.includes("güncel sanat") || lowerSubject.includes("güncel spor") ||
      lowerSubject.includes("güncel sağlık") || lowerSubject.includes("güncel eğitim") ||
      lowerSubject.includes("güncel çevre") || lowerSubject.includes("güncel enerji") ||
      lowerSubject.includes("güncel tarım") || lowerSubject.includes("güncel turizm") ||
      lowerSubject.includes("güncel ulaşım") || lowerSubject.includes("güncel iletişim") ||
      lowerSubject.includes("güncel medya") || lowerSubject.includes("güncel sosyal medya") ||
      lowerSubject.includes("güncel dijital") || lowerSubject.includes("güncel inovasyon") ||
      lowerSubject.includes("güncel trend") || lowerSubject.includes("güncel gelişme") ||
      lowerSubject.includes("güncel değişim") || lowerSubject.includes("güncel dönüşüm")) {
    return "Güncel Olaylar";
  }
  // Fen Bilgisi için kontrol
  if (lowerSubject.includes("fen bilgisi") || lowerSubject.includes("fenbilgisi") ||
      lowerSubject.includes("fen ve teknoloji") || (lowerSubject.includes("fen") && !lowerSubject.includes("felsefe"))) {
    return "Fen Bilgisi";
  }
  // Sosyal Bilgiler için kontrol
  if (lowerSubject.includes("sosyal bilgiler") || lowerSubject.includes("sosyalbilgiler") ||
      (lowerSubject.includes("sosyal") && !lowerSubject.includes("sosyal bilimler"))) {
    return "Sosyal Bilgiler";
  }
  
  console.warn("Ders normalize edilemedi:", subject);
  return "Bilinmeyen";
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      console.error("❌ imageUrl gerekli");
      return NextResponse.json({ error: "imageUrl gerekli" }, { status: 400 });
    }

    console.log("🔍 Ders tespiti başlatılıyor:", imageUrl);

    // AI servisi ile ders tespiti (Firestore ayarlarına göre)
    const subject = await detectSubject(imageUrl);
    
    if (!subject || subject === "Bilinmeyen") {
      console.warn("⚠️ Ders tespit edilemedi veya 'Bilinmeyen' döndü");
      return NextResponse.json({ subject: "Bilinmeyen" });
    }

    console.log("✅ Ders başarıyla tespit edildi:", subject);
    return NextResponse.json({ subject });
  } catch (error: any) {
    console.error("❌ Ders tespit hatası:", error);
    return NextResponse.json(
      { error: error.message || "Ders tespit edilemedi" },
      { status: 500 }
    );
  }
}

