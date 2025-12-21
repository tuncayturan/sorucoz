# SoruÇöz Mobile - Kurulum ve APK Oluşturma Rehberi

## 📱 Proje Yapısı

Bu proje, Next.js web uygulamanızın React Native (Expo) versiyonudur. Google Play Store'a yüklemek için APK oluşturabilirsiniz.

## 🚀 Hızlı Başlangıç

### 1. Bağımlılıkları Yükleyin

```bash
cd mobile
npm install
```

### 2. Uygulamayı Test Edin

```bash
npm start
```

Ardından:
- **Android**: `a` tuşuna basın veya QR kodu Expo Go uygulaması ile tarayın
- **iOS**: `i` tuşuna basın (Mac gerekli)

## 📦 APK Oluşturma

### Yöntem 1: EAS Build (Önerilen - Bulut Build)

EAS Build, Expo'nun bulut build servisidir. Android Studio kurmanıza gerek yoktur.

#### Adım 1: EAS CLI'yi Yükleyin

```bash
npm install -g eas-cli
```

#### Adım 2: EAS'a Giriş Yapın

```bash
eas login
```

Eğer hesabınız yoksa, `eas register` ile kayıt olabilirsiniz.

#### Adım 3: Projeyi Yapılandırın

```bash
eas build:configure
```

Bu komut `eas.json` dosyasını oluşturur/günceller.

#### Adım 4: APK Oluşturun

**Preview (Test için):**
```bash
eas build --platform android --profile preview
```

**Production (Google Play için):**
```bash
eas build --platform android --profile production
```

Build tamamlandığında, APK dosyasını indirebilirsiniz.

### Yöntem 2: Yerel Build (Gelişmiş)

Yerel build için Android Studio ve Android SDK kurulu olmalıdır.

```bash
npx expo run:android
```

## 🏪 Google Play Store'a Yükleme

### 1. AAB (Android App Bundle) Oluşturun

Google Play Store, APK yerine AAB formatını tercih eder:

```bash
eas build --platform android --profile production
```

Build sırasında "buildType" seçeneğini "aab" olarak ayarlayın veya `eas.json` dosyasını güncelleyin:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

### 2. Google Play Console'a Giriş Yapın

1. [Google Play Console](https://play.google.com/console) adresine gidin
2. Yeni bir uygulama oluşturun
3. Uygulama bilgilerini doldurun:
   - Uygulama adı: SoruÇöz
   - Varsayılan dil: Türkçe
   - Uygulama türü: Uygulama

### 3. AAB Dosyasını Yükleyin

1. "Production" veya "Internal testing" bölümüne gidin
2. "Create new release" butonuna tıklayın
3. AAB dosyasını yükleyin
4. Release notlarını ekleyin
5. "Review release" butonuna tıklayın

### 4. Store Listing Bilgilerini Doldurun

- Uygulama açıklaması
- Ekran görüntüleri
- Uygulama ikonu
- Kategori
- İçerik derecelendirmesi
- Gizlilik politikası URL'si

### 5. Uygulamayı Yayınlayın

Tüm bilgiler tamamlandıktan sonra uygulamayı yayınlayabilirsiniz.

## ⚙️ Yapılandırma

### Firebase Yapılandırması

Firebase yapılandırması `lib/firebase/config.ts` dosyasında. Environment variables kullanmak için:

1. `.env` dosyası oluşturun:
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

2. EAS Build için environment variables ekleyin:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value your_api_key
```

### Uygulama Bilgileri

`app.json` dosyasında uygulama bilgilerini güncelleyin:
- `name`: Uygulama adı
- `slug`: URL slug
- `package`: Android package name (örn: com.sorucoz.app)
- `bundleIdentifier`: iOS bundle identifier

## 📝 Notlar

- İlk build biraz uzun sürebilir (10-20 dakika)
- EAS Build ücretsiz tier'da günde 30 build limiti vardır
- Production build'ler için signing key otomatik oluşturulur
- Test için preview build kullanabilirsiniz

## 🐛 Sorun Giderme

### Build Hatası

1. `eas build:configure` komutunu tekrar çalıştırın
2. `eas.json` dosyasını kontrol edin
3. Logları inceleyin: `eas build:list`

### Firebase Hatası

1. Firebase config değerlerini kontrol edin
2. Environment variables'ın doğru yüklendiğinden emin olun
3. Firebase Console'da Android uygulaması eklendiğinden emin olun

### Paket Adı Hatası

`app.json` dosyasındaki `package` değerini benzersiz bir değerle değiştirin.

## 📚 Daha Fazla Bilgi

- [Expo Dokümantasyonu](https://docs.expo.dev/)
- [EAS Build Dokümantasyonu](https://docs.expo.dev/build/introduction/)
- [Google Play Console Yardım](https://support.google.com/googleplay/android-developer)
