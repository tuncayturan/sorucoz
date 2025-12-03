# FCM VAPID Key Kurulumu

## ⚠️ ÖNEMLİ: Gerçek VAPID Key Alın

Şu anda uygulama **default VAPID key** kullanıyor. Bu test için çalışabilir ama **production'da kendi VAPID key'inizi kullanmalısınız**.

## 🔑 Firebase Console'dan VAPID Key Alma

### Adım 1: Firebase Console'a Gidin
1. [Firebase Console](https://console.firebase.google.com/) açın
2. Projenizi seçin (`sorucoz-6deb3`)

### Adım 2: Cloud Messaging Ayarlarına Gidin
1. Sol menüden **⚙️ Project Settings** (Proje Ayarları) tıklayın
2. Üstteki sekmelerden **Cloud Messaging** sekmesine tıklayın

### Adım 3: Web Push Certificate Oluşturun
1. Aşağı kaydırın, **Web Push certificates** bölümünü bulun
2. Eğer zaten bir key varsa, onu kullanın
3. Yoksa **Generate key pair** (Anahtar çifti oluştur) butonuna tıklayın
4. Oluşturulan key'i kopyalayın (örnek: `BKx7s...` ile başlar)

### Adım 4: Railway'e VAPID Key Ekleyin

#### Railway Dashboard'da:
1. [Railway Dashboard](https://railway.app/) açın
2. Projenizi seçin
3. Service'inizin **Variables** sekmesine gidin
4. **New Variable** tıklayın
5. Şu değişkeni ekleyin:
   ```
   NEXT_PUBLIC_FIREBASE_VAPID_KEY=BKx7s... (Firebase'den aldığınız key)
   ```
6. **Deploy** otomatik başlayacak

#### Lokal Development için (.env.local):
```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BKx7s... (Firebase'den aldığınız key)
```

## 🧪 Test Etme

VAPID key doğru eklendiğinde:

### Console Logları:
```
[FCM] ✅ VAPID key found: using environment variable
[FCM] Requesting token from Firebase...
[FCM] Token retrieved successfully: cxyzABC123...
```

### Firestore'da:
- `users/{userId}` dökümanında `fcmTokens` array'inde token görünecek

## ❌ Sorun Giderme

### "No token available" Hatası:
- VAPID key doğru mu kontrol edin
- Firebase Console'da Cloud Messaging API aktif mi?
- Bildirim izni verilmiş mi?

### Default Key Uyarısı:
```
[FCM] ⚠️ Using default VAPID key
```
Bu görünüyorsa, Railway'de environment variable ekleyin.

### Token Alındı Ama Bildirim Gelmiyor:
- VAPID key yanlış olabilir
- Firebase Console'dan **doğru** key'i aldığınızdan emin olun
- Key genellikle `BK` veya `BP` ile başlar ve ~90 karakter uzunluğundadır

## 📱 Mobil Test

1. Railway'e deploy ettikten sonra
2. Mobil cihazdan siteye giriş yapın
3. Bildirim izni popup'ı çıkacak
4. "İzin Ver" deyin
5. Console'da token loglarını kontrol edin
6. Firestore'da `fcmTokens` array'ini kontrol edin

## 🔒 Güvenlik Notu

VAPID key bir **public key**'dir, client-side kod'da kullanılması güvenlidir. Private key Firebase'de kalır.

