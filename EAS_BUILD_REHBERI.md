# EAS Build - APK Oluşturma Rehberi

## Adım 1: EAS CLI Kurulumu

```bash
# EAS CLI'yi global olarak yükle
npm install -g eas-cli

# Versiyonu kontrol et
eas --version
```

## Adım 2: EAS'a Login Ol

```bash
# EAS hesabına login ol
eas login
```

- İlk seferinde Expo hesabı oluşturmanız istenir
- Email ve şifre ile kayıt olun (ücretsiz)
- https://expo.dev adresinden de kayıt olabilirsiniz

## Adım 3: Mobil Klasörüne Git

```bash
# Mobil klasörüne git (ÖNEMLİ!)
cd d:\sorucozapp\mobile

# Dizini kontrol et
Get-Location

# package.json'ın burada olduğundan emin ol
Test-Path package.json
```

## Adım 4: Assets Dosyalarını Kontrol Et

```bash
# Assets klasörünü kontrol et
Test-Path assets

# Eğer yoksa oluştur
New-Item -ItemType Directory -Force -Path assets

# Gerekli dosyaları kopyala
Copy-Item "..\public\img\logo.png" "assets\icon.png"
Copy-Item "..\public\img\splash.png" "assets\splash.png"
Copy-Item "..\public\img\logo.png" "assets\adaptive-icon.png"
Copy-Item "assets\icon.png" "assets\favicon.png"

# Dosyaları kontrol et
Get-ChildItem assets
```

## Adım 5: Paketleri Yükle

```bash
# Node modules yüklü mü kontrol et
Test-Path node_modules

# Eğer yoksa yükle
npm install
```

## Adım 6: EAS Build Yapılandırması

```bash
# EAS build yapılandırması (ilk seferinde)
eas build:configure
```

Sorular:
- Which platforms? → **Android** seçin
- Build profile? → **production** seçin

## Adım 7: APK Build Et

```bash
# Production APK build et
eas build --platform android --profile production
```

## Build Süreci

1. EAS build başlatılır
2. Kodlar cloud'a yüklenir
3. Build cloud'da yapılır (5-15 dakika)
4. Build tamamlandığında:
   - Email ile bildirim gelir
   - Terminal'de download linki görünür
   - EAS dashboard'dan indirebilirsiniz

## Build Durumunu Kontrol Etme

```bash
# Build listesini gör
eas build:list

# Son build'in durumunu kontrol et
eas build:view
```

## Sorun Giderme

### Hata: "package.json does not exist"
- `mobile/` klasöründen çalıştırdığınızdan emin olun
- `Get-Location` ile dizini kontrol edin

### Hata: "assets/icon.png not found"
- Assets klasörünü ve dosyalarını oluşturun (Adım 4)

### Hata: "expo-image-picker plugin not found"
- `npm install` çalıştırın
- `npm install expo-image-picker@latest` deneyin

## Önemli Notlar

1. **Her zaman `mobile/` klasöründen** EAS komutlarını çalıştırın
2. İlk build'de keystore oluşturulur (güvenlik için)
3. Keystore bilgilerini kaydedin (sonraki build'ler için gerekli)
4. Build cloud'da yapılır (local bilgisayarınızda değil)
5. Ücretsiz plan: Ayda 30 build hakkı

## Hızlı Başlangıç (Tüm Adımlar)

```bash
# 1. EAS CLI yükle
npm install -g eas-cli

# 2. Login ol
eas login

# 3. Mobil klasörüne git
cd d:\sorucozapp\mobile

# 4. Assets oluştur (eğer yoksa)
New-Item -ItemType Directory -Force -Path assets
Copy-Item "..\public\img\logo.png" "assets\icon.png"
Copy-Item "..\public\img\splash.png" "assets\splash.png"
Copy-Item "..\public\img\logo.png" "assets\adaptive-icon.png"
Copy-Item "assets\icon.png" "assets\favicon.png"

# 5. Paketleri yükle
npm install

# 6. EAS yapılandır (ilk seferinde)
eas build:configure

# 7. APK build et
eas build --platform android --profile production
```
