# API Key Ayarları - Test İçin

## Mevcut Ayarlar ✅

Görüntüdeki ayarlar doğru görünüyor:
- ✅ "Generative Language API" listede
- ✅ "Restrict key" seçili ve doğru API seçilmiş

## Test İçin Önerilen Ayar

401 hatası devam ediyorsa, test için şunu deneyin:

### Seçenek 1: Don't Restrict Key (Test İçin)

1. **"API restrictions" bölümünde:**
   - "Don't restrict key" seçeneğini seçin
   - Bu, test için tüm API'lere erişim sağlar

2. **"Save" butonuna tıklayın**

3. **5 dakika bekleyin** (ayarların uygulanması için)

4. **Server'ı yeniden başlatın:**
   - Terminal'de `Ctrl+C`
   - `npm run dev`

### Seçenek 2: Mevcut Ayarları Koruyun

Eğer "Generative Language API" zaten listede ise:
- Ayarları değiştirmeyin
- Sadece server'ı yeniden başlatın
- 5 dakika bekleyin (ayarların uygulanması için)

## Kontrol Listesi

1. ✅ "Generative Language API" listede mi? → Evet
2. ✅ Generative Language API etkin mi? → Kontrol edin: https://console.cloud.google.com/apis/library
3. ✅ Server yeniden başlatıldı mı? → Kontrol edin
4. ✅ 5 dakika beklendi mi? → Ayarların uygulanması için

## Sonraki Adım

1. **"Don't restrict key" seçeneğini seçin** (test için)
2. **"Save" butonuna tıklayın**
3. **5 dakika bekleyin**
4. **Server'ı yeniden başlatın**
5. **Test edin**

Eğer hala çalışmıyorsa, terminal loglarını kontrol edin.



