# Coach Öğrenci Takip Sistemi

Coach paneline öğrenci takip ve soru görüntüleme sistemi başarıyla eklendi! 🎉

## 🎯 Özellikler

### 1. **Öğrenciler Listesi** (`/coach/students`)
- Tüm kayıtlı öğrencilerin listesi
- Her öğrenci için:
  - Profil fotoğrafı/avatar
  - Ad, email
  - Abonelik planı (Trial/Lite/Premium)
  - **Toplam soru sayısı**
  - **Çözülen soru sayısı**
  - **Son aktivite tarihi**
- Arama özelliği (ad veya email)
- Sıralama: En son soru sorandan başlayarak

### 2. **Öğrenci Detay Sayfası** (`/coach/students/[id]`)
- Öğrenci profil bilgileri
- **"Mesaj Gönder" butonu** (chat sayfasına yönlendirir)
- Derslere göre filtreleme (tab sistemi)
- Tüm sorular derslere göre gruplu
- **Soru önizleme görselleri** (24x24 küçük görsel)
- Her ders için soru sayısı
- Soruların durumu (Beklemede/Yanıtlandı/Çözüldü)
- En son yüklenen soru en üstte

### 3. **Soru Detay Sayfası** (`/coach/students/[id]/question/[questionId]`)
- **"Mesaj Gönder" butonu** (sağ üstte)
- Soru görseli/PDF (büyük gösterim)
- Ders bilgisi (renkli kartlar)
- Durum badge'i
- **📝 Çözüm Adımları** (numaralanmış, mavi kartlar)
- **💡 Açıklama** (yeşil kart)
- **✅ Son Cevap** (sarı-turuncu kart, vurgulu)
- **🤖 AI Çözümü** (ham veri, mor kart, monospace)
- **👨‍🏫 Coach Notları** (varsa, yeşil kart)
- Öğrenci bilgileri

### 4. **Mesaj Gönderme Entegrasyonu** 💬
- **Öğrenci listesinde:** Her kartta "Mesaj" butonu
- **Öğrenci detayında:** "Mesaj Gönder" butonu
- **Soru detayında:** "Mesaj Gönder" butonu (sağ üst)
- **Otomatik conversation açma:** Eğer conversation yoksa otomatik oluşturuluyor
- **Direkt yönlendirme:** Chat sayfasında öğrenci otomatik seçili
- **URL parametreleri:** `studentId` ile spesifik öğrenci

## 📋 Sayfa Yapısı

```
/coach/students
  ├── page.tsx                    # Öğrenci listesi
  └── [id]/
      ├── page.tsx                # Öğrenci detay + sorular
      └── question/
          └── [questionId]/
              └── page.tsx        # Soru detayı
```

## 🎨 UI/UX Özellikleri

### Öğrenci Listesi Kartları
- Modern grid layout (1-2-3 sütun, responsive)
- **Profil fotoğrafları** (Google fotoğrafı veya baş harf avatar)
- Hover efektleri (scale, shadow)
- İstatistik kartları (mavi-yeşil gradient)
- Plan badge'leri (renkli)
- Son aktivite bilgisi
- **"Mesaj" butonu** (yeşil, küçük)

### Öğrenci Detay Sayfası
- Üst kısımda öğrenci profil kartı
- **"Mesaj Gönder" butonu** (profil kartında)
- Ders filtreleme tab'ları
  - "Tümü" seçeneği
  - Her ders için icon ve sayı
  - Aktif tab yeşil gradient
- Sorular listesi (büyük kartlar)
  - **Soru önizleme görselleri** (24x24, sağda)
  - PDF icon'u (PDF soruları için)
  - Placeholder icon (görsel yoksa)
- Tıklanabilir sorular

### Soru Detay Sayfası
- Breadcrumb navigasyon (sol üst)
- **"Mesaj Gönder" butonu** (sağ üst)
- Ders badge'i (renkli, iconlu)
- Durum göstergesi
- Soru görseli (tam boyut, responsive)
- **📝 Çözüm Adımları** (numaralı, mavi gradient)
- **💡 Açıklama** (detaylı, yeşil gradient)
- **✅ Son Cevap** (vurgulu, sarı-turuncu gradient)
- **🤖 AI Çözümü** (ham veri, mor gradient, monospace)
- **👨‍🏫 Coach Notları** (varsa, yeşil gradient)

## 🎨 Renk Şeması (Dersler)

