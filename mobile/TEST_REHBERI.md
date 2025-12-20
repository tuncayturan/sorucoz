# Test Rehberi

## Hızlı Test

### 1. Bağımlılıkları Yükleyin
```bash
cd mobile
npm install
```

### 2. Uygulamayı Başlatın
```bash
npm start
```

### 3. Test Seçenekleri

**Android Emulator ile:**
- Android Studio'da bir emulator başlatın
- Terminal'de `a` tuşuna basın

**Fiziksel Cihaz ile:**
- Expo Go uygulamasını telefonunuza yükleyin
- Terminal'deki QR kodu tarayın

**Web ile:**
- Terminal'de `w` tuşuna basın
- Tarayıcıda açılacak

## Asset Dosyaları

`app.json` dosyasında belirtilen asset dosyalarını eklemeniz gerekiyor:

- `./assets/icon.png` (1024x1024 px)
- `./assets/splash.png` (1242x2436 px veya benzer)
- `./assets/adaptive-icon.png` (1024x1024 px)
- `./assets/favicon.png` (48x48 px)

Bu dosyaları `mobile/assets/` klasörüne ekleyin. Mevcut web projenizdeki `public/img/logo.png` dosyasını kullanabilirsiniz.

## Olası Hatalar ve Çözümleri

### "Cannot find module"
```bash
npm install
```

### "Asset not found"
Asset dosyalarını `mobile/assets/` klasörüne ekleyin.

### Firebase hatası
`lib/firebase/config.ts` dosyasındaki Firebase yapılandırmasını kontrol edin.

### Expo Go'da çalışmıyor
Bazı native modüller Expo Go'da çalışmayabilir. Development build kullanın:
```bash
eas build --profile development --platform android
```

## Sonraki Adımlar

1. ✅ Temel yapı hazır
2. ⏳ Asset dosyalarını ekleyin
3. ⏳ Firebase yapılandırmasını test edin
4. ⏳ Sayfaları tamamlayın
5. ⏳ APK oluşturun
