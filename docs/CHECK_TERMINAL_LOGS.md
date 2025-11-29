# Terminal Loglarını Kontrol Etme

## Server Terminal'inde Arayın

Development server çalışıyorsa (`npm run dev`), terminal'de şu logları arayın:

### 1. API Key Kontrolü
```
✅ GEMINI_API_KEY okundu, başlangıç: AIzaSyC7Xs...
🔑 API Key kullanılıyor, başlangıç: AIzaSyC7Xs... uzunluk: 39
🌐 API URL (key gizli): https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=***
```

### 2. Hata Logları
```
❌ Gemini API Hatası:
❌ API Key Hatası Detayları:
❌ 401 Unauthorized - API Key geçersiz veya yetkisiz!
```

### 3. Hata Detayları
Şu bilgileri paylaşın:
- `status:` değeri
- `statusText:` değeri
- `errorMessage:` değeri
- `fullError:` değeri

## Örnek Terminal Çıktısı

Eğer 401 hatası varsa, şöyle bir çıktı görmelisiniz:

```
❌ Gemini API Hatası: {
  status: 401,
  statusText: 'Unauthorized',
  error: { ... }
}
❌ API Key Hatası Detayları: {
  status: 401,
  statusText: 'Unauthorized',
  errorMessage: '...',
  fullError: { ... }
}
```

## Paylaşılacak Bilgiler

Terminal'deki şu satırları kopyalayıp paylaşın:
1. `❌ Gemini API Hatası:` satırı ve altındaki tüm bilgiler
2. `❌ API Key Hatası Detayları:` satırı ve altındaki tüm bilgiler
3. `errorMessage:` değeri

Bu bilgilerle sorunu netleştirebiliriz.

