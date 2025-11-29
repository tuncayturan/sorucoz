# Gemini API Etkinleştirme Adımları

## Önemli Not
Google, "Generative Language API"yi "Gemini API" olarak yeniden adlandırdı. İkisi de aynı API'dir.

## Adım 1: Gemini API'yi Etkinleştirin

1. **Google Cloud Console'a gidin:** https://console.cloud.google.com/apis/library
2. **"Gemini API"** arayın (veya "Generative Language API")
3. **"Gemini API"** sonucuna tıklayın
4. **"ENABLE"** butonuna tıklayın
5. Proje seçmeniz istenirse, projenizi seçin

## Adım 2: API Key Restrictions'ı Kontrol Edin

1. **API Key sayfasına gidin:** https://console.cloud.google.com/apis/credentials
2. API key'inizi bulun ve tıklayın
3. **"API restrictions"** bölümünde:

   **Seçenek A: Test İçin (Önerilen)**
   - ✅ **"Don't restrict key"** seçeneğini seçin
   - Bu, tüm API'lere erişim sağlar

   **Seçenek B: Production İçin**
   - ✅ **"Restrict key"** seçeneğini seçin
   - ✅ **"Select APIs"** dropdown'ından şunlardan birini seçin:
     - **"Gemini API"** (yeni ad)
     - **"Generative Language API"** (eski ad - hala listede olabilir)
   - Her ikisi de aynı API'dir, hangisi listede varsa onu seçin

4. **"Application restrictions"** bölümünde:
   - ✅ **"None"** seçeneğini seçin (test için)

5. **"Save"** butonuna tıklayın
6. ⏳ **5 dakika bekleyin** (ayarların uygulanması için)

## Adım 3: Server'ı Yeniden Başlatın

```bash
# Terminal'de Ctrl+C ile durdurun
# Sonra:
npm run dev
```

## Adım 4: Test Edin

1. Bir soru yükleyin
2. "Soruyu Çöz" butonuna tıklayın
3. Terminal loglarını kontrol edin

## Sorun Devam Ederse

Terminal'deki şu logları paylaşın:
- `❌ Gemini API Hatası:`
- `❌ API Key Hatası Detayları:`
- `errorMessage:`
