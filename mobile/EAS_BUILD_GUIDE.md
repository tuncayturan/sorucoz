# EAS Build Rehberi

## Build Başlatma

### Yöntem 1: EAS CLI (Terminal)

```bash
cd mobile
eas build --platform android --profile production
```

### Yöntem 2: EAS Dashboard (Web - Önerilen)

1. **EAS Dashboard'a gidin:**
   - [expo.dev](https://expo.dev) → Giriş yapın
   - Projenizi seçin: **sorucozapp**

2. **Build sekmesine gidin:**
   - Sol menüden **"Builds"** seçin
   - **"Create a build"** butonuna tıklayın

3. **Build ayarlarını seçin:**
   - **Platform:** Android
   - **Profile:** production
   - **Build type:** APK

4. **Build'i başlatın:**
   - **"Start build"** butonuna tıklayın

### Yöntem 3: GitHub Actions (Otomatik)

GitHub'a push yaptığınızda otomatik build başlatılabilir (şimdilik yok).

## Build Durumunu Kontrol Etme

### EAS Dashboard'dan

1. [expo.dev](https://expo.dev) → Projeniz → **Builds**
2. En son build'in durumunu görün:
   - 🟡 **In progress** = Build devam ediyor
   - ✅ **Finished** = Build başarılı
   - ❌ **Failed** = Build başarısız

### Terminal'den

```bash
cd mobile
eas build:list --platform android --limit 5
```

## Build İndirme

### EAS Dashboard'dan

1. Build listesinde başarılı build'i bulun
2. **"Download"** butonuna tıklayın
3. APK dosyasını indirin

### Terminal'den

```bash
cd mobile
eas build:list --platform android --limit 1
# Build ID'yi kopyalayın, sonra:
eas build:download --id <BUILD_ID>
```

## Build Logları

Build sırasında hata olursa:

1. EAS Dashboard → Builds → Build'e tıklayın
2. **"Logs"** sekmesine gidin
3. Hata mesajlarını kontrol edin

## Yaygın Sorunlar

### 1. "build command failed" Hatası

**Neden:**
- Free plan limiti aşılmış olabilir
- Build queue'da bekliyor olabilir
- Geçici bir EAS servis sorunu olabilir

**Çözüm:**
1. EAS Dashboard'dan build'i kontrol edin
2. Build gerçekten başlatıldı mı kontrol edin
3. Birkaç dakika bekleyip tekrar deneyin
4. EAS Dashboard'dan manuel olarak build başlatın

### 2. Free Plan Limit Uyarısı

**Mesaj:**
```
This account has used its Android builds from the Free plan this month
```

**Anlamı:**
- Bu ay kullanılan ücretsiz build sayısı dolmuş
- 9 gün sonra (1 Ocak 2026) limit sıfırlanacak
- Şimdilik bekleyebilir veya Pro plan'a geçebilirsiniz

**Çözüm:**
- Bekleyin (limit sıfırlanana kadar)
- Veya Pro plan'a yükseltin

### 3. Build Çok Uzun Sürüyor

**Normal süre:**
- İlk build: 15-20 dakika
- Sonraki build'ler: 10-15 dakika

**Çözüm:**
- Build'in tamamlanmasını bekleyin
- EAS Dashboard'dan durumu kontrol edin

## Build Özellikleri

### Mevcut Yapılandırma

- **Platform:** Android
- **Build Type:** APK
- **Profile:** production
- **Auto Increment:** ✅ (versionCode otomatik artar)
- **Google Services:** ✅ (google-services.json dahil)

### Son Değişiklikler

- ✅ Email doğrulama ekranı eklendi
- ✅ Expo Push Notification desteği eklendi
- ✅ Firebase Cloud Messaging yapılandırıldı
- ✅ Google Sign-In düzeltildi
- ✅ Video background eklendi
- ✅ Logo gösterimi düzeltildi

## Build Sonrası

Build tamamlandıktan sonra:

1. **APK'yı indirin**
2. **Android cihaza yükleyin**
3. **Test edin:**
   - Email doğrulama çalışıyor mu?
   - Bildirimler çalışıyor mu?
   - Google Sign-In çalışıyor mu?
   - Video background görünüyor mu?
   - Logo gösteriliyor mu?

## Hızlı Komutlar

```bash
# Build başlat
cd mobile
eas build --platform android --profile production

# Build listesi
eas build:list --platform android --limit 5

# Son build'i indir
eas build:download --latest --platform android

# Build durumu
eas build:view --latest --platform android
```

## Önemli Notlar

1. **Free Plan Limit:**
   - Aylık sınırlı build sayısı var
   - Limit dolduysa beklemek gerekir

2. **Build Süresi:**
   - İlk build daha uzun sürer
   - Sonraki build'ler daha hızlıdır

3. **Google Services:**
   - `google-services.json` dosyası build'e dahil edilir
   - Firebase Console'dan indirilmiş olmalı

4. **Version Code:**
   - Otomatik olarak artar (13 → 14 → 15...)
   - Her build'de bir artar

## Destek

Sorun yaşarsanız:
1. EAS Dashboard → Builds → Build loglarını kontrol edin
2. [Expo Discord](https://chat.expo.dev/) → Destek alın
3. [EAS Dokümantasyonu](https://docs.expo.dev/build/introduction/)
