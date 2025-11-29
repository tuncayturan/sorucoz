# Environment Variables Kurulumu

## .env.local Dosyası Oluşturma

Proje kök dizininde `.env.local` dosyası oluşturun ve aşağıdaki değişkenleri ekleyin:

```env
# Gemini API Key (Ücretsiz)
GEMINI_API_KEY=AlzaSyBBchDMoNpxWlhsEMPkwek9yF_yETFBXwg

# Cloudinary (Zaten var olmalı)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Firebase (Zaten var olmalı)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
# ... diğer Firebase config'ler
```

## Önemli Notlar

1. **Dosya Adı:** `.env.local` (nokta ile başlamalı)
2. **Format:** `KEY=value` (eşittir işaretinden önce ve sonra boşluk OLMAMALI)
3. **Tırnak İşareti:** API key'lerde tırnak işareti kullanmayın
4. **Server Restart:** `.env.local` değişikliklerinden sonra development server'ı yeniden başlatın

## Development Server'ı Yeniden Başlatma

1. Terminal'de `Ctrl+C` ile server'ı durdurun
2. `npm run dev` ile tekrar başlatın

## Kontrol

API key doğru yapılandırıldıysa:
- Soru yüklendiğinde ders otomatik tespit edilir
- Soru çözme özelliği çalışır
- Console'da hata olmaz

## Yaygın Hatalar

1. **"GEMINI_API_KEY bulunamadı"**
   - `.env.local` dosyası var mı kontrol edin
   - Dosya adı tam olarak `.env.local` olmalı
   - Server'ı yeniden başlattınız mı?

2. **"API key invalid"**
   - API key'i kopyalarken boşluk eklenmiş olabilir
   - API key'in tamamını kopyaladığınızdan emin olun

3. **"Rate limit"**
   - Normal, dakikada 15 istek limiti var
   - Birkaç dakika bekleyin

