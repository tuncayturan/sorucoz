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

**NOT:** Firebase config için default değerler kod içinde tanımlıdır, ancak production için environment variables kullanmanız önerilir.

```env
# Firebase (Opsiyonel - default değerler kullanılabilir, ama önerilir)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDmvEdQicJmsPhFjDcXXgj5rK0LO9Er2KU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=sorucoz-6deb3.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=sorucoz-6deb3
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sorucoz-6deb3.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1026488924758
NEXT_PUBLIC_FIREBASE_APP_ID=1:1026488924758:web:d4c081b5f87a62f10ed9f7

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

Railway'de domain oluşturmanın birkaç yolu vardır:

#### Yöntem 1: Settings'ten Domain Oluşturma

1. Railway dashboard'unda projenizi seçin
2. **Settings** sekmesine gidin
3. **Networking** veya **Domains** bölümünü bulun
4. **"Generate Domain"** veya **"Create Domain"** butonuna tıklayın
5. Domain otomatik olarak oluşturulacaktır

#### Yöntem 2: Service Settings'ten

1. Railway dashboard'unda projenizi seçin
2. Service'inizin üzerine tıklayın (genellikle GitHub repo adı)
3. **Settings** sekmesine gidin
4. **Networking** bölümünde **"Generate Domain"** butonuna tıklayın

#### Yöntem 3: Otomatik Domain (Deploy Sonrası)

Bazen Railway otomatik olarak domain oluşturur. Deploy tamamlandıktan sonra:
1. **Settings** → **Networking** bölümüne bakın
2. Domain otomatik olarak listelenmiş olabilir

#### Domain Oluşturma Sorunları

Eğer domain oluşturamıyorsanız:

1. **Deploy'un tamamlandığından emin olun:**
   - Deployments sekmesinde son deploy'un "Active" durumunda olduğunu kontrol edin
   - Service'in çalıştığını kontrol edin (yeşil ışık)

2. **Service'i kontrol edin:**
   - Service'in başarıyla başlatıldığından emin olun
   - Logs sekmesinde hata olmadığını kontrol edin

3. **Railway planınızı kontrol edin:**
   - Ücretsiz plan'da domain oluşturma sınırlı olabilir
   - Pro plan'da daha fazla özellik vardır

4. **Manuel domain ekleme:**
   - Settings → Networking → "Custom Domain" bölümünden kendi domain'inizi ekleyebilirsiniz

**Production Domain Örneği:**
- Railway domain: `https://sorucoz-production.up.railway.app/`
- Veya: `https://your-project-name.up.railway.app/`

**ÖNEMLİ: Firebase Authorized Domains**
Domain oluşturulduktan sonra Firebase Console'da authorized domains'e eklemeniz gerekir:

1. [Firebase Console](https://console.firebase.google.com/) → Projenizi seçin
2. **Authentication** → **Settings** → **Authorized domains** sekmesine gidin
3. **Add domain** butonuna tıklayın
4. `sorucoz-production.up.railway.app` domain'ini ekleyin
5. Kaydedin

Bu adım olmadan Firebase Authentication production domain'de çalışmayacaktır!

## 🔧 Sorun Giderme

### Firebase "Expected first argument to collection()" Hatası

Bu hata genellikle Firebase environment variables'ların eksik veya yanlış ayarlanmasından kaynaklanır.

**Kontrol Listesi:**

1. **Railway Dashboard → Variables Sekmesi** - Aşağıdaki tüm değişkenlerin mevcut olduğundan emin olun:
   - ✅ `NEXT_PUBLIC_FIREBASE_API_KEY`
   - ✅ `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - ✅ `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - ✅ `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - ✅ `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - ✅ `NEXT_PUBLIC_FIREBASE_APP_ID`

2. **Değişken Değerlerini Kontrol Edin:**
   - Her değişkenin değerinin doğru olduğundan emin olun
   - Başında veya sonunda boşluk olmadığından emin olun
   - Tırnak işareti (`"` veya `'`) kullanmayın

3. **Firebase Console'dan Değerleri Alın:**
   - [Firebase Console](https://console.firebase.google.com/) → Projenizi seçin
   - ⚙️ **Project Settings** → **General** sekmesi
   - **Your apps** bölümünden web uygulamanızı seçin (veya yeni bir tane oluşturun)
   - Config objesindeki değerleri kopyalayın

4. **Railway'de Değişkenleri Güncelleyin:**
   - Railway Dashboard → Variables
   - Her değişkeni tek tek kontrol edin ve güncelleyin
   - Kaydet butonuna tıklayın

5. **Yeniden Deploy:**
   - Railway otomatik olarak yeniden deploy edecektir
   - Veya **Deployments** sekmesinden manuel olarak **Redeploy** edebilirsiniz

6. **Console Loglarını Kontrol Edin:**
   - Browser'da F12 ile Developer Tools'u açın
   - Console sekmesinde Firebase ile ilgili hataları kontrol edin
   - Railway Logs'u da kontrol edin (Railway Dashboard → Logs)

**Yaygın Hatalar:**
- ❌ `Firebase app not properly initialized` → Environment variables eksik
- ❌ `Expected first argument to collection() to be a CollectionReference` → Firebase db instance düzgün initialize edilmemiş
- ❌ `Firebase configuration is missing` → Environment variables ayarlanmamış

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

