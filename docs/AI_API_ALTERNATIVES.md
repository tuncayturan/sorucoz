# Ücretsiz AI API Alternatifleri

## Önerilen Seçenekler

### 1. **Google Gemini API** ⭐ (ÖNERİLEN)
- **Ücretsiz Tier:** Günde 60 istek (yeterli)
- **Görsel Analizi:** Mükemmel (multimodal)
- **Türkçe Desteği:** Çok iyi
- **Hız:** Hızlı
- **Model:** `gemini-pro-vision` veya `gemini-1.5-flash`
- **Avantajlar:**
  - Görselden direkt soru anlama
  - Ders tahmin etme
  - Adım adım çözüm anlatma
  - Ücretsiz tier geniş
- **API Key:** https://makersuite.google.com/app/apikey

### 2. **Groq API**
- **Ücretsiz Tier:** Günde 14,400 istek (çok geniş!)
- **Görsel Analizi:** İyi (Llama Vision modelleri)
- **Türkçe Desteği:** İyi
- **Hız:** Çok hızlı (GPU hızlandırmalı)
- **Model:** `llama-3.2-90b-vision-preview`
- **Avantajlar:**
  - Çok hızlı yanıt
  - Çok geniş ücretsiz tier
  - Görsel analizi destekliyor
- **API Key:** https://console.groq.com

### 3. **Hugging Face Inference API**
- **Ücretsiz Tier:** Sınırsız (rate limit var)
- **Görsel Analizi:** Model'e bağlı
- **Türkçe Desteği:** Model'e bağlı
- **Hız:** Orta
- **Model:** `Qwen/Qwen2-VL-7B-Instruct` veya `llava-hf/llava-1.5-7b-hf`
- **Avantajlar:**
  - Tamamen ücretsiz
  - Açık kaynak modeller
  - Çok sayıda model seçeneği
- **API Key:** https://huggingface.co/settings/tokens

### 4. **Together AI**
- **Ücretsiz Tier:** $25 kredi (yaklaşık 1000 istek)
- **Görsel Analizi:** İyi
- **Türkçe Desteği:** İyi
- **Hız:** Hızlı
- **Model:** `meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo`
- **Avantajlar:**
  - Başlangıç kredisi
  - İyi görsel modeller
- **API Key:** https://api.together.xyz

## Karşılaştırma

| API | Ücretsiz Limit | Görsel Analiz | Türkçe | Hız | Önerilen |
|-----|---------------|---------------|--------|-----|----------|
| **Gemini** | 60/gün | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ |
| **Groq** | 14,400/gün | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ |
| **Hugging Face** | Sınırsız* | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⚠️ |
| **Together AI** | $25 kredi | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ |

*Rate limit var

## Öneri: Google Gemini

Gemini en iyi seçenek çünkü:
1. Görsel analizi mükemmel
2. Ücretsiz tier yeterli (günde 60 istek)
3. Türkçe desteği çok iyi
4. Tek API ile hem ders tespiti hem çözüm
5. Kolay entegrasyon

## Implementasyon

Gemini API entegrasyonu için örnek kod dosyaları oluşturulacak.

