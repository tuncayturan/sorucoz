# Railway Deployment Guide - WhatsApp Servisi

Bu rehber, WhatsApp özelliğini test etmek için projeyi Railway'e deploy etme adımlarını içerir.

## 🚀 Railway'e Deploy Etme

### 1. Railway Hesabı Oluşturma

1. [Railway.app](https://railway.app) adresine gidin
2. "Start a New Project" butonuna tıklayın
3. GitHub hesabınızla giriş yapın
4. "Deploy from GitHub repo" seçeneğini seçin
5. `sorucoz` repository'sini seçin

### 2. Environment Variables Ayarlama

Railway dashboard'unda "Variables" sekmesine gidin ve şu değişkenleri ekleyin:

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Firebase Admin (Server-side)
FIREBASE_ADMIN_PROJECT_ID=your_firebase_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_firebase_admin_client_email
FIREBASE_ADMIN_PRIVATE_KEY=your_firebase_admin_private_key

# Cloudinary (Eğer kullanıyorsanız)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Gemini API (Eğer kullanıyorsanız)
GEMINI_API_KEY=your_gemini_api_key

# Node Environment
NODE_ENV=production
```

### 3. Puppeteer Yapılandırması

Railway otomatik olarak `nixpacks.toml` dosyasını kullanarak Chromium'u yükleyecektir. Eğer sorun yaşarsanız:

1. Railway dashboard'unda "Settings" sekmesine gidin
2. "Build Command" alanına şunu ekleyin:
   ```
   npm install && npm run build
   ```

### 4. Deploy

1. Railway otomatik olarak GitHub'dan değişiklikleri çekecektir
2. "Deployments" sekmesinde build durumunu takip edin
3. Build tamamlandığında, uygulama otomatik olarak başlatılacaktır

### 5. Domain Ayarlama

1. Railway dashboard'unda "Settings" sekmesine gidin
2. "Generate Domain" butonuna tıklayın
3. Veya kendi domain'inizi ekleyin

## 🔧 Sorun Giderme

### Puppeteer/Chromium Hataları

Eğer Puppeteer ile ilgili hata alırsanız:

1. Railway dashboard'unda "Logs" sekmesini kontrol edin
2. Chromium'un yüklendiğinden emin olun
3. `nixpacks.toml` dosyasının doğru yapılandırıldığından emin olun

### WhatsApp Bağlantı Sorunları

1. Railway'deki uygulamanın çalıştığından emin olun
2. Environment variables'ın doğru ayarlandığını kontrol edin
3. WhatsApp Web bağlantısı için QR kod'un göründüğünü kontrol edin

### Build Hataları

1. Railway logs'u kontrol edin
2. `package.json` dosyasındaki bağımlılıkların doğru olduğundan emin olun
3. Node.js versiyonunun 20.x olduğundan emin olun

## 📝 Notlar

- Railway ücretsiz tier'da $5 kredi/ay verir
- WhatsApp servisi sürekli çalışmalıdır (sleep yapmamalı)
- Production için Railway Pro planı ($20/ay) önerilir
- Test aşamasında ücretsiz tier yeterlidir

## 🔗 Faydalı Linkler

- [Railway Dokümantasyonu](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Next.js on Railway](https://docs.railway.app/guides/nextjs)

