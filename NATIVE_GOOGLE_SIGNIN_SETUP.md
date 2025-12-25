# Native Google Sign-In Kurulum Rehberi

## ✅ Tamamlanan Adımlar

1. ✅ Android build.gradle'a Google Sign-In dependency eklendi
26. ✅ Capacitor plugin mantığı `MainActivity.java` içine eklendi (Inline Implementation)
3. ✅ JavaScript bridge eklendi (lib/google-sign-in.ts)
4. ✅ Login sayfasında native Google Sign-In entegrasyonu yapıldı
5. ✅ Firebase ile credential entegrasyonu tamamlandı

## ⚠️ ÖNEMLİ: Google Privacy Policy Gereksinimleri

Google Sign-In kullanırken **Google Cloud Console'da OAuth consent screen yapılandırması** yapmanız **ZORUNLUDUR**:

1. **Privacy Policy URL** - Zorunlu
2. **Terms of Service URL** - Zorunlu (genellikle)
3. **App name, logo, support email** - Zorunlu

Eğer bu yapılandırma yapılmazsa:
- Google Sign-In çalışmayabilir
- "Error 10: Developer Error" hatası alabilirsiniz
- Google uygulamanızı reddedebilir

### OAuth Consent Screen Yapılandırması

1. [Google Cloud Console](https://console.cloud.google.com/) → Projenizi seçin
2. **APIs & Services** → **OAuth consent screen**
3. **User Type** seçin (External veya Internal)
4. **App information** bölümünü doldurun:
   - **App name**: SoruÇöz
   - **User support email**: Email adresiniz
   - **App logo**: (Opsiyonel)
   - **Application home page**: `https://sorucoz-production-8e36.up.railway.app`
   - **Privacy Policy link**: `https://sorucoz-production-8e36.up.railway.app/privacy` (oluşturmanız gerekiyor)
   - **Terms of Service link**: `https://sorucoz-production-8e36.up.railway.app/terms` (oluşturmanız gerekiyor)
   - **Authorized domains**: `sorucoz-production-8e36.up.railway.app`
5. **Scopes** bölümünde:
   - `email`
   - `profile`
   - `openid`
6. **Test users** (Development modunda): Test edecek email adreslerini ekleyin
7. **Save and Continue**

### Privacy Policy ve Terms of Service Sayfaları Oluşturma

Bu sayfaları oluşturmanız gerekiyor:
- `/privacy` - Privacy Policy sayfası
- `/terms` - Terms of Service sayfası

Basit bir şekilde oluşturabilirsiniz veya hazır template kullanabilirsiniz.

## 🔧 Yapılması Gerekenler

### 1. Firebase Console'dan Web Client ID Alın

1. [Firebase Console](https://console.firebase.google.com/) → Projenizi seçin (`sorucoz-6deb3`)
2. **Project Settings** (⚙️) → **General** sekmesi
3. **Your apps** bölümünde **Web app**'i bulun
4. **OAuth 2.0 Client ID**'yi kopyalayın
   - Format: `XXXX-XXXX.apps.googleusercontent.com`

### 2. Android strings.xml'i Güncelleyin

`android/app/src/main/res/values/strings.xml` dosyasında:

```xml
<string name="default_web_client_id">YOUR_WEB_CLIENT_ID</string>
```

Bu satırı Firebase Console'dan aldığınız Web Client ID ile değiştirin:

```xml
<string name="default_web_client_id">1026488924758-XXXXXXXXXX.apps.googleusercontent.com</string>
```

### 3. Google Cloud Console'da OAuth 2.0 Yapılandırması

1. [Google Cloud Console](https://console.cloud.google.com/) → Projenizi seçin
2. **APIs & Services** → **Credentials**
3. **OAuth 2.0 Client IDs** bölümünde:
   - **Android** için bir client ID oluşturun (eğer yoksa)
   - **Package name**: `com.sorucoz.app`
   - **SHA-1 certificate fingerprint**: Debug ve Release için ekleyin

#### SHA-1 Fingerprint Nasıl Alınır?

**Debug keystore için:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Release keystore için:**
```bash
keytool -list -v -keystore android/app/my-release-key.keystore -alias my-key-alias
```

### 4. Capacitor Sync ve Build

```bash
# Capacitor sync
npx cap sync android

# Android Studio'da rebuild
# Build → Rebuild Project
```

## 🎯 Nasıl Çalışır?

1. Kullanıcı "Google ile Giriş Yap" butonuna tıklar
2. Native Google Sign-In dialog açılır (WebView değil!)
3. Kullanıcı Google hesabı seçer
4. Plugin, Google'dan `idToken` alır
5. Firebase'de `signInWithCredential` ile giriş yapılır
6. Kullanıcı verileri Firestore'a kaydedilir/güncellenir
7. Kullanıcı uygun sayfaya yönlendirilir

## 🔄 Fallback Mekanizması

Eğer native Google Sign-In başarısız olursa:
- Otomatik olarak `signInWithRedirect` kullanılır
- Kullanıcı deneyimi kesintisiz devam eder

## 📝 Notlar

- **Web'de çalışmaz**: Native plugin sadece Android/iOS'ta çalışır
- **Web'de**: `signInWithPopup` kullanılır (mevcut kod)
- **Android'de**: Önce native Sign-In denenir, başarısız olursa redirect kullanılır

## 🐛 Sorun Giderme

### "default_web_client_id is not set" hatası
- `strings.xml`'de `default_web_client_id` değerini kontrol edin
- Firebase Console'dan doğru Web Client ID'yi aldığınızdan emin olun

### "Google Sign-In failed" hatası
- Google Cloud Console'da Android OAuth client ID'nin doğru yapılandırıldığından emin olun
- SHA-1 fingerprint'in doğru eklendiğini kontrol edin

### Plugin bulunamıyor hatası
- `npx cap sync android` çalıştırın
- Android Studio'da **File → Invalidate Caches / Restart**

## ✅ Test Etme

1. Android Studio'da uygulamayı çalıştırın
2. Login sayfasına gidin
3. "Google ile Giriş Yap" butonuna tıklayın
4. Native Google Sign-In dialog açılmalı
5. Google hesabı seçin
6. Giriş başarılı olmalı

