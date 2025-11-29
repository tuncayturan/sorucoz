# Gemini API Key Kontrol Listesi

## ✅ API Key Formatı
Gemini API key'leri genellikle `AIzaSy` ile başlar. Görüntüden görünen key formatı doğru görünüyor.

## ✅ Yapılandırma Kontrolü

### 1. `.env.local` Dosyası
Şu satırın olduğundan emin olun:
```env
GEMINI_API_KEY=AlzaSyBBchDMoNpxWlhsEMPkwek9yF_yETFBXwg
```

### 2. Next.js Server Restart
`.env.local` dosyasını değiştirdikten sonra:
- Development server'ı durdurun (Ctrl+C)
- Tekrar başlatın: `npm run dev`

### 3. API Route Kontrolü
- ✅ `app/api/ai/detect-subject/route.ts` - GEMINI_API_KEY kullanıyor
- ✅ `app/api/ai/solve-question/route.ts` - GEMINI_API_KEY kullanıyor

## 🔍 Test Etme

1. Bir soru yükleyin
2. Console'da hata olup olmadığını kontrol edin
3. Ders tespiti çalışıyorsa API key doğru demektir

## ⚠️ Yaygın Hatalar

1. **API key yoksa:** "Gemini API anahtarı yapılandırılmamış" hatası
2. **Yanlış key:** "API key invalid" veya 401 hatası
3. **Rate limit:** 429 hatası (dakikada 15 istek limiti)
4. **Quota doldu:** 429 hatası (günde 60 istek limiti)

## 📝 Notlar

- API key'i asla commit etmeyin (`.gitignore`'da olmalı)
- Production'da environment variable olarak ayarlayın
- API key'i paylaşmayın

