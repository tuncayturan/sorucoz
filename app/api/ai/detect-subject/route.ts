import { NextRequest, NextResponse } from "next/server";
import { detectSubject } from "@/lib/ai-service";

// OpenAI veya başka bir AI servisi kullanılabilir
// Şimdilik basit bir pattern matching ile ders tespiti yapıyoruz
// Gerçek uygulamada OpenAI Vision API veya benzeri bir servis kullanılmalı

const SUBJECT_KEYWORDS: { [key: string]: string[] } = {
  "Matematik": [
    "matematik",
    "mat",
    "math",
    "mathematics",
    "sayı",
    "sayi",
    "rakam",
    "denklem",
    "equation",
    "fonksiyon",
    "function",
    "türev",
    "derivative",
    "integral",
    "geometri",
    "geometry",
    "trigonometri",
    "trigonometry",
    "logaritma",
    "logarithm",
    "limit",
    "küme",
    "set",
    "olasılık",
    "probability",
    "istatistik",
    "statistics",
    "matris",
    "matrix",
    "determinant",
    "cebir",
    "algebra",
    "kalkülüs",
    "calculus",
    "toplama",
    "çıkarma",
    "cikarma",
    "çarpma",
    "carpma",
    "bölme",
    "bolme",
    "işlem",
    "islem",
    "hesaplama",
    "formül",
    "formul",
    "formula",
    "kök",
    "kok",
    "üs",
    "us",
    "faktöriyel",
    "faktoriyel",
    "permütasyon",
    "permutasyon",
    "kombinasyon",
    "polinom",
    "polynomial",
    "kesir",
    "ondalık",
    "ondalik",
    "yüzde",
    "oran",
    "orantı",
    "oranti",
    "problem",
    "soru",
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
  "Sayısal Mantık": [
    "sayısal mantık",
    "sayısal",
    "mantık",
    "akıl yürütme",
    "problem çözme",
    "sayı dizileri",
    "sayı bulmacaları",
    "matematiksel mantık",
    "sayısal akıl yürütme",
    "sayısal problem",
    "sayısal test",
    "sayısal yetenek",
    "sayısal düşünme",
    "sayısal zeka",
    "sayısal beceri",
    "sayısal analiz",
    "sayısal çıkarım",
    "sayısal muhakeme",
    "sayısal bulmaca",
    "sayısal oyun",
    "sayısal sıralama",
    "sayısal ilişki",
    "sayısal desen",
    "sayısal kural",
  ],
  "Sözel Mantık": [
    "sözel mantık",
    "sözel",
    "mantık",
    "akıl yürütme",
    "problem çözme",
    "sözel akıl yürütme",
    "sözel problem",
    "sözel test",
    "sözel yetenek",
    "sözel düşünme",
    "kelime ilişkileri",
    "cümle mantığı",
    "paragraf mantığı",
    "metin analizi",
    "sözel bulmaca",
    "sözel zeka",
    "sözel beceri",
    "sözel analiz",
    "sözel çıkarım",
    "sözel muhakeme",
    "sözel oyun",
    "sözel sıralama",
    "sözel ilişki",
    "sözel desen",
    "sözel kural",
    "kelime bulmacası",
    "cümle tamamlama",
    "paragraf tamamlama",
    "metin tamamlama",
  ],
  "Eğitim Bilimleri": [
    "eğitim bilimleri",
    "eğitim",
    "eğitim bilimi",
    "eğitim psikolojisi",
    "öğretim yöntemleri",
    "eğitim programları",
    "eğitim felsefesi",
    "eğitim sosyolojisi",
    "eğitim yönetimi",
    "eğitim teknolojisi",
    "öğrenme teorileri",
    "öğretim stratejileri",
    "eğitim araştırmaları",
    "eğitim değerlendirme",
    "eğitim ölçme",
    "eğitim testleri",
    "eğitim istatistikleri",
    "eğitim planlaması",
    "eğitim politikaları",
    "eğitim sistemleri",
  ],
  "Gelişim": [
    "gelişim",
    "gelişim psikolojisi",
    "çocuk gelişimi",
    "ergen gelişimi",
    "bilişsel gelişim",
    "sosyal gelişim",
    "duygusal gelişim",
    "fiziksel gelişim",
    "dil gelişimi",
    "ahlak gelişimi",
    "kişilik gelişimi",
    "motor gelişim",
    "gelişim dönemleri",
    "gelişim teorileri",
    "gelişim aşamaları",
    "gelişim özellikleri",
  ],
  "Geometri": [
    "geometri",
    "geometrik",
    "açı",
    "üçgen",
    "dörtgen",
    "çember",
    "daire",
    "kare",
    "dikdörtgen",
    "paralelkenar",
    "yamuk",
    "eşkenar",
    "ikizkenar",
    "pisagor",
    "alan",
    "çevre",
    "hacim",
    "yüzey alanı",
    "koordinat",
    "vektör",
    "geometrik şekil",
    "geometrik cisim",
    "prizma",
    "piramit",
    "küre",
    "silindir",
    "koni",
  ],
  "Din Kültürü ve Ahlak Bilgisi": [
    "din kültürü",
    "din kültürü ve ahlak bilgisi",
    "din",
    "ahlak",
    "ahlak bilgisi",
    "islam",
    "islam dini",
    "kur'an",
    "kuran",
    "hadis",
    "peygamber",
    "ibadet",
    "namaz",
    "oruç",
    "zekat",
    "hac",
    "din bilgisi",
    "din eğitimi",
    "dini bilgiler",
    "islam tarihi",
    "islam kültürü",
    "ahlak eğitimi",
    "değerler eğitimi",
  ],
  "Okul Öncesi": [
    "okul öncesi",
    "anaokulu",
    "kreş",
    "erken çocukluk",
    "okul öncesi eğitim",
    "anaokulu eğitimi",
    "erken çocukluk eğitimi",
    "okul öncesi program",
    "okul öncesi öğretmenliği",
    "okul öncesi gelişim",
    "okul öncesi etkinlik",
    "okul öncesi materyal",
  ],
  "Rehberlik": [
    "rehberlik",
    "psikolojik danışmanlık",
    "rehberlik ve psikolojik danışmanlık",
    "rehberlik hizmetleri",
    "mesleki rehberlik",
    "eğitsel rehberlik",
    "kişisel rehberlik",
    "rehberlik programı",
    "rehberlik testleri",
    "rehberlik teknikleri",
    "rehberlik yaklaşımları",
    "rehberlik modelleri",
    "rehberlik kuramları",
  ],
  "Sınıf Öğretmenliği": [
    "sınıf öğretmenliği",
    "sınıf öğretmeni",
    "ilkokul",
    "ilkokul öğretmenliği",
    "sınıf öğretmeni eğitimi",
    "sınıf yönetimi",
    "sınıf içi öğretim",
    "sınıf öğretmenliği programı",
    "ilkokul programı",
    "sınıf öğretmenliği dersleri",
  ],
  "İngilizce": [
    "ingilizce",
    "english",
    "ingiliz dili",
    "ingiliz dili ve edebiyatı",
    "ingilizce dilbilgisi",
    "ingilizce kelime",
    "ingilizce okuma",
    "ingilizce yazma",
    "ingilizce konuşma",
    "ingilizce dinleme",
    "ingilizce test",
    "ingilizce sınav",
    "yabancı dil ingilizce",
  ],
  "Almanca": [
    "almanca",
    "german",
    "alman dili",
    "alman dili ve edebiyatı",
    "almanca dilbilgisi",
    "almanca kelime",
    "almanca okuma",
    "almanca yazma",
    "almanca konuşma",
    "almanca dinleme",
    "almanca test",
    "almanca sınav",
    "yabancı dil almanca",
  ],
  "İtalyanca": [
    "italyanca",
    "italian",
    "italyan dili",
    "italyan dili ve edebiyatı",
    "italyanca dilbilgisi",
    "italyanca kelime",
    "italyanca okuma",
    "italyanca yazma",
    "italyanca konuşma",
    "italyanca dinleme",
    "italyanca test",
    "italyanca sınav",
    "yabancı dil italyanca",
  ],
  "Arapça": [
    "arapça",
    "arabic",
    "arap dili",
    "arap dili ve edebiyatı",
    "arapça dilbilgisi",
    "arapça kelime",
    "arapça okuma",
    "arapça yazma",
    "arapça konuşma",
    "arapça dinleme",
    "arapça test",
    "arapça sınav",
    "yabancı dil arapça",
  ],
};

/**
 * Google Gemini API kullanarak görüntüden ders tespiti yapar (ücretsiz)
 */
async function detectSubjectWithGemini(imageUrl: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return null;
  }

  try {
    // Görseli base64'e çevir
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
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

Dersler: Matematik, Geometri, Fizik, Kimya, Biyoloji, Türkçe, Edebiyat, Tarih, Coğrafya, Felsefe, Vatandaşlık, Güncel Olaylar, Beden Eğitimi, Fen Bilgisi, Sosyal Bilgiler, Sayısal Mantık, Sözel Mantık, Eğitim Bilimleri, Gelişim, Din Kültürü ve Ahlak Bilgisi, Okul Öncesi, Rehberlik, Sınıf Öğretmenliği, İngilizce, Almanca, İtalyanca, Arapça

Kurallar (KPSS için genişletilmiş):
- Sayılar, rakamlar, denklemler, formüller, toplama, çıkarma, çarpma, bölme, işlem, hesaplama, problem çözme varsa → Matematik (ÖNEMLİ: Geometri spesifik terimleri yoksa Matematik'tir)
- Açı, üçgen, dörtgen, çember, daire, alan, çevre, hacim, geometrik şekiller, koordinat, vektör varsa → Geometri
- Kuvvet, hareket, enerji, elektrik, optik varsa → Fizik
- Molekül, atom, element, reaksiyon, periyodik tablo varsa → Kimya
- Hücre, DNA, organ, bitki, hayvan varsa → Biyoloji
- Dilbilgisi, yazım, noktalama, paragraf, anlatım bozukluğu varsa → Türkçe
- Şiir, roman, hikaye, edebiyat tarihi, şair, yazar varsa → Edebiyat
- Osmanlı, göktürk, cumhuriyet, savaşlar, padişah, sultan, fetih, antlaşma, imparatorluk, medeniyet varsa → Tarih (ÖNEMLİ: Beden Eğitimi ile karıştırma! Spor, beden, jimnastik varsa Beden Eğitimi'dir)
- Harita, iklim, nüfus, ülke, şehir varsa → Coğrafya
- Mantık, etik, filozof, felsefi düşünce varsa → Felsefe
- Anayasa, hukuk, yasa, hak, demokrasi, meclis, devlet yönetimi varsa → Vatandaşlık
- Güncel olaylar, haber, son gelişmeler, aktüel konular varsa → Güncel Olaylar
- Spor, beden eğitimi, jimnastik, atletizm, futbol, basketbol, voleybol, fiziksel aktivite, egzersiz, antrenman, fitness, sağlık, kas, iskelet, motor, koordinasyon, denge, esneklik, dayanıklılık, kuvvet, hız, çeviklik varsa → Beden Eğitimi (ÖNEMLİ: Tarih ile karıştırma! Spor, beden, jimnastik, atletizm, futbol, basketbol, voleybol, egzersiz, antrenman, fitness, kas, iskelet, motor, koordinasyon görüyorsan MUTLAKA Beden Eğitimi'dir!)
- Fizik, kimya, biyoloji konuları birlikte varsa veya fen bilgisi sorusuysa → Fen Bilgisi
- Tarih, coğrafya, vatandaşlık konuları birlikte varsa veya sosyal bilgiler sorusuysa → Sosyal Bilgiler
- Sayılar, diziler, sayı bulmacaları, sayısal akıl yürütme, sayısal problem çözme varsa → Sayısal Mantık
- Kelime ilişkileri, cümle mantığı, paragraf mantığı, sözel akıl yürütme, sözel problem çözme varsa → Sözel Mantık
- Eğitim, öğretim yöntemleri, eğitim programları, eğitim psikolojisi, öğrenme teorileri varsa → Eğitim Bilimleri
- Çocuk gelişimi, ergen gelişimi, bilişsel gelişim, sosyal gelişim, gelişim psikolojisi varsa → Gelişim
- Din, ahlak, islam, kur'an, ibadet, din kültürü varsa → Din Kültürü ve Ahlak Bilgisi
- Anaokulu, kreş, erken çocukluk, okul öncesi eğitim varsa → Okul Öncesi
- Rehberlik, psikolojik danışmanlık, mesleki rehberlik, eğitsel rehberlik varsa → Rehberlik
- Sınıf öğretmenliği, ilkokul, sınıf yönetimi, ilkokul öğretmenliği varsa → Sınıf Öğretmenliği
- English, ingilizce kelime, ingilizce dilbilgisi, ingilizce okuma/yazma varsa → İngilizce
- German, almanca kelime, almanca dilbilgisi, almanca okuma/yazma varsa → Almanca
- Italian, italyanca kelime, italyanca dilbilgisi, italyanca okuma/yazma varsa → İtalyanca
- Arabic, arapça kelime, arapça dilbilgisi, arapça okuma/yazma varsa → Arapça

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
            temperature: 0.05, // Daha deterministik sonuçlar için düşürüldü
            maxOutputTokens: 50, // Thinking modu olmadığı için 50 yeterli
            // responseMimeType v1 API'de desteklenmiyor, kaldırıldı
          },
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Finish reason kontrolü
    const finishReason = data.candidates?.[0]?.finishReason;
    const candidate = data.candidates?.[0];
    
    // JSON yanıtını parse et
    let detectedSubject: string | null = null;
    
    try {
      // Content ve parts kontrolü
      if (!candidate?.content?.parts || candidate.content.parts.length === 0) {
        return null;
      }
      
      // Önce JSON formatında yanıt gelmiş mi kontrol et
      let responseText = candidate.content.parts[0]?.text?.trim() || "";
      
      if (!responseText) {
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
      
      if (responseText) {
        // Önce JSON formatında mı kontrol et
        if (responseText.trim().startsWith("{")) {
          try {
            // JSON parse et
            const parsedResponse = JSON.parse(responseText);
            detectedSubject = parsedResponse.ders || parsedResponse.subject || null;
          } catch (jsonError) {
            // JSON parse başarısız, direkt metin olarak al
            detectedSubject = responseText.replace(/[{}"']/g, "").split(":")[1]?.trim() || responseText.trim();
          }
        } else {
          // Direkt metin formatında, sadece ders adı
          detectedSubject = responseText.trim();
        }
      }
    } catch (parseError) {
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
      
      // Eğer normalize edilemediyse, AI'dan gelen yanıtı daha agresif şekilde kontrol et
      if (normalized === "Bilinmeyen" && detectedSubject) {
        // Direkt olarak bazı yaygın varyasyonları kontrol et
        const lowerDetected = detectedSubject.toLowerCase().trim();
        
        // Beden Eğitimi için agresif kontrol
        if (lowerDetected.includes("beden") || lowerDetected.includes("spor") || 
            lowerDetected.includes("jimnastik") || lowerDetected.includes("atletizm") ||
            lowerDetected.includes("futbol") || lowerDetected.includes("basketbol") ||
            lowerDetected.includes("egzersiz") || lowerDetected.includes("antrenman") ||
            lowerDetected.includes("fitness") || lowerDetected.includes("motor") ||
            lowerDetected.includes("koordinasyon")) {
          return "Beden Eğitimi";
        }
        
        // Matematik için agresif kontrol
        if (lowerDetected.includes("math") || lowerDetected.includes("matematik") ||
            lowerDetected.includes("sayı") || lowerDetected.includes("sayi") ||
            lowerDetected.includes("denklem") || lowerDetected.includes("işlem") ||
            lowerDetected.includes("islem")) {
          return "Matematik";
        }
      }
      
      return normalized;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}


/**
 * Ders adını normalize eder (büyük/küçük harf, boşluk vb.)
 */
function normalizeSubjectName(subject: string): string {
  if (!subject) {
    return "Bilinmeyen";
  }
  
  const lowerSubject = subject.toLowerCase().trim();
  
  // ÖNCE anahtar kelimelere göre eşleştir (daha kapsamlı ve güvenilir)
  // ÖNEMLİ: Beden Eğitimi ve Geometri gibi özel durumlar için öncelik ver
  const prioritySubjects = ["Beden Eğitimi", "Geometri", "Sayısal Mantık", "Sözel Mantık"];
  
  // Önce öncelikli dersleri kontrol et
  for (const prioritySubject of prioritySubjects) {
    const keywords = SUBJECT_KEYWORDS[prioritySubject];
    if (keywords && keywords.some((keyword) => lowerSubject.includes(keyword))) {
      return prioritySubject;
    }
  }
  
  // Sonra diğer dersleri kontrol et
  for (const [subjectName, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    if (prioritySubjects.includes(subjectName)) continue; // Zaten kontrol edildi
    
    if (keywords.some((keyword) => lowerSubject.includes(keyword))) {
      return subjectName;
    }
  }
  
  // Sonra direkt eşleşme kontrolü (tam eşleşme veya çok benzer ise)
  const subjectNames = Object.keys(SUBJECT_KEYWORDS);
  for (const name of subjectNames) {
    const lowerName = name.toLowerCase();
    // Tam eşleşme kontrolü
    if (lowerSubject === lowerName) {
      return name;
    }
    // Çok benzer ise (örneğin "beden eğitimi" vs "beden eğitimi")
    if (lowerSubject.includes(lowerName) && lowerName.length > 5) {
      return name;
    }
  }
  
  // Beden Eğitimi için özel kontrol (ÇOK ERKEN - diğer kontrollerden önce)
  // AI bazen "beden", "spor", "jimnastik" gibi kelimeleri döndürebilir
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
  
  // Matematik için özel kontrol (Geometri'den ÖNCE - çünkü geometri matematik altında)
  // Ama Geometri spesifik terimlerle gelirse öncelik Geometri'ye verilmeli
  // Önce genel matematik terimlerini kontrol et
  if (lowerSubject.includes("math") || lowerSubject.includes("matematik") || 
      lowerSubject.includes("mathematics") || lowerSubject.includes("mat ") ||
      (lowerSubject.includes("mat") && !lowerSubject.includes("matematiksel mantık") && !lowerSubject.includes("matematiksel mantik"))) {
    // Eğer geometri spesifik terimleri varsa Geometri döndür
    if (lowerSubject.includes("geometri") || lowerSubject.includes("geometrik") ||
        lowerSubject.includes("üçgen") || lowerSubject.includes("ucgen") ||
        lowerSubject.includes("dörtgen") || lowerSubject.includes("dortgen") ||
        lowerSubject.includes("çember") || lowerSubject.includes("cember") ||
        lowerSubject.includes("açı") || lowerSubject.includes("aci")) {
      return "Geometri";
    }
    return "Matematik";
  }
  
  // Sayı, rakam, işlem gibi temel matematik terimleri
  if ((lowerSubject.includes("sayı") || lowerSubject.includes("sayi") || lowerSubject.includes("rakam") ||
       lowerSubject.includes("denklem") || lowerSubject.includes("equation") ||
       lowerSubject.includes("fonksiyon") || lowerSubject.includes("function") ||
       lowerSubject.includes("toplama") || lowerSubject.includes("çıkarma") || lowerSubject.includes("cikarma") ||
       lowerSubject.includes("çarpma") || lowerSubject.includes("carpma") || lowerSubject.includes("bölme") || lowerSubject.includes("bolme") ||
       lowerSubject.includes("işlem") || lowerSubject.includes("islem") || lowerSubject.includes("hesaplama") ||
       lowerSubject.includes("formül") || lowerSubject.includes("formul") || lowerSubject.includes("formula")) &&
      !lowerSubject.includes("sayısal mantık") && !lowerSubject.includes("sayisal mantik") &&
      !lowerSubject.includes("sözel") && !lowerSubject.includes("sozel")) {
    // Geometri terimleri varsa Geometri
    if (lowerSubject.includes("geometri") || lowerSubject.includes("geometrik") ||
        lowerSubject.includes("üçgen") || lowerSubject.includes("ucgen") ||
        lowerSubject.includes("dörtgen") || lowerSubject.includes("dortgen") ||
        lowerSubject.includes("çember") || lowerSubject.includes("cember") ||
        lowerSubject.includes("açı") || lowerSubject.includes("aci")) {
      return "Geometri";
    }
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
    // Edebiyat içeriyorsa Edebiyat, yoksa Türkçe
    if (lowerSubject.includes("edebiyat") || lowerSubject.includes("şiir") || 
        lowerSubject.includes("roman") || lowerSubject.includes("hikaye") ||
        lowerSubject.includes("öykü") || lowerSubject.includes("deneme") ||
        lowerSubject.includes("tiyatro") || lowerSubject.includes("şair") ||
        lowerSubject.includes("yazar")) {
      return "Edebiyat";
    }
    return "Türkçe";
  }
  // Tarih için daha kapsamlı kontrol (Beden Eğitimi zaten yukarıda kontrol edildi - "devlet" kelimesi çok genel, daha spesifik kontrol)
  if (lowerSubject.includes("history") || lowerSubject.includes("tarih") || 
      lowerSubject.includes("osmanlı") || lowerSubject.includes("osmanli") ||
      lowerSubject.includes("göktürk") || lowerSubject.includes("gokturk") ||
      lowerSubject.includes("uygur") || lowerSubject.includes("cumhuriyet") ||
      lowerSubject.includes("savaş") || lowerSubject.includes("savas") ||
      (lowerSubject.includes("devlet") && !lowerSubject.includes("beden") && !lowerSubject.includes("spor")) ||
      lowerSubject.includes("medeniyet") ||
      lowerSubject.includes("selçuklu") || lowerSubject.includes("selcuklu") ||
      lowerSubject.includes("padişah") || lowerSubject.includes("padisah") ||
      lowerSubject.includes("imparatorluk") || lowerSubject.includes("beylik") ||
      lowerSubject.includes("sultan") || lowerSubject.includes("fetih") ||
      lowerSubject.includes("antlaşma") || lowerSubject.includes("antlasma") ||
      lowerSubject.includes("inkılap") || lowerSubject.includes("inkilap")) {
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
  // Geometri için kontrol
  if (lowerSubject.includes("geometri") || lowerSubject.includes("geometrik") ||
      lowerSubject.includes("açı") || lowerSubject.includes("üçgen") ||
      lowerSubject.includes("dörtgen") || lowerSubject.includes("çember") ||
      lowerSubject.includes("daire") || lowerSubject.includes("alan") ||
      lowerSubject.includes("çevre") || lowerSubject.includes("hacim") ||
      lowerSubject.includes("koordinat") || lowerSubject.includes("vektör") ||
      lowerSubject.includes("prizma") || lowerSubject.includes("piramit") ||
      lowerSubject.includes("küre") || lowerSubject.includes("silindir") ||
      lowerSubject.includes("koni")) {
    return "Geometri";
  }
  // Sayısal Mantık için kontrol
  if (lowerSubject.includes("sayısal mantık") || lowerSubject.includes("sayisal mantik") ||
      (lowerSubject.includes("sayısal") && lowerSubject.includes("mantık")) ||
      (lowerSubject.includes("sayisal") && lowerSubject.includes("mantik")) ||
      lowerSubject.includes("sayı dizileri") || lowerSubject.includes("sayi dizileri") ||
      lowerSubject.includes("sayı bulmacaları") || lowerSubject.includes("sayi bulmacalari") ||
      lowerSubject.includes("matematiksel mantık") || lowerSubject.includes("matematiksel mantik") ||
      lowerSubject.includes("sayısal akıl yürütme") || lowerSubject.includes("sayisal akil yurutme") ||
      lowerSubject.includes("sayısal problem") || lowerSubject.includes("sayisal problem") ||
      lowerSubject.includes("sayısal test") || lowerSubject.includes("sayisal test") ||
      lowerSubject.includes("sayısal yetenek") || lowerSubject.includes("sayisal yetenek") ||
      lowerSubject.includes("sayısal düşünme") || lowerSubject.includes("sayisal dusunme") ||
      lowerSubject.includes("sayısal zeka") || lowerSubject.includes("sayisal zeka") ||
      lowerSubject.includes("sayısal beceri") || lowerSubject.includes("sayisal beceri") ||
      lowerSubject.includes("sayısal analiz") || lowerSubject.includes("sayisal analiz") ||
      lowerSubject.includes("sayısal çıkarım") || lowerSubject.includes("sayisal cikarim") ||
      lowerSubject.includes("sayısal muhakeme") || lowerSubject.includes("sayisal muhakeme") ||
      lowerSubject.includes("sayısal bulmaca") || lowerSubject.includes("sayisal bulmaca") ||
      lowerSubject.includes("sayısal oyun") || lowerSubject.includes("sayisal oyun") ||
      lowerSubject.includes("sayısal sıralama") || lowerSubject.includes("sayisal siralam") ||
      lowerSubject.includes("sayısal ilişki") || lowerSubject.includes("sayisal iliski") ||
      lowerSubject.includes("sayısal desen") || lowerSubject.includes("sayisal desen") ||
      lowerSubject.includes("sayısal kural") || lowerSubject.includes("sayisal kural")) {
    return "Sayısal Mantık";
  }
  // Sözel Mantık için kontrol
  if (lowerSubject.includes("sözel mantık") || lowerSubject.includes("sozel mantik") ||
      (lowerSubject.includes("sözel") && lowerSubject.includes("mantık")) ||
      (lowerSubject.includes("sozel") && lowerSubject.includes("mantik")) ||
      lowerSubject.includes("kelime ilişkileri") || lowerSubject.includes("kelime iliskileri") ||
      lowerSubject.includes("cümle mantığı") || lowerSubject.includes("cumle mantigi") ||
      lowerSubject.includes("paragraf mantığı") || lowerSubject.includes("paragraf mantigi") ||
      lowerSubject.includes("metin analizi") || lowerSubject.includes("sözel akıl yürütme") ||
      lowerSubject.includes("sozel akil yurutme") || lowerSubject.includes("sözel problem") ||
      lowerSubject.includes("sozel problem") || lowerSubject.includes("sözel test") ||
      lowerSubject.includes("sozel test") || lowerSubject.includes("sözel yetenek") ||
      lowerSubject.includes("sozel yetenek") || lowerSubject.includes("sözel düşünme") ||
      lowerSubject.includes("sozel dusunme") || lowerSubject.includes("sözel bulmaca") ||
      lowerSubject.includes("sozel bulmaca") || lowerSubject.includes("sözel zeka") ||
      lowerSubject.includes("sozel zeka") || lowerSubject.includes("sözel beceri") ||
      lowerSubject.includes("sozel beceri") || lowerSubject.includes("sözel analiz") ||
      lowerSubject.includes("sozel analiz") || lowerSubject.includes("sözel çıkarım") ||
      lowerSubject.includes("sozel cikarim") || lowerSubject.includes("sözel muhakeme") ||
      lowerSubject.includes("sozel muhakeme") || lowerSubject.includes("sözel oyun") ||
      lowerSubject.includes("sozel oyun") || lowerSubject.includes("sözel sıralama") ||
      lowerSubject.includes("sozel siralam") || lowerSubject.includes("sözel ilişki") ||
      lowerSubject.includes("sozel iliski") || lowerSubject.includes("sözel desen") ||
      lowerSubject.includes("sozel desen") || lowerSubject.includes("sözel kural") ||
      lowerSubject.includes("sozel kural") || lowerSubject.includes("kelime bulmacası") ||
      lowerSubject.includes("kelime bulmacasi") || lowerSubject.includes("cümle tamamlama") ||
      lowerSubject.includes("cumle tamamlama") || lowerSubject.includes("paragraf tamamlama") ||
      lowerSubject.includes("metin tamamlama")) {
    return "Sözel Mantık";
  }
  // Geometri için kontrol (Matematik'ten önce kontrol edilmeli)
  if (lowerSubject.includes("geometri") || lowerSubject.includes("geometrik") ||
      lowerSubject.includes("açı") || lowerSubject.includes("aci") ||
      lowerSubject.includes("üçgen") || lowerSubject.includes("ucgen") ||
      lowerSubject.includes("dörtgen") || lowerSubject.includes("dortgen") ||
      lowerSubject.includes("çember") || lowerSubject.includes("cember") ||
      lowerSubject.includes("daire") || lowerSubject.includes("alan") ||
      lowerSubject.includes("çevre") || lowerSubject.includes("cevre") ||
      lowerSubject.includes("hacim") || lowerSubject.includes("koordinat") ||
      lowerSubject.includes("vektör") || lowerSubject.includes("vektor") ||
      lowerSubject.includes("prizma") || lowerSubject.includes("piramit") ||
      lowerSubject.includes("küre") || lowerSubject.includes("kure") ||
      lowerSubject.includes("silindir") || lowerSubject.includes("koni")) {
    return "Geometri";
  }
  // Eğitim Bilimleri için kontrol
  if (lowerSubject.includes("eğitim bilimleri") || lowerSubject.includes("egitim bilimleri") ||
      (lowerSubject.includes("eğitim") && lowerSubject.includes("bilim")) ||
      (lowerSubject.includes("egitim") && lowerSubject.includes("bilim")) ||
      lowerSubject.includes("eğitim psikolojisi") || lowerSubject.includes("egitim psikolojisi") ||
      lowerSubject.includes("öğretim yöntemleri") || lowerSubject.includes("ogretim yontemleri") ||
      lowerSubject.includes("eğitim programları") || lowerSubject.includes("egitim programlari") ||
      lowerSubject.includes("eğitim felsefesi") || lowerSubject.includes("egitim felsefesi") ||
      lowerSubject.includes("öğrenme teorileri") || lowerSubject.includes("ogrenme teorileri") ||
      lowerSubject.includes("eğitim yönetimi") || lowerSubject.includes("egitim yonetimi")) {
    return "Eğitim Bilimleri";
  }
  // Gelişim için kontrol
  if (lowerSubject.includes("gelişim") || lowerSubject.includes("gelisim") ||
      lowerSubject.includes("gelişim psikolojisi") || lowerSubject.includes("gelisim psikolojisi") ||
      lowerSubject.includes("çocuk gelişimi") || lowerSubject.includes("cocuk gelisimi") ||
      lowerSubject.includes("ergen gelişimi") || lowerSubject.includes("ergen gelisimi") ||
      lowerSubject.includes("bilişsel gelişim") || lowerSubject.includes("bilissel gelisim") ||
      lowerSubject.includes("sosyal gelişim") || lowerSubject.includes("sosyal gelisim") ||
      lowerSubject.includes("duygusal gelişim") || lowerSubject.includes("duygusal gelisim") ||
      lowerSubject.includes("fiziksel gelişim") || lowerSubject.includes("fiziksel gelisim") ||
      lowerSubject.includes("dil gelişimi") || lowerSubject.includes("dil gelisimi") ||
      lowerSubject.includes("ahlak gelişimi") || lowerSubject.includes("ahlak gelisimi") ||
      lowerSubject.includes("kişilik gelişimi") || lowerSubject.includes("kisilik gelisimi") ||
      lowerSubject.includes("motor gelişim") || lowerSubject.includes("motor gelisim") ||
      lowerSubject.includes("gelişim dönemleri") || lowerSubject.includes("gelisim donemleri") ||
      lowerSubject.includes("gelişim teorileri") || lowerSubject.includes("gelisim teorileri")) {
    return "Gelişim";
  }
  // Din Kültürü ve Ahlak Bilgisi için kontrol
  if (lowerSubject.includes("din kültürü") || lowerSubject.includes("din kulturu") ||
      lowerSubject.includes("din kültürü ve ahlak bilgisi") || lowerSubject.includes("din kulturu ve ahlak bilgisi") ||
      (lowerSubject.includes("din") && lowerSubject.includes("ahlak")) ||
      lowerSubject.includes("islam") || lowerSubject.includes("kur'an") ||
      lowerSubject.includes("kuran") || lowerSubject.includes("hadis") ||
      lowerSubject.includes("peygamber") || lowerSubject.includes("ibadet") ||
      lowerSubject.includes("namaz") || lowerSubject.includes("oruç") ||
      lowerSubject.includes("oruc") || lowerSubject.includes("zekat") ||
      lowerSubject.includes("hac") || lowerSubject.includes("din bilgisi") ||
      lowerSubject.includes("din eğitimi") || lowerSubject.includes("din egitimi") ||
      lowerSubject.includes("islam tarihi") || lowerSubject.includes("islam kulturu") ||
      lowerSubject.includes("ahlak eğitimi") || lowerSubject.includes("ahlak egitimi") ||
      lowerSubject.includes("değerler eğitimi") || lowerSubject.includes("degerler egitimi")) {
    return "Din Kültürü ve Ahlak Bilgisi";
  }
  // Okul Öncesi için kontrol
  if (lowerSubject.includes("okul öncesi") || lowerSubject.includes("okul oncesi") ||
      lowerSubject.includes("anaokulu") || lowerSubject.includes("kreş") ||
      lowerSubject.includes("kres") || lowerSubject.includes("erken çocukluk") ||
      lowerSubject.includes("erken cocukluk") || lowerSubject.includes("okul öncesi eğitim") ||
      lowerSubject.includes("okul oncesi egitim") || lowerSubject.includes("anaokulu eğitimi") ||
      lowerSubject.includes("anaokulu egitimi") || lowerSubject.includes("erken çocukluk eğitimi") ||
      lowerSubject.includes("erken cocukluk egitimi") || lowerSubject.includes("okul öncesi program") ||
      lowerSubject.includes("okul oncesi program") || lowerSubject.includes("okul öncesi öğretmenliği") ||
      lowerSubject.includes("okul oncesi ogretmenligi")) {
    return "Okul Öncesi";
  }
  // Rehberlik için kontrol
  if (lowerSubject.includes("rehberlik") ||
      lowerSubject.includes("psikolojik danışmanlık") || lowerSubject.includes("psikolojik danismanlik") ||
      lowerSubject.includes("rehberlik ve psikolojik danışmanlık") || lowerSubject.includes("rehberlik ve psikolojik danismanlik") ||
      lowerSubject.includes("rehberlik hizmetleri") || lowerSubject.includes("mesleki rehberlik") ||
      lowerSubject.includes("eğitsel rehberlik") || lowerSubject.includes("egitsel rehberlik") ||
      lowerSubject.includes("kişisel rehberlik") || lowerSubject.includes("kisisel rehberlik") ||
      lowerSubject.includes("rehberlik programı") || lowerSubject.includes("rehberlik programi") ||
      lowerSubject.includes("rehberlik testleri") || lowerSubject.includes("rehberlik teknikleri") ||
      lowerSubject.includes("rehberlik yaklaşımları") || lowerSubject.includes("rehberlik yaklasimlari") ||
      lowerSubject.includes("rehberlik modelleri") || lowerSubject.includes("rehberlik kuramları") ||
      lowerSubject.includes("rehberlik kuramlari")) {
    return "Rehberlik";
  }
  // Sınıf Öğretmenliği için kontrol
  if (lowerSubject.includes("sınıf öğretmenliği") || lowerSubject.includes("sinif ogretmenligi") ||
      lowerSubject.includes("sınıf öğretmeni") || lowerSubject.includes("sinif ogretmeni") ||
      lowerSubject.includes("ilkokul") || lowerSubject.includes("ilkokul öğretmenliği") ||
      lowerSubject.includes("ilkokul ogretmenligi") || lowerSubject.includes("sınıf öğretmeni eğitimi") ||
      lowerSubject.includes("sinif ogretmeni egitimi") || lowerSubject.includes("sınıf yönetimi") ||
      lowerSubject.includes("sinif yonetimi") || lowerSubject.includes("sınıf içi öğretim") ||
      lowerSubject.includes("sinif ici ogretim") || lowerSubject.includes("sınıf öğretmenliği programı") ||
      lowerSubject.includes("sinif ogretmenligi programi") || lowerSubject.includes("ilkokul programı") ||
      lowerSubject.includes("ilkokul programi")) {
    return "Sınıf Öğretmenliği";
  }
  // İngilizce için kontrol
  if (lowerSubject.includes("ingilizce") || lowerSubject.includes("english") ||
      lowerSubject.includes("ingiliz dili") || lowerSubject.includes("ingiliz dili ve edebiyatı") ||
      lowerSubject.includes("ingiliz dili ve edebiyati") || lowerSubject.includes("ingilizce dilbilgisi") ||
      lowerSubject.includes("ingilizce kelime") || lowerSubject.includes("ingilizce okuma") ||
      lowerSubject.includes("ingilizce yazma") || lowerSubject.includes("ingilizce konuşma") ||
      lowerSubject.includes("ingilizce konusma") || lowerSubject.includes("ingilizce dinleme") ||
      lowerSubject.includes("ingilizce test") || lowerSubject.includes("ingilizce sınav") ||
      lowerSubject.includes("ingilizce sinav") || (lowerSubject.includes("yabancı dil") && lowerSubject.includes("ingilizce")) ||
      (lowerSubject.includes("yabanci dil") && lowerSubject.includes("ingilizce"))) {
    return "İngilizce";
  }
  // Almanca için kontrol
  if (lowerSubject.includes("almanca") || lowerSubject.includes("german") ||
      lowerSubject.includes("alman dili") || lowerSubject.includes("alman dili ve edebiyatı") ||
      lowerSubject.includes("alman dili ve edebiyati") || lowerSubject.includes("almanca dilbilgisi") ||
      lowerSubject.includes("almanca kelime") || lowerSubject.includes("almanca okuma") ||
      lowerSubject.includes("almanca yazma") || lowerSubject.includes("almanca konuşma") ||
      lowerSubject.includes("almanca konusma") || lowerSubject.includes("almanca dinleme") ||
      lowerSubject.includes("almanca test") || lowerSubject.includes("almanca sınav") ||
      lowerSubject.includes("almanca sinav") || (lowerSubject.includes("yabancı dil") && lowerSubject.includes("almanca")) ||
      (lowerSubject.includes("yabanci dil") && lowerSubject.includes("almanca"))) {
    return "Almanca";
  }
  // İtalyanca için kontrol
  if (lowerSubject.includes("italyanca") || lowerSubject.includes("italian") ||
      lowerSubject.includes("italyan dili") || lowerSubject.includes("italyan dili ve edebiyatı") ||
      lowerSubject.includes("italyan dili ve edebiyati") || lowerSubject.includes("italyanca dilbilgisi") ||
      lowerSubject.includes("italyanca kelime") || lowerSubject.includes("italyanca okuma") ||
      lowerSubject.includes("italyanca yazma") || lowerSubject.includes("italyanca konuşma") ||
      lowerSubject.includes("italyanca konusma") || lowerSubject.includes("italyanca dinleme") ||
      lowerSubject.includes("italyanca test") || lowerSubject.includes("italyanca sınav") ||
      lowerSubject.includes("italyanca sinav") || (lowerSubject.includes("yabancı dil") && lowerSubject.includes("italyanca")) ||
      (lowerSubject.includes("yabanci dil") && lowerSubject.includes("italyanca"))) {
    return "İtalyanca";
  }
  // Arapça için kontrol
  if (lowerSubject.includes("arapça") || lowerSubject.includes("arapca") || lowerSubject.includes("arabic") ||
      lowerSubject.includes("arap dili") || lowerSubject.includes("arap dili ve edebiyatı") ||
      lowerSubject.includes("arap dili ve edebiyati") || lowerSubject.includes("arapça dilbilgisi") ||
      lowerSubject.includes("arapca dilbilgisi") || lowerSubject.includes("arapça kelime") ||
      lowerSubject.includes("arapca kelime") || lowerSubject.includes("arapça okuma") ||
      lowerSubject.includes("arapca okuma") || lowerSubject.includes("arapça yazma") ||
      lowerSubject.includes("arapca yazma") || lowerSubject.includes("arapça konuşma") ||
      lowerSubject.includes("arapca konusma") || lowerSubject.includes("arapça dinleme") ||
      lowerSubject.includes("arapca dinleme") || lowerSubject.includes("arapça test") ||
      lowerSubject.includes("arapca test") || lowerSubject.includes("arapça sınav") ||
      lowerSubject.includes("arapca sinav") || (lowerSubject.includes("yabancı dil") && lowerSubject.includes("arapça")) ||
      (lowerSubject.includes("yabanci dil") && lowerSubject.includes("arapca"))) {
    return "Arapça";
  }
  
  return "Bilinmeyen";
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl gerekli" }, { status: 400 });
    }

    // AI servisi ile ders tespiti (Firestore ayarlarına göre)
    const subject = await detectSubject(imageUrl);
    
    if (!subject || subject === "Bilinmeyen") {
      return NextResponse.json({ subject: "Bilinmeyen" });
    }

    return NextResponse.json({ subject });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Ders tespit edilemedi" },
      { status: 500 }
    );
  }
}

