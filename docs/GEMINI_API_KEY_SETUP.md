# Gemini API Key Doğru Kurulum Rehberi

## 401 Unauthorized Hatası Çözümü

Bu hata, API key'in geçersiz veya yetkisiz olduğunu gösterir.

## Adım 1: Yeni API Key Oluşturun

1. **Google AI Studio'ya gidin:**
   - https://makersuite.google.com/app/apikey
   - Veya: https://aistudio.google.com/app/apikey

2. **Google hesabınızla giriş yapın**

3. **"Create API Key" butonuna tıklayın**

4. **Proje seçin veya yeni proje oluşturun:**
   - Mevcut bir proje varsa seçin
   - Yoksa "Create API key in new project" seçin

5. **API key'i kopyalayın:**
   - API key genellikle `AIzaSy` ile başlar
   - Tamamını kopyalayın (39 karakter civarı)

## Adım 2: .env.local Dosyasını Güncelleyin

1. **Proje kök dizininde `.env.local` dosyasını açın**

2. **Eski API key'i silin ve yenisini ekleyin:**
   ```env
   GEMINI_API_KEY=AIzaSyYENI_API_KEY_BURAYA
   ```

3. **ÖNEMLİ:**
   - `=` işaretinden önce ve sonra **BOŞLUK OLMAMALI**
   - Tırnak işareti (`"` veya `'`) kullanmayın
   - API key'in tamamını kopyaladığınızdan emin olun

## Adım 3: Development Server'ı Yeniden Başlatın

1. Terminal'de `Ctrl+C` ile server'ı durdurun
2. `npm run dev` ile tekrar başlatın

## Adım 4: API Key'i Test Edin

1. Bir soru yükleyin
2. Terminal'de şu logları görmelisiniz:
   - `✅ POST Handler: GEMINI_API_KEY mevcut, uzunluk: 39`
   - `✅ GEMINI_API_KEY okundu, başlangıç: AIzaSy...`

## Yaygın Hatalar

### 1. API Key Formatı Yanlış
- ❌ `GEMINI_API_KEY="AIzaSy..."` (tırnak işareti var)
- ✅ `GEMINI_API_KEY=AIzaSy...` (tırnak işareti yok)

### 2. Boşluk Var
- ❌ `GEMINI_API_KEY = AIzaSy...` (boşluk var)
- ✅ `GEMINI_API_KEY=AIzaSy...` (boşluk yok)

### 3. API Key Eksik
- ❌ API key'in sonu kesilmiş
- ✅ Tam API key'i kopyalayın

### 4. Server Yeniden Başlatılmamış
- ❌ `.env.local` güncellendi ama server yeniden başlatılmadı
- ✅ Server'ı mutlaka yeniden başlatın

## API Key Kontrolü

PowerShell'de kontrol edin:
```powershell
Get-Content .env.local | Select-String "GEMINI"
```

Çıktı şöyle olmalı:
```
GEMINI_API_KEY=AIzaSyBBchDMoNpxWlhsEMPkwek9yF_yETFBXwg
```

## Hala Çalışmıyorsa

1. **API Key'in aktif olduğundan emin olun:**
   - Google AI Studio'da API key'in durumunu kontrol edin
   - "Enabled" olmalı

2. **API Key'in doğru projede olduğundan emin olun:**
   - Google Cloud Console'da projeyi kontrol edin
   - Gemini API'nin etkin olduğundan emin olun

3. **Yeni bir API key oluşturun:**
   - Eski key'i silin
   - Yeni bir key oluşturun
   - `.env.local`'e ekleyin
   - Server'ı yeniden başlatın

## Gemini API Limitleri

- **Ücretsiz Tier:** Günde 60 istek
- **Rate Limit:** Dakikada 15 istek
- **Model:** `gemini-1.5-flash` (ücretsiz)

