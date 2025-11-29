# Gemini API Debug Rehberi

## Terminal Loglarını Kontrol Edin

Server terminal'inde şu logları arayın:

### ✅ Başarılı Durum:
```
✅ POST Handler: GEMINI_API_KEY mevcut, uzunluk: 39
✅ GEMINI_API_KEY okundu, başlangıç: AIzaSy...
✅ Gemini API yanıtı alındı: { hasCandidates: true, candidatesLength: 1 }
✅ Çözüm başarıyla parse edildi, adım sayısı: X
```

### ❌ Hata Durumları:

1. **API Key Bulunamadı:**
```
❌ POST Handler: GEMINI_API_KEY bulunamadı!
```
**Çözüm:** Server'ı yeniden başlatın

2. **API Key Geçersiz:**
```
❌ Gemini API Hatası: { status: 400, statusText: 'Bad Request', error: {...} }
❌ API Key geçersiz veya yetkisiz!
```
**Çözüm:** Google AI Studio'dan yeni API key oluşturun

3. **Rate Limit:**
```
❌ Gemini API Hatası: { status: 429, ... }
Gemini API rate limit aşıldı
```
**Çözüm:** Birkaç dakika bekleyin (dakikada 15 istek limiti)

4. **Quota Doldu:**
```
❌ Gemini API Hatası: { status: 429, ... }
QUOTA_EXCEEDED
```
**Çözüm:** Ertesi gün tekrar deneyin (günde 60 istek limiti)

5. **Boş Yanıt:**
```
❌ Gemini API'den boş yanıt alındı: {...}
```
**Çözüm:** Tekrar deneyin, görsel formatını kontrol edin

6. **JSON Parse Hatası:**
```
❌ JSON parse hatası: { error: '...', content: '...' }
```
**Çözüm:** Gemini API'den gelen yanıt formatı beklenenden farklı, tekrar deneyin

## Terminal'de Tam Hata Mesajını Bulun

Terminal'de şu satırları arayın:
- `❌ Gemini API Hatası:`
- `❌ Gemini API çağrı hatası:`
- `Soru çözme hatası:`

Bu loglar tam hata mesajını gösterecektir.

## Yaygın Sorunlar ve Çözümleri

### 1. "API key mevcut ama yanıt alınamadı"
- Terminal'deki tam hata mesajını kontrol edin
- API key'in geçerli olduğundan emin olun
- Görsel URL'in erişilebilir olduğundan emin olun

### 2. 500 Internal Server Error
- Terminal loglarını kontrol edin
- Hangi aşamada hata oluştuğunu bulun
- API key, görsel yükleme, veya JSON parse hatası olabilir

### 3. Görsel Yükleme Hatası
- Cloudinary URL'in doğru olduğundan emin olun
- Görsel formatının desteklendiğinden emin olun (JPEG, PNG, WebP)

