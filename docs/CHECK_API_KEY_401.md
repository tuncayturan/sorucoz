# 401 Unauthorized Hatası - API Key Kontrolü

## Terminal Loglarını Kontrol Edin

Terminal'de şu logları arayın:
- `❌ Gemini API Hatası:`
- `❌ API Key Hatası Detayları:`
- `❌ 401 Unauthorized - API Key geçersiz veya yetkisiz!`

Bu logları paylaşın, böylece tam hatayı görebiliriz.

## Hızlı Kontrol Listesi

### 1. API Key Formatı
```bash
# Terminal'de çalıştırın:
Get-Content .env.local | Select-String "GEMINI"
```

API key şu formatta olmalı:
```
GEMINI_API_KEY=AIzaSy...
```

**Kontrol edin:**
- ✅ Başında/sonunda boşluk yok
- ✅ Tırnak işareti yok (`"` veya `'`)
- ✅ `=` işaretinden sonra direkt API key başlıyor

### 2. Google Cloud Console Ayarları

1. **API Key'i açın:** https://console.cloud.google.com/apis/credentials
2. **"API restrictions" bölümünde:**
   - **"Don't restrict key"** seçeneğini seçin (test için)
   - VEYA
   - **"Restrict key"** seçiliyse, **"Generative Language API"** listede olmalı
3. **"Save"** butonuna tıklayın
4. **5 dakika bekleyin** (ayarların uygulanması için)

### 3. Generative Language API Etkin mi?

1. **API Library'ye gidin:** https://console.cloud.google.com/apis/library
2. **"Generative Language API"** arayın
3. **"ENABLE"** butonuna tıklayın (etkin değilse)

### 4. Server'ı Yeniden Başlatın

```bash
# Terminal'de Ctrl+C ile durdurun
# Sonra tekrar başlatın:
npm run dev
```

### 5. Yeni API Key Oluşturun (Son Çare)

Eğer hala çalışmıyorsa:

1. **Google AI Studio'ya gidin:** https://aistudio.google.com/app/apikey
2. **"Create API Key"** butonuna tıklayın
3. **Yeni API key'i kopyalayın**
4. **`.env.local` dosyasını güncelleyin:**
   ```
   GEMINI_API_KEY=yeni_api_key_buraya
   ```
5. **Server'ı yeniden başlatın**

## Terminal Loglarını Paylaşın

Terminal'deki şu satırları paylaşın:
- `❌ API Key Hatası Detayları:` satırı ve altındaki tüm bilgiler
- `errorMessage:` değeri
- `fullError:` değeri

Bu bilgilerle sorunu daha net görebiliriz.

