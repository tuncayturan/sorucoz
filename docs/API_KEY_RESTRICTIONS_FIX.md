# API Key Restrictions Sorunu Çözümü

## 401 Unauthorized Hatası - Restrictions Kontrolü

Firebase tarafından oluşturulan API key'lerde bazen restrictions sorunları olabilir.

## Adım 1: API Key Restrictions'ını Kontrol Edin

1. **Google Cloud Console'a gidin:**
   - https://console.cloud.google.com/apis/credentials?project=sorucoz-6deb3

2. **"Gemini Developer API key" key'ini bulun**

3. **"Show key" linkine tıklayın**

4. **"Edit API key" (kalem ikonu) tıklayın**

5. **"API restrictions" bölümünü kontrol edin:**
   - Eğer "Restrict key" seçiliyse:
     - "Generative Language API" listede olmalı
     - Eğer yoksa ekleyin
   - Veya test için "Don't restrict key" seçin

6. **"Save" butonuna tıklayın**

## Adım 2: Generative Language API'nin Etkin Olduğundan Emin Olun

1. **Google Cloud Console'da:**
   - https://console.cloud.google.com/apis/library

2. **"Generative Language API" arayın**

3. **"ENABLE" butonuna tıklayın** (eğer etkin değilse)

## Adım 3: Yeni Bir API Key Oluşturun (Alternatif)

Eğer restrictions sorunu devam ediyorsa:

1. **Google AI Studio'ya gidin:**
   - https://aistudio.google.com/app/apikey

2. **"Create API Key" butonuna tıklayın**

3. **Yeni key'i kopyalayın**

4. **`.env.local` dosyasına ekleyin:**
   ```
   GEMINI_API_KEY=YENI_API_KEY_BURAYA
   ```

5. **Server'ı yeniden başlatın**

## Adım 4: Server'ı Yeniden Başlatın

1. Terminal'de `Ctrl+C` ile durdurun
2. `npm run dev` ile tekrar başlatın

## Adım 5: Terminal Loglarını Kontrol Edin

Server başladıktan sonra bir soru çözmeyi deneyin ve terminal'de şu logları arayın:

```
❌ API Key Hatası Detayları: { status: 401, error: {...} }
```

Bu log tam hata mesajını gösterecektir.

## Yaygın Sorunlar

1. **"API key not valid"** → API key yanlış kopyalanmış
2. **"API key restrictions"** → Restrictions'ı kaldırın veya Generative Language API ekleyin
3. **"API not enabled"** → Generative Language API'yi etkinleştirin

## Terminal Loglarını Paylaşın

Terminal'deki `❌ API Key Hatası Detayları:` satırını paylaşırsanız daha hızlı çözebiliriz!

