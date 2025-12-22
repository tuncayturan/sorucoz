# Google Services JSON Dosyası Kurulumu

## Adımlar

### 1. Firebase Console'dan google-services.json İndirin

1. [Firebase Console](https://console.firebase.google.com/)'a gidin
2. Projenizi seçin: **sorucoz-6deb3**
3. Sol menüden **Project Settings** (⚙️) tıklayın
4. Aşağı kaydırın ve **Your apps** bölümüne gidin
5. **Android app** bölümünde uygulamanızı bulun veya **Add app** > **Android** ile yeni ekleyin
   - Package name: `com.sorucoz.app`
   - App nickname: SoruÇöz (isteğe bağlı)
6. **google-services.json** dosyasını indirin

### 2. Dosyayı Projeye Ekleyin

1. İndirdiğiniz `google-services.json` dosyasını `mobile/` klasörüne kopyalayın
2. Dosya adının tam olarak `google-services.json` olduğundan emin olun

### 3. Dosya Yapısı

```
mobile/
  ├── google-services.json  ← Buraya ekleyin
  ├── app.json
  ├── package.json
  └── ...
```

### 4. Git'e Eklemeyin (Güvenlik)

`google-services.json` dosyası hassas bilgiler içerir, bu yüzden `.gitignore` dosyasına eklenmiştir.

### 5. Build

Dosyayı ekledikten sonra yeni bir build alın:

```bash
cd mobile
eas build --platform android --profile production
```

## Önemli Notlar

- `google-services.json` dosyası Firebase Console'dan indirilmelidir
- Package name: `com.sorucoz.app` olmalıdır
- Dosya proje root'unda (`mobile/` klasöründe) olmalıdır
- `app.json` içinde `android.googleServicesFile: "./google-services.json"` olarak yapılandırılmıştır

## Sorun Giderme

Eğer Google Sign-In hala çalışmıyorsa:

1. Firebase Console'da Android app'in doğru package name ile kayıtlı olduğundan emin olun
2. OAuth 2.0 Client IDs'de Android Client ID'nin doğru olduğunu kontrol edin
3. SHA-1 fingerprint'in Firebase Console'a eklendiğinden emin olun (EAS Build otomatik ekler)
