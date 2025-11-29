# Gemini API'yi Etkinleştirme Rehberi

## 401 Unauthorized Hatası - Gemini API Etkinleştirme

401 hatası genellikle Gemini API'nin Google Cloud Console'da etkinleştirilmediğini gösterir.

## Adım 1: Google Cloud Console'a Gidin

1. **Google Cloud Console'u açın:**
   - https://console.cloud.google.com

2. **Projenizi seçin:**
   - Üst kısımdaki proje seçiciyi kullanın
   - Proje numaranız: `390832130782`
   - Veya proje adınızı seçin

## Adım 2: Gemini API'yi Etkinleştirin

1. **Sol menüden "APIs & Services" > "Library" seçin**

2. **Arama kutusuna şunu yazın:**
   ```
   Generative Language API
   ```
   veya
   ```
   Gemini API
   ```

3. **"Generative Language API" sonucunu bulun ve tıklayın**

4. **"ENABLE" butonuna tıklayın**

5. **Etkinleştirme işleminin tamamlanmasını bekleyin** (birkaç saniye sürebilir)

## Adım 3: API Key'in Doğru Olduğundan Emin Olun

1. **Google AI Studio'ya gidin:**
   - https://aistudio.google.com/app/apikey

2. **API key'inizin durumunu kontrol edin:**
   - "Enabled" olmalı
   - "Restrictions" varsa, test için kaldırın

## Adım 4: Server'ı Yeniden Başlatın

1. Terminal'de `Ctrl+C` ile server'ı durdurun
2. `npm run dev` ile tekrar başlatın

## Adım 5: Test Edin

1. Bir soru yükleyin
2. Terminal'de şu logları görmelisiniz:
   - `✅ POST Handler: GEMINI_API_KEY mevcut`
   - `🔑 API Key kullanılıyor`
   - `✅ Gemini API yanıtı alındı`

## Alternatif: API Key Restrictions Kontrolü

Eğer API key'inizde restrictions varsa:

1. **Google AI Studio'da API key'inizi açın**
2. **"API restrictions" bölümünü kontrol edin**
3. **"Don't restrict key" seçeneğini seçin** (test için)
4. **"Save" butonuna tıklayın**

## Hala Çalışmıyorsa

1. **Yeni bir API key oluşturun:**
   - Eski key'i silin
   - Yeni key oluşturun
   - `.env.local`'e ekleyin

2. **Farklı bir Google hesabı deneyin** (eğer mümkünse)

3. **Terminal loglarını kontrol edin:**
   - `❌ API Key Hatası Detayları:` satırını bulun
   - Tam hata mesajını paylaşın

## Önemli Notlar

- Gemini API ücretsiz tier için günde 60 istek limiti var
- Rate limit: Dakikada 15 istek
- API key'in aktif olması ve Gemini API'nin etkinleştirilmesi gerekiyor

