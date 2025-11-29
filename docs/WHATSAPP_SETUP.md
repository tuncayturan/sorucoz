# WhatsApp Entegrasyonu Kurulumu

Bu doküman, coach'lara WhatsApp üzerinden bildirim göndermek için gerekli kurulum adımlarını açıklar.

## Özellikler

✅ **Tamamen Ücretsiz** - whatsapp-web.js kullanarak WhatsApp Web üzerinden mesaj gönderimi  
✅ **Otomatik Bildirimler** - Öğrenci mesaj gönderdiğinde coach'a WhatsApp bildirimi  
✅ **QR Kod ile Bağlantı** - Kolay kurulum, sadece QR kod tarama  

## Kurulum Adımları

### 1. Paketler Yüklendi

Gerekli paketler zaten yüklü:
- `whatsapp-web.js` - WhatsApp Web API
- `qrcode-terminal` - QR kod gösterimi

### 2. WhatsApp Bağlantısı Kurma

**İlk Kullanım:**

1. Uygulamayı başlatın:
   ```bash
   npm run dev
   ```

2. Server başladığında, terminal'de bir QR kod görünecek.

3. WhatsApp uygulamanızı açın ve:
   - **Android**: Menü (⋮) > Bağlı Cihazlar > Cihaz Bağla
   - **iPhone**: Ayarlar > Bağlı Cihazlar > Cihaz Bağla

4. QR kodu tarayın.

5. Bağlantı kurulduktan sonra terminal'de "✅ WhatsApp bağlantısı hazır!" mesajını göreceksiniz.

**Not:** QR kod sadece ilk bağlantıda gösterilir. Sonraki başlatmalarda otomatik olarak bağlanır.

### 3. Coach WhatsApp Numarası Ekleme

1. Coach olarak giriş yapın.
2. Profil sayfasına gidin (`/coach/profile`).
3. "WhatsApp Numarası" alanına numaranızı girin:
   - Format: `+905551234567` veya `905551234567`
   - Ülke kodu ile birlikte (Türkiye için +90)
4. "Kaydet" butonuna tıklayın.

### 4. Test Etme

Bir öğrenci coach'a mesaj gönderdiğinde:
- Coach'a FCM bildirimi gönderilir (uygulama içi)
- Coach'un WhatsApp numarası kayıtlıysa, WhatsApp bildirimi de gönderilir

## API Kullanımı

### WhatsApp Mesaj Gönderme

```typescript
POST /api/whatsapp/send
Body: {
  userId: string,      // Coach'un user ID'si
  message: string      // Gönderilecek mesaj
}
```

### WhatsApp Durum Kontrolü

```typescript
GET /api/whatsapp/status
Response: {
  isReady: boolean,        // WhatsApp bağlantısı hazır mı?
  isInitializing: boolean  // Şu anda bağlantı kuruluyor mu?
}
```

## Önemli Notlar

⚠️ **Hesap Güvenliği:**
- WhatsApp Web oturumu açık kalmalı (server çalışırken)
- Çok fazla mesaj gönderilirse hesap ban riski olabilir
- Sadece bildirim amaçlı kullanın, spam yapmayın

⚠️ **Server Gereksinimleri:**
- WhatsApp Web oturumu sürekli açık kalmalı
- Server yeniden başlatıldığında QR kod tekrar gösterilebilir
- `.wwebjs_auth` klasörü oturum bilgilerini saklar (gitignore'a eklenmeli)

## Sorun Giderme

### QR Kod Görünmüyor
- Server'ı yeniden başlatın
- `.wwebjs_auth` klasörünü silip tekrar deneyin

### Mesaj Gönderilmiyor
- WhatsApp bağlantısının hazır olduğunu kontrol edin: `GET /api/whatsapp/status`
- Coach'un WhatsApp numarasının doğru formatta olduğunu kontrol edin
- Server loglarını kontrol edin

### Bağlantı Kesiliyor
- WhatsApp uygulamanızda "Bağlı Cihazlar" listesini kontrol edin
- Server'ı yeniden başlatıp QR kod ile tekrar bağlanın

## Güvenlik

- `.wwebjs_auth` klasörünü `.gitignore`'a ekleyin
- WhatsApp oturum bilgileri bu klasörde saklanır
- Production'da güvenli bir şekilde saklayın