| Ders | Gradient | Icon |
|------|----------|------|
| Matematik | Mavi-İndigo | 🔢 |
| Fizik | Mor-Pembe | ⚛️ |
| Kimya | Yeşil-Zümrüt | 🧪 |
| Biyoloji | Kırmızı-Gül | 🔬 |
| Türkçe | Sarı-Turuncu | 📝 |
| Tarih | Kehribar-Sarı | 📜 |
| Coğrafya | Turkuaz-Cyan | 🌍 |
| Felsefe | İndigo-Mor | 💭 |
| ve diğerleri... | | |

## 🔄 Navigasyon Akışı

```
Coach Ana Sayfa
    ↓
Öğrenciler (liste) → [Mesaj] → Chat (otomatik conversation)
    ↓
Öğrenci Detay (derslere göre sorular) → [Mesaj Gönder] → Chat
    ↓
Soru Detayı (görsel + çözüm) → [Mesaj Gönder] → Chat
    ↑
Geri butonları ile kolay navigasyon
```

## 💬 Mesaj Gönderme Akışları

### Akış 1: Öğrenci Listesinden
```
Öğrenciler Listesi
  ↓ [Mesaj butonu]
Chat Sayfası (öğrenci otomatik seçili)
  ↓
Conversation yoksa otomatik oluştur
  ↓
Mesaj gönder
```

### Akış 2: Öğrenci Detayından
```
Öğrenci Detay Sayfası
  ↓ [Mesaj Gönder butonu]
Chat Sayfası (öğrenci otomatik seçili)
  ↓
Mesaj gönder
```

### Akış 3: Soru Detayından
```
Soru İnceleme
  ↓ [Mesaj Gönder butonu - sağ üst]
Chat Sayfası (öğrenci otomatik seçili)
  ↓
Soru hakkında mesaj at
```

## 📊 Sıralama ve Filtreleme

### Öğrenci Listesi
- **Varsayılan:** En son soru sorandan başlayarak
- **Arama:** Ad veya email ile filtreleme
- **Real-time güncelleme yok** (sayfa yenilenmeli)

### Öğrenci Detay
- **Varsayılan:** Tüm sorular, en yeniden eskiye
- **Filtreleme:** Derse göre tab'lar
- **İlk açılış:** En çok sorusu olan ders seçili

### Soru Detay
- **Read-only:** Coach sadece görüntüler
- **AI çözümü:** Varsa gösterilir
- **Coach notları:** Varsa gösterilir

## 🚀 Kullanım

### Coach Perspektifinden

1. **Öğrencileri Görüntüleme:**
   - Menüden "Öğrenciler" seçin
   - Tüm öğrencileri görün
   - Arama ile spesifik öğrenci bulun
   - **Her kartta "Mesaj" butonu ile hızlıca mesajlaş**

2. **Öğrenci Detayına Gitme:**
   - Öğrenci kartına tıklayın
   - Öğrencinin tüm sorularını görün
   - Derslere göre filtreleyin
   - **"Mesaj Gönder" butonu ile chat'e git**

3. **Soru İnceleme:**
   - Soru kartına tıklayın (önizleme görseli ile)
   - Soru görselini tam boyutta görün
   - **Çözüm adımlarını inceleyin** (numaralı)
   - **Açıklamayı okuyun**
   - **Son cevabı görün**
   - AI çözümünü inceleyin
   - Coach notlarını okuyun
   - **"Mesaj Gönder" ile öğrenciye ulaş**

## 📁 Veri Yapısı

### Student Document (Firestore)
```typescript
users/{studentId} {
  name: string,
  email: string,
  photoURL?: string,
  subscriptionPlan: "trial" | "lite" | "premium",
  role: "student",
  createdAt: Timestamp,
  // ... diğer alanlar
}
```

### Question Document (Firestore)
```typescript
users/{studentId}/sorular/{questionId} {
  ders: string,
  status: "pending" | "answered" | "solved",
  imageUrl?: string,
  pdfUrl?: string,
  aiSolution?: string,
  coachNotes?: string,
  createdAt: Timestamp,
  // ... diğer alanlar
}
```

## 🎯 İstatistikler

Her öğrenci için real-time hesaplanan:
- **totalQuestions:** Toplam soru sayısı
- **solvedQuestions:** Çözülen soru sayısı
- **lastQuestionTime:** Son soru zamanı

## 🔐 Güvenlik

