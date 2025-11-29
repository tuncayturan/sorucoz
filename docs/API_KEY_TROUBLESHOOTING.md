# API Key Sorun Giderme - Detaylı Rehber

## 401 Unauthorized Hatası Hala Devam Ediyorsa

### 1. Terminal Loglarını Kontrol Edin

Server terminal'inde şu logları arayın:
```
❌ Gemini API Hatası: { status: 401, error: {...} }
❌ API Key Hatası Detayları: { ... }
```

Bu loglar tam hata mesajını gösterecektir.

### 2. API Key Formatını Kontrol Edin

PowerShell'de kontrol edin:
```powershell
Get-Content .env.local | Select-String "GEMINI"
```

**Doğru format:**
```
GEMINI_API_KEY=AIzaSyBBchDMoNpxWlhsEMPkwek9yF_yETFBXwg
```

**Yanlış formatlar:**
- ❌ `GEMINI_API_KEY = AIzaSy...` (boşluk var)
- ❌ `GEMINI_API_KEY="AIzaSy..."` (tırnak var)
- ❌ `GEMINI_API_KEY='AIzaSy...'` (tırnak var)
- ❌ `GEMINI_API_KEY=AIzaSy...` (sonunda boşluk var)

### 3. Server'ı Tamamen Yeniden Başlatın

1. **Terminal'de server'ı durdurun:** `Ctrl+C`
2. **Tüm terminal pencerelerini kapatın**
3. **Yeni terminal açın**
4. **Proje dizinine gidin:** `cd D:\sorucozapp`
5. **Server'ı başlatın:** `npm run dev`

### 4. API Key'in Doğru Olduğundan Emin Olun

1. **Google AI Studio'ya gidin:**
   - https://aistudio.google.com/app/apikey

2. **API key'in durumunu kontrol edin:**
   - "Enabled" olmalı
   - "Restrictions" varsa kaldırın (test için)

3. **Yeni bir API key oluşturun:**
   - Eski key'i silin
   - "Create API Key" tıklayın
   - Yeni key'i kopyalayın

### 5. .env.local Dosyasını Temizleyin

1. **Dosyayı açın**
2. **GEMINI_API_KEY satırını bulun**
3. **Sadece şu satırı bırakın (diğer her şeyi silin):**
   ```
   GEMINI_API_KEY=YENI_API_KEY_BURAYA
   ```
4. **Kaydedin**
5. **Server'ı yeniden başlatın**

### 6. API Key Uzunluğunu Kontrol Edin

Gemini API key'leri genellikle 39 karakter civarındadır. PowerShell'de kontrol edin:
```powershell
$key = (Get-Content .env.local | Select-String "GEMINI").ToString().Split('=')[1]
Write-Host "API Key uzunluğu: $($key.Length)"
```

### 7. Gemini API'nin Etkin Olduğundan Emin Olun

1. **Google Cloud Console'a gidin:**
   - https://console.cloud.google.com

2. **Projenizi seçin**

3. **"APIs & Services" > "Library" gidin**

4. **"Generative Language API" arayın**

5. **"Enable" butonuna tıklayın**

### 8. Test API Key'i

Terminal'de test edin (PowerShell):
```powershell
$apiKey = (Get-Content .env.local | Select-String "GEMINI").ToString().Split('=')[1].Trim()
$testUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey"
Write-Host "Test URL: $testUrl"
```

### 9. Alternatif: API Key'i Doğrudan Test Edin

Postman veya curl ile test edin:
```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Merhaba"
      }]
    }]
  }'
```

### 10. Son Çare: Farklı Bir API Key Oluşturun

1. **Farklı bir Google hesabı kullanın** (eğer mümkünse)
2. **Yeni bir proje oluşturun**
3. **Yeni API key oluşturun**
4. **Test edin**

## Hata Mesajları ve Anlamları

- **401 Unauthorized:** API key geçersiz veya yetkisiz
- **400 Bad Request:** API key formatı yanlış veya istek formatı hatalı
- **403 Forbidden:** API key'in yetkisi yok (Gemini API etkin değil)
- **429 Too Many Requests:** Rate limit veya quota aşıldı

## Terminal'de Görmeniz Gerekenler

**Başarılı:**
```
✅ POST Handler: GEMINI_API_KEY mevcut, uzunluk: 39
🔑 API Key kullanılıyor, başlangıç: AIzaSy..., uzunluk: 39
✅ Gemini API yanıtı alındı
```

**Hata:**
```
❌ Gemini API Hatası: { status: 401, error: {...} }
❌ API Key Hatası Detayları: { ... }
```

Bu logları paylaşırsanız daha hızlı çözebiliriz!

