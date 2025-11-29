# API Key Sorun Giderme Rehberi

## Hata: "Gemini API anahtarı yapılandırılmamış"

### 1. .env.local Dosyasını Kontrol Edin

Proje kök dizininde `.env.local` dosyası olmalı:

```env
GEMINI_API_KEY=AlzaSyBBchDMoNpxWlhsEMPkwek9yF_yETFBXwg
```

**ÖNEMLİ:**
- `=` işaretinden önce ve sonra **BOŞLUK OLMAMALI**
- Tırnak işareti (`"` veya `'`) kullanmayın
- Dosya adı tam olarak `.env.local` olmalı (nokta ile başlamalı)
- API key'in tamamını kopyaladığınızdan emin olun

### 2. Development Server'ı Yeniden Başlatın

`.env.local` dosyasını değiştirdikten sonra **MUTLAKA** server'ı yeniden başlatın:

1. Terminal'de `Ctrl+C` ile server'ı durdurun
2. `npm run dev` ile tekrar başlatın

**Neden?** Next.js environment variable'ları sadece server başlatıldığında okunur.

### 3. Terminal'de Kontrol Edin

Server başladıktan sonra terminal'de şu logları görmelisiniz:
- `✅ POST Handler: GEMINI_API_KEY mevcut, uzunluk: XX`
- `✅ GEMINI_API_KEY okundu, başlangıç: AIzaSy...`

Eğer `❌ GEMINI_API_KEY bulunamadı!` görüyorsanız:
- `.env.local` dosyasını kontrol edin
- Server'ı yeniden başlatın

### 4. API Key Formatını Kontrol Edin

Gemini API key'leri genellikle `AIzaSy` ile başlar. Eğer görüntüde "AlzaSy" görüyorsanız, bu muhtemelen "AIzaSy" olmalı (büyük I harfi).

### 5. Dosya Konumunu Kontrol Edin

`.env.local` dosyası proje kök dizininde olmalı:
```
sorucozapp/
  ├── .env.local  ← Burada olmalı
  ├── app/
  ├── components/
  └── package.json
```

### 6. PowerShell ile Kontrol

```powershell
# .env.local dosyasını oku
Get-Content .env.local

# GEMINI_API_KEY satırını bul
Get-Content .env.local | Select-String "GEMINI"
```

### 7. Hala Çalışmıyorsa

1. `.env.local` dosyasını silin
2. Yeniden oluşturun
3. Sadece şu satırı ekleyin:
   ```
   GEMINI_API_KEY=AlzaSyBBchDMoNpxWlhsEMPkwek9yF_yETFBXwg
   ```
4. Server'ı yeniden başlatın

### 8. Production'da

Production'da (Vercel, Netlify vb.) environment variable'ları platform ayarlarından eklemeniz gerekir. `.env.local` sadece local development için kullanılır.

