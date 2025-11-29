# Yeni Gemini API Key Oluşturma

## Sorun
Firebase tarafından otomatik oluşturulan API key'ler bazen Gemini API için yetkilendirilmemiş olabilir. Bu durumda yeni bir API key oluşturmanız gerekir.

## Adımlar

### 1. Google AI Studio'dan Yeni API Key Oluşturun

1. **Google AI Studio'ya gidin:** https://aistudio.google.com/app/apikey
2. **"Create API Key"** butonuna tıklayın
3. **"Create API key in new project"** veya mevcut projenizi seçin
4. Yeni API key'i kopyalayın (tam olarak kopyalayın, başında/sonunda boşluk olmamalı)

### 2. .env.local Dosyasını Güncelleyin

1. `.env.local` dosyasını açın
2. Eski `GEMINI_API_KEY` satırını bulun
3. Yeni API key ile değiştirin:

```env
GEMINI_API_KEY=YENİ_API_KEY_BURAYA
```

**ÖNEMLİ:**
- ✅ Başında/sonunda boşluk yok
- ✅ Tırnak işareti yok (`"` veya `'`)
- ✅ `=` işaretinden sonra direkt API key başlıyor

### 3. Server'ı Yeniden Başlatın

```bash
# Terminal'de Ctrl+C ile durdurun
# Sonra:
npm run dev
```

### 4. Test Edin

1. Bir soru yükleyin
2. "Soruyu Çöz" butonuna tıklayın
3. Terminal loglarını kontrol edin

## Terminal Loglarını Kontrol Edin

Terminal'de şu logları arayın:

### Başarılı ise:
```
✅ POST Handler: GEMINI_API_KEY mevcut, uzunluk: 39
✅ GEMINI_API_KEY okundu, başlangıç: AIzaSy...
🔑 API Key kullanılıyor, başlangıç: AIzaSy... uzunluk: 39
✅ Gemini API yanıtı alındı
```

### Hata varsa:
```
❌ Gemini API Hatası: { status: 401, ... }
❌ API Key Hatası Detayları: { ... }
```

Bu logları paylaşın!

## API Key Formatı Kontrolü

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

## Hala Çalışmıyorsa

1. Terminal'deki `❌ API Key Hatası Detayları:` logunu paylaşın
2. `.env.local` dosyasındaki `GEMINI_API_KEY` satırını paylaşın (sadece başlangıcı, tam key'i değil)
3. Server'ın yeniden başlatıldığından emin olun

