# API Key Kaynakları Arasındaki Fark

## 1. Google AI Studio (Önerilen)
**URL:** https://aistudio.google.com/app/api-keys

### Özellikler:
- ✅ **Gemini API için özel olarak tasarlanmış**
- ✅ **Daha basit ve hızlı**
- ✅ **Otomatik olarak Gemini API için yetkilendirilmiş**
- ✅ **Ücretsiz tier için optimize edilmiş**
- ✅ **Doğrudan Gemini API kullanımı için**

### Ne Zaman Kullanılır:
- Gemini API kullanmak istediğinizde
- Hızlı başlangıç için
- Test ve geliştirme için

---

## 2. Google Cloud Console
**URL:** https://console.cloud.google.com/apis/credentials

### Özellikler:
- ✅ **Tüm Google Cloud API'leri için genel yönetim**
- ✅ **Daha detaylı ayarlar ve kısıtlamalar**
- ✅ **Production ortamları için daha uygun**
- ⚠️ **Manuel olarak API'leri etkinleştirmeniz gerekebilir**
- ⚠️ **Daha karmaşık yapılandırma**

### Ne Zaman Kullanılır:
- Birden fazla Google Cloud API kullanıyorsanız
- Production ortamı için
- Detaylı güvenlik kısıtlamaları gerekiyorsa

---

## Hangisini Kullanmalıyım?

### Gemini API için: **Google AI Studio** (Önerilen)

**Neden?**
1. Gemini API için özel olarak tasarlanmış
2. Otomatik olarak doğru yetkilendirmeleri yapar
3. Daha basit ve hızlı
4. 401 hataları daha az görülür

### Adımlar:

1. **Google AI Studio'ya gidin:** https://aistudio.google.com/app/api-keys
2. **"Create API Key"** butonuna tıklayın
3. **"Create API key in new project"** veya mevcut projenizi seçin
4. API key'i kopyalayın

---

## Firebase Tarafından Oluşturulan API Key

Firebase tarafından otomatik oluşturulan API key'ler:
- ⚠️ Bazen Gemini API için yetkilendirilmemiş olabilir
- ⚠️ Sadece Firebase servisleri için optimize edilmiş olabilir
- ✅ Google Cloud Console'da görünebilir

**Çözüm:** Google AI Studio'dan yeni bir API key oluşturun.

---

## Önerilen Yaklaşım

1. **Google AI Studio'dan yeni API key oluşturun**
2. **`.env.local` dosyasını güncelleyin:**
   ```env
   GEMINI_API_KEY=YENİ_API_KEY_BURAYA
   ```
3. **Server'ı yeniden başlatın:**
   ```bash
   npm run dev
   ```
4. **Test edin**

---

## Her İkisini de Kullanabilirsiniz

- **Google AI Studio:** Gemini API için (önerilen)
- **Google Cloud Console:** Diğer Google Cloud API'leri için

Her ikisi de aynı Google Cloud projesi altında çalışır, sadece oluşturma yöntemi farklıdır.

