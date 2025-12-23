# EAS Build Manuel Komutlar

## 📱 Android APK Build Komutları

### 1. Production APK Build (Önerilen)

```bash
cd mobile
eas build --platform android --profile production
```

### 2. Preview APK Build (Test için)

```bash
cd mobile
eas build --platform android --profile preview
```

### 3. Development Build (Geliştirme için)

```bash
cd mobile
eas build --platform android --profile development
```

## 🔍 Build Durumu Kontrol Komutları

### Son Build'leri Listele

```bash
cd mobile
eas build:list --platform android --limit 10
```

### Son Build'in Detaylarını Gör

```bash
cd mobile
eas build:view --latest --platform android
```

### Belirli Bir Build'in Detaylarını Gör

```bash
cd mobile
eas build:view --id <BUILD_ID>
```

## 📥 Build İndirme Komutları

### Son Build'i İndir

```bash
cd mobile
eas build:download --latest --platform android
```

### Belirli Bir Build'i İndir

```bash
cd mobile
eas build:download --id <BUILD_ID>
```

### İndirme Klasörü Belirt

```bash
cd mobile
eas build:download --latest --platform android --output ./builds/
```

## 🚀 Hızlı Build ve İndirme (Tek Komut)

```bash
cd mobile && eas build --platform android --profile production && eas build:download --latest --platform android
```

## 📊 Build Loglarını Görüntüle

### Son Build'in Loglarını Gör

```bash
cd mobile
eas build:logs --latest --platform android
```

### Belirli Bir Build'in Loglarını Gör

```bash
cd mobile
eas build:logs --id <BUILD_ID>
```

## 🔄 Build İptal Etme

### Çalışan Build'i İptal Et

```bash
cd mobile
eas build:cancel --latest --platform android
```

### Belirli Bir Build'i İptal Et

```bash
cd mobile
eas build:cancel --id <BUILD_ID>
```

## ⚙️ Build Yapılandırması

### Build Profillerini Gör

```bash
cd mobile
cat eas.json
```

### Mevcut Profiller:
- **production**: Production APK (autoIncrement: true)
- **preview**: Preview APK (internal distribution)
- **development**: Development build (developmentClient: true)

## 🎯 Özel Build Komutları

### Non-Interactive Mode (Otomatik onay)

```bash
cd mobile
eas build --platform android --profile production --non-interactive
```

### Local Build (Kendi bilgisayarınızda)

```bash
cd mobile
eas build --platform android --profile production --local
```

**Not:** Local build için Android SDK ve build araçları gerekir.

### Build'i Beklemeden Başlat (Arka planda)

```bash
cd mobile
eas build --platform android --profile production --no-wait
```

## 📋 Build Öncesi Kontrol Listesi

### 1. Git Durumu Kontrol Et

```bash
cd mobile
git status
```

### 2. Değişiklikleri Commit Et (Gerekirse)

```bash
cd mobile
git add .
git commit -m "Build öncesi değişiklikler"
git push
```

### 3. Package.json Kontrol Et

```bash
cd mobile
cat package.json
```

### 4. EAS Yapılandırmasını Kontrol Et

```bash
cd mobile
cat eas.json
```

### 5. App.json Kontrol Et

```bash
cd mobile
cat app.json
```

## 🔧 Sorun Giderme Komutları

### EAS CLI Versiyonunu Kontrol Et

```bash
npx eas-cli --version
```

### EAS CLI'yi Güncelle

```bash
npm install -g eas-cli@latest
```

### EAS Login Kontrol Et

```bash
eas whoami
```

### EAS'e Giriş Yap (Gerekirse)

```bash
eas login
```

### Proje Bağlantısını Kontrol Et

```bash
cd mobile
eas project:info
```

## 📱 Build Sonrası Test Komutları

### APK'yı Cihaza Yükle (ADB ile)

```bash
# APK dosyasını bul
cd mobile
# APK dosyası genellikle Downloads klasöründe olur
adb install <APK_DOSYA_YOLU>
```

### Cihazda Logları Görüntüle

```bash
adb logcat | grep -i "expo\|react\|firebase"
```

## 🎨 Build Profili Özelleştirme

### Production Build (APK)

```bash
cd mobile
eas build --platform android --profile production
```

**Özellikler:**
- ✅ APK formatı
- ✅ Auto increment versionCode
- ✅ Production optimizasyonları
- ✅ Google Services dahil

### Preview Build (Test APK)

```bash
cd mobile
eas build --platform android --profile preview
```

**Özellikler:**
- ✅ APK formatı
- ✅ Internal distribution
- ✅ Test için optimize edilmiş

### Development Build

```bash
cd mobile
eas build --platform android --profile development
```

**Özellikler:**
- ✅ Development client
- ✅ Debug modu
- ✅ Hot reload desteği

## 📦 Build Artifacts

### Build Artifacts'ları Listele

```bash
cd mobile
eas build:list --platform android --limit 5 --json
```

### Build Artifact URL'sini Al

```bash
cd mobile
eas build:view --latest --platform android --json | grep "applicationArchiveUrl"
```

## 🔐 Credentials Yönetimi

### Android Credentials'ları Görüntüle

```bash
cd mobile
eas credentials
```

### Keystore Bilgilerini Görüntüle

```bash
cd mobile
eas credentials --platform android
```

## 📝 Örnek Build Senaryoları

### Senaryo 1: Hızlı Test Build

```bash
cd mobile
eas build --platform android --profile preview --non-interactive
```

### Senaryo 2: Production Build ve İndirme

```bash
cd mobile
# Build başlat
eas build --platform android --profile production

# Build tamamlanana kadar bekle, sonra:
eas build:download --latest --platform android
```

### Senaryo 3: Build Durumunu Takip Et

```bash
cd mobile
# Build başlat
eas build --platform android --profile production --no-wait

# Durumu kontrol et (her 30 saniyede bir)
watch -n 30 'eas build:list --platform android --limit 1'
```

## 🚨 Acil Durum Komutları

### Tüm Çalışan Build'leri İptal Et

```bash
cd mobile
eas build:list --platform android --status in-progress --json | jq -r '.[].id' | xargs -I {} eas build:cancel --id {}
```

### Son Başarısız Build'in Loglarını Gör

```bash
cd mobile
eas build:list --platform android --limit 5 --json | jq -r '.[] | select(.status == "finished" and .status != "finished") | .id' | head -1 | xargs -I {} eas build:logs --id {}
```

## 💡 İpuçları

1. **Build süresi:** İlk build 15-20 dakika, sonraki build'ler 10-15 dakika sürer
2. **Free plan limit:** Aylık sınırlı build sayısı var, dikkatli kullanın
3. **Version code:** Production profile'da otomatik artar
4. **Google Services:** `google-services.json` dosyası build'e dahil edilir
5. **Build cache:** EAS build cache kullanır, hızlı build'ler için faydalıdır

## 📚 Daha Fazla Bilgi

- [EAS Build Dokümantasyonu](https://docs.expo.dev/build/introduction/)
- [EAS CLI Komutları](https://docs.expo.dev/build/building-on-ci/)
- [Build Profilleri](https://docs.expo.dev/build/eas-json/)
