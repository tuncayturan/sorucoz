# Deployment Guide - Railway

## Build Durumu
✅ Build başarılı! Tüm hatalar düzeltildi.

## Railway Deployment Adımları

### 1. GitHub'a Push
```bash
git add .
git commit -m "Build hataları düzeltildi, Railway deployment hazır"
git push origin main
```

### 2. Railway'de Deploy

1. Railway Dashboard'a git: https://railway.app
2. "New Project" → "Deploy from GitHub repo"
3. GitHub repo'nuzu seçin
4. Railway otomatik olarak `railway.json` ve `nixpacks.toml` dosyalarını kullanacak

### 3. Environment Variables

Railway'de şu environment variables'ları ekleyin:

#### Firebase
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string olarak)

#### iyzico (Opsiyonel)
- `IYZICO_API_KEY`
- `IYZICO_SECRET_KEY`

#### Diğer
- `NEXT_PUBLIC_BASE_URL` (Railway domain'iniz, örn: `https://your-app.railway.app`)
- `GEMINI_API_KEY` (Google AI için)

### 4. Build Notları

- `iyzipay` modülü runtime'da yükleniyor (build warning'leri normal)
- `serverExternalPackages` ile iyzipay, puppeteer, whatsapp-web.js external olarak işaretlendi
- Turbopack config eklendi (Next.js 16 için gerekli)

### 5. Railway Build Komutları

Railway otomatik olarak şu komutları çalıştıracak:
- **Build**: `NODE_OPTIONS='--max-old-space-size=4096' NEXT_TELEMETRY_DISABLED=1 npm run build`
- **Start**: `npm start`

## Sorun Giderme

### Build Hatası
- Railway'de `NODE_OPTIONS` environment variable'ı ekleyin: `--max-old-space-size=4096`
- `npm ci` komutu kullanılıyor (clean install)

### iyzipay Warning'leri
- Normal, build'i durdurmaz
- Runtime'da yüklenecek

### Port
- Railway otomatik olarak port'u ayarlayacak
- `railway.json`'da port 3000 tanımlı

## Notlar

- Build başarılı: ✓ Compiled successfully
- TypeScript başarılı: ✓ Finished TypeScript
- Tüm route'lar oluşturuldu
- Production build hazır
