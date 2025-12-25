# Firebase Console Yapılandırması - Google Sign-In için

## Önemli: Bu adımlar ZORUNLUDUR!

Mobilde Google Sign-In'in çalışması için Firebase Console'da authorized redirect URI'leri eklemeniz gerekiyor.

## Adımlar:

1. **Firebase Console'a gidin**: https://console.firebase.google.com/
2. **Projenizi seçin**: `sorucoz-6deb3`
3. **Authentication** > **Sign-in method** > **Google** bölümüne gidin
4. **Authorized redirect URIs** bölümüne şu URL'leri ekleyin (sadece HTTPS URL'ler):

   ```
   https://sorucoz-production-8e36.up.railway.app/auth/callback
   https://sorucoz-6deb3.firebaseapp.com/__/auth/handler
   ```

   **NOT**: `com.sorucoz.app://auth/callback` gibi deep link'leri buraya ekleyemezsiniz. Firebase Console sadece HTTPS URL'leri kabul eder. Deep link yönlendirmesi Firebase tarafından otomatik yapılır.

5. **Authorized domains** bölümünde `com.sorucoz.app` zaten ekli olmalı (siz eklemişsiniz)
6. **Kaydedin**

## Neden Gerekli?

- `signInWithRedirect` kullanıldığında, Firebase Google Sign-In sayfasına yönlendirir
- Google, authentication tamamlandıktan sonra kullanıcıyı belirtilen redirect URI'ye yönlendirir
- Mobilde bu, deep link (`com.sorucoz.app://auth/callback`) olmalı
- Web'de bu, HTTPS URL (`https://sorucoz-production-8e36.up.railway.app/auth/callback`) olmalı

## Test Etme

1. Android Studio'da uygulamayı rebuild edin
2. Emülatörde veya gerçek cihazda çalıştırın
3. "Google ile Giriş Yap" butonuna tıklayın
4. Sistem tarayıcısı açılmalı (WebView değil)
5. Google ile giriş yapın
6. Uygulamaya geri dönmelisiniz

## Sorun Giderme

- Eğer sistem tarayıcısı açılmıyorsa: `signInWithRedirect` WebView içinde kalıyor olabilir
- Eğer deep link çalışmıyorsa: AndroidManifest.xml'i kontrol edin
- Eğer hata alıyorsanız: Firebase Console'da redirect URI'lerin doğru eklendiğinden emin olun

