# Railway Deployment Hata Çözümleri

## Yapılan Düzeltmeler

1. ✅ `nixpacks.toml` optimize edildi
2. ✅ Build script'i düzeltildi (cross-env bağımlılığı kaldırıldı)
3. ✅ NODE_OPTIONS environment variable eklendi

## Yaygın Hatalar ve Çözümleri

### 1. Build Hatası: "Module not found" veya "Cannot find module"

**Çözüm:**
```bash
# Railway'de Environment Variables ekleyin:
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS=--max-old-space-size=4096
```

### 2. Build Hatası: "Out of memory"

**Çözüm:**
Railway'de Environment Variable ekleyin:
```
NODE_OPTIONS=--max-old-space-size=4096
```

### 3. Build Hatası: "cross-env: command not found"

**Çözüm:**
✅ Düzeltildi - `package.json`'daki build script'i güncellendi.

### 4. Runtime Hatası: "Port already in use"

**Çözüm:**
Railway otomatik olarak PORT environment variable'ını ayarlar. Next.js bunu otomatik algılar.

### 5. Firebase Hatası: "Firebase configuration is missing"

**Çözüm:**
Railway'de şu Environment Variables'ları ekleyin:
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
FIREBASE_SERVICE_ACCOUNT_KEY=your_service_account_json
```

### 6. Cloudinary Hatası

**Çözüm:**
Railway'de şu Environment Variables'ları ekleyin:
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 7. Gemini API Hatası

**Çözüm:**
Railway'de Environment Variable ekleyin:
```
GEMINI_API_KEY=your_gemini_api_key
```

## Railway'de Environment Variables Ekleme

1. Railway Dashboard → Projenizi seçin
2. **Variables** sekmesine gidin
3. **New Variable** butonuna tıklayın
4. Key ve Value'yu girin
5. Kaydedin (otomatik redeploy başlar)

## Build Loglarını Kontrol Etme

1. Railway Dashboard → Projenizi seçin
2. **Deployments** sekmesine gidin
3. Son deployment'a tıklayın
4. **Logs** sekmesinde build loglarını görün

## Manuel Redeploy

1. Railway Dashboard → Projenizi seçin
2. **Deployments** sekmesine gidin
3. Son deployment'ın yanındaki **"..."** menüsüne tıklayın
4. **Redeploy** seçeneğini seçin

## Kontrol Listesi

Deploy öncesi kontrol edin:

- [ ] Tüm Environment Variables eklendi
- [ ] `nixpacks.toml` dosyası güncel
- [ ] `railway.json` dosyası güncel
- [ ] `package.json` build script'i düzeltildi
- [ ] GitHub'a push yapıldı
- [ ] Railway otomatik deploy başladı

## Hata Mesajını Paylaşın

Eğer hala hata alıyorsanız, Railway'deki build loglarını paylaşın:
1. Railway Dashboard → Deployments → Son deployment → Logs
2. Hata mesajını kopyalayın
3. Paylaşın, birlikte çözelim!
