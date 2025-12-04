# Kullanıcı Ekleme Özelliği

Admin paneline tekli ve toplu kullanıcı ekleme sistemi başarıyla eklendi! 🎉

## Özellikler

### ✅ Tekli Kullanıcı Ekleme
- Ad Soyad ve Email ile tek kullanıcı ekleyebilirsiniz
- Şifre opsiyoneldir - boş bırakılırsa sistem otomatik güçlü şifre oluşturur
- Kullanıcı eklendikten sonra şifre görüntülenir (kaydetmek için)

### ✅ Toplu Kullanıcı Ekleme (Excel)
- Excel dosyası yükleyerek birden fazla kullanıcı ekleyebilirsiniz
- Gerekli sütunlar:
  - **Ad Soyad** (zorunlu)
  - **Email** (zorunlu)
  - **Şifre** (opsiyonel - boş ise otomatik oluşturulur)
- Excel şablonu indirme özelliği mevcut
- Başarılı ve başarısız kullanıcılar ayrı ayrı listelenir

### ✅ Sonuç Raporu
- Her işlem sonrası detaylı rapor gösterilir
- Başarıyla eklenen kullanıcılar ve şifreleri
- Hata alan kullanıcılar ve hata sebepleri
- Özet istatistikler

## Kullanım

1. Admin panelinde "Kullanıcılar" sayfasına gidin
2. Sağ üstteki "Kullanıcı Ekle" butonuna tıklayın
3. Modal açılacak - "Tekli Ekleme" veya "Toplu Ekleme" seçin

### Tekli Ekleme İçin:
1. Ad Soyad girin (zorunlu)
2. Email girin (zorunlu)
3. İsterseniz özel şifre belirleyin (boş bırakılabilir)
4. "Kullanıcı Ekle" butonuna tıklayın
5. Oluşturulan şifreyi kaydedin

### Toplu Ekleme İçin:
1. "Şablon İndir" butonuna tıklayarak örnek Excel dosyasını indirin
2. Excel dosyasını düzenleyin (Ad Soyad, Email, Şifre)
3. "Excel Dosyası Yükle" ile dosyayı seçin
4. Yüklenen kullanıcıları önizleyin
5. "X Kullanıcı Ekle" butonuna tıklayın
6. Sonuçları görüntüleyin ve şifreleri kaydedin

## Teknik Detaylar

### API Endpoint
- **Endpoint:** `POST /api/admin/create-users`
- **Body:** `{ users: [{ name, email, password? }] }`
- **Response:** Başarılı ve hatalı kullanıcıların detaylı listesi

### Otomatik Şifre Oluşturma
- 12 karakter uzunluğunda
- Büyük-küçük harf, rakam ve özel karakterler içerir
- Güvenli rastgele şifre üretimi

### Kullanıcı Verileri
Yeni kullanıcılar için varsayılan değerler:
- **role:** student
- **premium:** false
- **subscriptionPlan:** trial
- **subscriptionStatus:** trial
- **emailVerified:** true ✅ (Admin tarafından eklenen kullanıcılar otomatik onaylı)
- **createdAt:** Timestamp.now()

### Hata Yönetimi
- Email formatı kontrolü
- Tekrar eden email kontrolü
- Eksik alan kontrolü
- Detaylı hata mesajları
- Her kullanıcı için bağımsız işlem (bir hata diğerlerini etkilemez)

## Dosya Yapısı

```
app/
  api/
    admin/
      create-users/
        route.ts          # API endpoint - kullanıcı oluşturma
  admin/
    kullanicilar/
      page.tsx            # Güncellenmiş kullanıcılar sayfası

package.json              # xlsx paketi eklendi
```

## Bağımlılıklar

- `xlsx` - Excel dosyalarını okumak için
- `firebase-admin` - Kullanıcı authentication ve Firestore işlemleri

## Güvenlik

- Admin yetkisi gereklidir (middleware ile kontrol edilmelidir)
- Şifreler Firebase Authentication tarafından güvenli şekilde hashlenir
- Email benzersizliği Firebase tarafından garantilenir
- Şifreler sadece oluşturma sırasında gösterilir

## Notlar

⚠️ **Önemli:** Oluşturulan şifreler sadece bir kez gösterilir. Kullanıcılara iletmek için mutlaka kaydedin!

💡 **İpucu:** Excel şablonunu indirerek örnek formatı görebilirsiniz.

🎯 **Özellik:** Şifre alanı boş bırakılabilir - sistem otomatik güçlü şifre oluşturur.

