# 401 Unauthorized Hatası - Çözüm Adımları

## 1. Terminal Loglarını Kontrol Edin

Terminal'de (server-side) şu logları arayın:
```
❌ Gemini API Hatası:
❌ API Key Hatası Detayları:
errorMessage:
```

Bu logları paylaşın.

## 2. Google Cloud Console'da API Key Ayarları

### Adım 1: API Key Sayfasına Gidin
1. https://console.cloud.google.com/apis/credentials adresine gidin
2. API key'inizi bulun ve tıklayın

### Adım 2: API Restrictions Ayarları
**"API restrictions" bölümünde:**

**Seçenek A: Test İçin (Önerilen)**
- ✅ **"Don't restrict key"** seçeneğini seçin
- Bu, tüm API'lere erişim sağlar (test için güvenli)

**Seçenek B: Production İçin**
- ✅ **"Restrict key"** seçeneğini seçin
- ✅ **"Select APIs"** dropdown'ından **"Generative Language API"** seçin
- ✅ Listedeki **"Generative Language API"** seçili olmalı

### Adım 3: Application Restrictions
**"Application restrictions" bölümünde:**
- ✅ **"None"** seçeneğini seçin (test için)
- VEYA IP adresi/domain kısıtlaması yapıyorsanız, localhost'u ekleyin

### Adım 4: Kaydet
- ✅ **"Save"** butonuna tıklayın
- ⏳ **5 dakika bekleyin** (ayarların uygulanması için)

## 3. Generative Language API Etkin mi?

1. https://console.cloud.google.com/apis/library adresine gidin
2. **"Generative Language API"** arayın
3. **"ENABLE"** butonuna tıklayın (etkin değilse)

## 4. Yeni API Key Oluşturun (Son Çare)

Eğer hala çalışmıyorsa:

### Adım 1: Google AI Studio
1. https://aistudio.google.com/app/apikey adresine gidin
2. **"Create API Key"** butonuna tıklayın
3. **"Create API key in new project"** veya mevcut projeyi seçin
4. Yeni API key'i kopyalayın

### Adım 2: .env.local Dosyasını Güncelleyin
```bash
# Eski API key'i silin veya yorum satırı yapın
# GEMINI_API_KEY=eski_key

# Yeni API key'i ekleyin
GEMINI_API_KEY=yeni_api_key_buraya
```

**ÖNEMLİ:**
- ✅ Başında/sonunda boşluk yok
- ✅ Tırnak işareti yok (`"` veya `'`)
- ✅ `=` işaretinden sonra direkt API key başlıyor

### Adım 3: Server'ı Yeniden Başlatın
```bash
# Terminal'de Ctrl+C ile durdurun
# Sonra:
npm run dev
```

## 5. API Key Formatını Kontrol Edin

Terminal'de çalıştırın:
```powershell
Get-Content .env.local | Select-String "GEMINI"
```

Çıktı şöyle olmalı:
```
GEMINI_API_KEY=AIzaSy...
```

**YANLIŞ formatlar:**
```
GEMINI_API_KEY="AIzaSy..."  ❌ (tırnak var)
GEMINI_API_KEY= AIzaSy...   ❌ (boşluk var)
GEMINI_API_KEY = AIzaSy...  ❌ (eşittir öncesi boşluk)
```

## 6. Test Edin

1. Bir soru yükleyin
2. "Soruyu Çöz" butonuna tıklayın
3. Terminal loglarını kontrol edin

## Hala Çalışmıyorsa

Terminal'deki şu logları paylaşın:
- `❌ API Key Hatası Detayları:` satırı ve altındaki tüm bilgiler
- `errorMessage:` değeri
- `fullError:` değeri