- ✅ Coach role kontrolü (her sayfada)
- ✅ Öğrenci varlık kontrolü
- ✅ Soru varlık kontrolü
- ✅ Otomatik yönlendirmeler (401)

## 📱 Responsive Tasarım

- **Mobile:** 1 sütun grid
- **Tablet:** 2 sütun grid
- **Desktop:** 3 sütun grid
- Tüm kartlar touch-friendly
- Sidebar menü (mobile overlay)

## 🎨 Coach Menüsü (Güncel)

```
🏠 Ana Sayfa
👥 Öğrenciler        ← YENİ!
💬 Mesajlar
📅 Takvim
👤 Profil
```

## 🆕 Eklenen/Güncellenen Dosyalar

1. **`app/coach/students/page.tsx`** (YENİ)
   - Öğrenci listesi sayfası
   - Arama ve istatistikler
   - **Profil fotoğrafı gösterimi** (Google + fallback)
   - **"Mesaj" butonları**

2. **`app/coach/students/[id]/page.tsx`** (YENİ)
   - Öğrenci detay sayfası
   - Ders filtreleme
   - **Soru önizleme görselleri** (24x24)
   - Soru listesi
   - **"Mesaj Gönder" butonu**

3. **`app/coach/students/[id]/question/[questionId]/page.tsx`** (YENİ)
   - Soru detay sayfası
   - Tam boyut görsel gösterimi
   - **Çözüm adımları, açıklama, son cevap**
   - AI çözümü (ham veri)
   - Coach notları
   - **"Mesaj Gönder" butonu** (sağ üst)

4. **`app/coach/layout.tsx`** (GÜNCELLENDİ)
   - "Öğrenciler" menü item'ı eklendi

5. **`app/coach/chat/page.tsx`** (GÜNCELLENDİ)
   - `studentId` parametresi desteği
   - Otomatik conversation açma
   - **Otomatik conversation oluşturma** (yoksa)

## 💡 Gelecek İyileştirmeler (Opsiyonel)

1. **Soru Düzenleme:**
   - Coach notları ekleme/düzenleme
   - Durum değiştirme

2. **İstatistik Dashboard:**
   - Ders başarı oranları
   - Grafik gösterimleri
   - Haftalık/aylık analiz

3. **Filtreleme Seçenekleri:**
   - Plan türüne göre
   - Son aktivite tarihine göre
   - Soru sayısına göre

4. **Toplu İşlemler:**
   - Birden fazla soruya aynı anda not ekleme
   - Toplu durum güncelleme

## ✨ Yeni Özellikler (Son Güncelleme)

### 1. **Profil Fotoğrafları** 📸
- ✅ Google fotoğrafları düzgün gösteriliyor
- ✅ Fotoğraf yoksa baş harf avatar
- ✅ `onError` handler ile fallback
- ✅ `referrerPolicy="no-referrer"` (CORS sorunu yok)

### 2. **Soru Önizleme Görselleri** 🖼️
- ✅ Soru listesinde 24x24 küçük önizleme
- ✅ Görsel, PDF icon veya placeholder
- ✅ `onError` handler ile güvenli gösterim

### 3. **Detaylı Soru Çözümü** 📝
- ✅ **Çözüm Adımları:** Numaralı, mavi kartlar
- ✅ **Açıklama:** Yeşil gradient kart
- ✅ **Son Cevap:** Sarı-turuncu vurgulu kart
- ✅ **AI Çözümü:** Ham veri, monospace font

### 4. **Mesaj Gönderme Entegrasyonu** 💬
- ✅ **3 yerde mesaj butonu:**
  - Öğrenci listesi (her kartta)
  - Öğrenci detay (profil kartında)
  - Soru detay (sağ üst köşede)
- ✅ **Otomatik conversation açma**
- ✅ **Conversation yoksa otomatik oluşturma**
- ✅ **Direkt mesajlaşmaya başlama**

## 🎉 Sonuç

Coach'lar artık tüm öğrencilerini tek yerden takip edebilir:
- ✅ Öğrenci listesi ve istatistikleri (fotoğraflarla)
- ✅ Derslere göre soru görüntüleme (önizlemeli)
- ✅ Detaylı soru inceleme (adım adım çözüm)
- ✅ AI çözümleri ve coach notları
- ✅ **Her yerden mesaj gönderme** (tek tık)
- ✅ **Otomatik conversation yönetimi**
- ✅ Modern, kullanıcı dostu arayüz

Sistem tamamen hazır ve kullanıma hazır! 🚀

