# Google Gemini API Kurulumu

## 1. API Key Alma

1. Google AI Studio'ya gidin: https://makersuite.google.com/app/apikey
2. "Create API Key" butonuna tıklayın
3. API key'inizi kopyalayın

## 2. Environment Variable Ekleme

`.env.local` dosyasına ekleyin:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## 3. API Route'larını Güncelleme

Mevcut OpenAI route'larını Gemini ile değiştirmek için:

### Ders Tespiti:
- Eski: `/api/ai/detect-subject`
- Yeni: `/api/ai/detect-subject-gemini`

### Soru Çözme:
- Eski: `/api/ai/solve-question`
- Yeni: `/api/ai/solve-question-gemini`

## 4. Frontend'de Güncelleme

`app/soru-sor/page.tsx` ve `app/sorularim/[id]/page.tsx` dosyalarında:

```typescript
// Eski
const response = await fetch("/api/ai/detect-subject", ...)
const response = await fetch("/api/ai/solve-question", ...)

// Yeni
const response = await fetch("/api/ai/detect-subject-gemini", ...)
const response = await fetch("/api/ai/solve-question-gemini", ...)
```

## 5. Ücretsiz Limitler

- **Günde 60 istek** (yeterli çoğu kullanım için)
- **Dakikada 15 istek** rate limit
- Görsel analizi dahil
- Türkçe desteği mükemmel

## 6. Avantajlar

✅ Tamamen ücretsiz (günde 60 istek)  
✅ Görsel analizi mükemmel  
✅ Türkçe desteği çok iyi  
✅ Hızlı yanıt süresi  
✅ Tek API ile hem ders tespiti hem çözüm  

