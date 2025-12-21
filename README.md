# SoruÇöz Mobile App

React Native (Expo) ile geliştirilmiş mobil uygulama.

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Uygulamayı başlatın:
```bash
npm start
```

## APK Oluşturma

### EAS Build ile (Önerilen)

1. EAS CLI'yi yükleyin:
```bash
npm install -g eas-cli
```

2. EAS'a giriş yapın:
```bash
eas login
```

3. Projeyi başlatın:
```bash
eas build:configure
```

4. APK oluşturun:
```bash
eas build --platform android --profile production
```

### Yerel Build (Gelişmiş)

1. Expo Development Build oluşturun:
```bash
eas build --profile development --platform android
```

2. Veya `expo run:android` ile yerel build yapın (Android Studio gerekli)

## Google Play Store'a Yükleme

1. EAS Build ile AAB (Android App Bundle) oluşturun:
```bash
eas build --platform android --profile production
```

2. Google Play Console'da yeni bir uygulama oluşturun

3. AAB dosyasını yükleyin ve gerekli bilgileri doldurun

## Notlar

- Firebase yapılandırması `lib/firebase/config.ts` dosyasında
- Environment variables için `.env` dosyası kullanılabilir
- `app.json` dosyasında uygulama bilgileri ve izinler tanımlı
