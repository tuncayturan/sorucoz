# Bildirim Sistemi Dokümantasyonu

## Genel Bakış

Sistem hem **FCM (Firebase Cloud Messaging)** hem de **Expo Push Notifications** destekler:
- **FCM**: Web uygulaması için (Firebase Cloud Messaging)
- **Expo Push**: Mobil uygulama için (React Native/Expo)

## Token Yönetimi

### Token Formatları

1. **FCM Token**: 
   - Format: Uzun base64 benzeri string (152+ karakter)
   - Örnek: `cXyZ123...` (uzun string)
   - Kullanım: Web uygulaması

2. **Expo Push Token**:
   - Format: `ExponentPushToken[...]` veya `ExpoPushToken[...]` veya `Expo-...`
   - Örnek: `ExponentPushToken[ABC123...]`
   - Kullanım: Mobil uygulama (Android/iOS)

### Token Ayrımı

`lib/notificationUtils.ts` içindeki `separateTokens()` fonksiyonu otomatik olarak token'ları ayırır:
- FCM token'ları → FCM servisine gönderilir
- Expo Push token'ları → Expo Push API'ye gönderilir
- Geçersiz token'lar → Atlanır ve loglanır

## Bildirim Gönderme

### API Endpoints

1. **`/api/admin/send-notification`**
   - Tek bir kullanıcıya bildirim gönderir
   - Parametreler: `userId`, `title`, `body`, `data`
   - Hem FCM hem Expo Push token'larını destekler

2. **`/api/admin/send-notification-to-students`**
   - Tüm öğrencilere bildirim gönderir
   - Parametreler: `title`, `body`, `data`
   - Paralel gönderim yapar

3. **`/api/admin/send-notification-to-admin`**
   - Tüm admin ve coach'lara bildirim gönderir
   - Parametreler: `title`, `body`, `data`

### Kullanım Örnekleri

#### Coach Etkinlik Oluşturduğunda
```typescript
fetch("/api/admin/send-notification-to-students", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Yeni Etkinlik",
    body: `${coachName} yeni bir etkinlik ekledi: ${eventTitle}`,
    data: {
      type: "event",
      eventId: eventId,
      coachId: coachId,
      url: "/etkinlikler",
    },
  }),
});
```

#### Mesajlaşma
```typescript
fetch("/api/admin/send-notification", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: receiverId,
    title: "Yeni Mesaj",
    body: messageText,
    data: {
      type: "message",
      conversationId: conversationId,
      receiverRole: "student", // veya "coach"
    },
  }),
});
```

## Hata Yönetimi

### FCM Hataları

- **Invalid Token**: Token geçersiz → Veritabanından silinmeli
- **Unregistered**: Cihaz kaydı silinmiş → Token silinmeli
- **Rate Limit**: Çok fazla istek → Throttle mekanizması devreye girer

### Expo Push Hataları

- **DeviceNotRegistered**: Cihaz kaydı yok → Token silinmeli
- **MessageTooBig**: Mesaj çok büyük → Mesaj kısaltılmalı
- **MessageRateExceeded**: Rate limit aşıldı → Bekleme süresi

### Fallback Mekanizmaları

1. **Partial Failure Handling**: 
   - Bazı token'lar başarılı, bazıları başarısız olabilir
   - Her token için ayrı sonuç döner
   - Başarısız token'lar loglanır

2. **Error Recovery**:
   - Network hataları için retry mekanizması yok (şimdilik)
   - Hatalar loglanır ama ana akışı durdurmaz

3. **Token Cleanup**:
   - Geçersiz token'lar tespit edilir
   - Manuel olarak veya otomatik cleanup job ile silinebilir

## Rate Limiting

### FCM Limits
- Batch size: 500 token/batch
- Rate limit: Firebase tarafından yönetilir

### Expo Push Limits
- Batch size: 100 message/batch (Expo SDK otomatik yönetir)
- Rate limit: Expo tarafından yönetilir (access token ile artırılabilir)

### Request Deduplication

Her endpoint'te duplicate request önleme mekanizması var:
- **send-notification**: 30 saniye window
- **send-notification-to-students**: Paralel gönderim (duplicate önleme yok)
- **send-notification-to-admin**: 2 saniye window

## Güvenlik

1. **Token Validation**: 
   - Token format kontrolü yapılır
   - Geçersiz token'lar atlanır

2. **Error Logging**:
   - Hatalar detaylı loglanır
   - Production'da stack trace gizlenir

3. **Data Sanitization**:
   - Tüm data string'e çevrilir (FCM requirement)
   - XSS koruması için özel karakterler temizlenir

## Monitoring

### Log Formatları

```
[Push Notification] Token breakdown: X FCM, Y Expo, Z invalid
[Push Notification] ✅ FCM batch: X sent, Y failed
[Push Notification] ✅ Expo: X sent, Y failed
[Push Notification] 📊 Final results: FCM X/Y, Expo X/Y
```

### Metrics

Her bildirim gönderiminde şu bilgiler döner:
- `fcmSent`: Başarılı FCM gönderimleri
- `expoSent`: Başarılı Expo gönderimleri
- `fcmFailed`: Başarısız FCM gönderimleri
- `expoFailed`: Başarısız Expo gönderimleri

## Edge Cases

### 1. Kullanıcının Hem Web Hem Mobil Token'ı Var
- ✅ Her iki token'a da bildirim gönderilir
- ✅ Kullanıcı her iki cihazda da bildirim alır

### 2. Token Geçersiz
- ✅ Token atlanır, diğer token'lar gönderilmeye devam eder
- ⚠️ Geçersiz token'lar loglanır (manuel cleanup gerekebilir)

### 3. Network Hatası
- ✅ Hata loglanır, ana akış devam eder
- ⚠️ Retry mekanizması yok (şimdilik)

### 4. Boş Token Array
- ✅ Hiçbir şey gönderilmez, hata döndürülmez

### 5. Çok Fazla Token (1000+)
- ✅ FCM: 500'lük batch'lere bölünür
- ✅ Expo: 100'lük batch'lere bölünür (Expo SDK otomatik)

### 6. Concurrent Requests
- ✅ Her request ayrı işlenir
- ✅ Duplicate prevention mekanizması var

## Troubleshooting

### Bildirimler Gelmiyor

1. **Token Kontrolü**:
   - Firestore'da `users/{userId}/fcmTokens` array'ini kontrol et
   - Token formatını kontrol et (FCM vs Expo)

2. **İzin Kontrolü**:
   - Web: Browser notification permission
   - Mobil: Expo notification permission

3. **Log Kontrolü**:
   - Backend loglarında hata var mı?
   - Token breakdown loglarına bak

4. **Service Worker** (Web):
   - Service worker aktif mi?
   - `firebase-messaging-sw.js` yükleniyor mu?

### Geçersiz Token'lar

1. **Tespit**:
   - Backend loglarında "invalid token" uyarıları
   - Expo Push "DeviceNotRegistered" hataları

2. **Temizleme**:
   - Manuel: Firestore'dan token'ı sil
   - Otomatik: Cleanup job oluşturulabilir (şimdilik yok)

## Gelecek İyileştirmeler

1. ✅ Expo Push Token desteği eklendi
2. ⏳ Retry mekanizması (network hataları için)
3. ⏳ Otomatik token cleanup job
4. ⏳ Bildirim delivery tracking
5. ⏳ Analytics ve metrics dashboard
