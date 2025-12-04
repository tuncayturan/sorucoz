# Coach Sohbet Temizleme Özelliği

Coach'ların öğrenci sohbetlerini temizleyebilme (gizleme) özelliği eklendi! 🗑️

## 🎯 Özellik

Coach bir öğrenci ile olan sohbeti "silmek" istediğinde:
- ✅ Sohbet **sadece coach için gizlenir**
- ✅ Öğrenci tarafında sohbet **görünmeye devam eder**
- ✅ Öğrenci eski mesajları görebilir ve yeni mesaj gönderebilir
- ✅ Coach için conversation listesinden **kaybolur**

## 🔧 Nasıl Çalışır?

### Silme İşlemi (Soft Delete)

1. **Coach "Sil" butonuna tıklar**
   - Conversation header'ındaki çöp kutusu icon'u
   - Onay dialogu gösterilir

2. **Onay verirse:**
   - Conversation document'ına `hiddenForCoach: true` eklenir
   - `hiddenAt: Timestamp` kaydedilir
   - **Conversation fiziksel olarak silinmez!**

3. **Coach tarafında:**
   - Conversation listesinden kaybolur
   - Artık bu öğrenci görünmez
   - Eski mesajlar gider

4. **Öğrenci tarafında:**
   - Hiçbir değişiklik yok
   - Tüm mesajlar görünür
   - Yeni mesaj gönderebilir
   - Coach yeni mesaj gönderirse conversation tekrar görünür

## 📊 Veri Yapısı

### Conversation Document (Firestore)
```typescript
conversations/{conversationId} {
  studentId: string,
  coachId: string,
  studentName: string,
  coachName: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  hiddenForCoach?: boolean,  // ✅ YENİ - Coach için gizli mi?
  hiddenAt?: Timestamp,       // ✅ YENİ - Ne zaman gizlendi?
}
```

## 🎨 UI/UX

### Silme Butonu
- **Konum:** Conversation header'ında (sağ üst)
- **Icon:** Çöp kutusu (🗑️)
- **Renk:** Kırmızı hover efekti
- **Tooltip:** "Sohbeti Temizle"

### Onay Dialogu
```
{Öğrenci Adı} ile olan sohbeti silmek istediğinize emin misiniz?

Bu işlem sadece sizin için sohbeti gizleyecek. 
Öğrenci mesajları görmeye devam edecek.

[İptal] [Sil]
```

### Toast Bildirimleri
- ✅ "Sohbet başarıyla temizlendi!" (success)
- ❌ "Sohbet silinirken bir hata oluştu." (error)

## 🔄 İşlem Akışı

### Senaryo 1: Coach Sohbeti Temizler
```
Coach Chat Sayfası
  ↓
Conversation seçili
  ↓
[Sil] butonuna tıkla
  ↓
Onay ver
  ↓
Firestore: hiddenForCoach = true
  ↓
Coach: Conversation listesinden kaybolur ✅
Öğrenci: Hiçbir değişiklik yok ✅
```

### Senaryo 2: Öğrenci Yeni Mesaj Gönderirse
```
Öğrenci mesaj gönderir
  ↓
Conversation update olur
  ↓
Coach için tekrar görünür mü? ❌
  (hiddenForCoach hala true)
  ↓
Coach manuel gizleme kaldırmalı veya yeni conversation oluşturmalı
```

## 💡 Teknik Detaylar

### Filtreleme Kodu
```typescript
// Conversation fetch ederken
for (const convDoc of conversationsSnapshot.docs) {
  const convData = convDoc.data();
  
  // Coach tarafından gizlenmiş conversation'ları atla
  if (convData.hiddenForCoach === true) {
    continue; // ← Listeye ekleme
  }
  
  // ... conversation'ı listeye ekle
}
```

### Silme Fonksiyonu
```typescript
const handleHideConversation = async () => {
  // Onay al
  const confirmDelete = window.confirm(...);
  if (!confirmDelete) return;
  
  // Firestore güncelle
  await updateDoc(conversationRef, {
    hiddenForCoach: true,
    hiddenAt: serverTimestamp(),
  });
  
  // State'den kaldır
  setConversations(prev => prev.filter(c => c.id !== selectedConversation.id));
  setSelectedConversation(null);
  
  showToast("Sohbet başarıyla temizlendi!", "success");
};
```

## 🚀 Kullanım

### Coach Perspektifinden

1. **Sohbeti Açın:**
   - Conversation listesinden öğrenci seçin
   - Veya öğrenci sayfasından "Mesaj Gönder"

2. **Sil Butonuna Tıklayın:**
   - Header'daki kırmızı çöp kutusu icon'u
   - Conversation başlığının yanında

3. **Onay Verin:**
   - Onay dialogunda durumu okuyun
   - "Sil" butonuna tıklayın

4. **Sonuç:**
   - ✅ Toast bildirimi: "Sohbet başarıyla temizlendi!"
   - ✅ Conversation listesinden kaybolur
   - ✅ Öğrenci için hala görünür

## 🔐 Güvenlik

- ✅ Fiziksel silme yok (veri kaybı yok)
- ✅ Sadece coach'ın görünümünü etkiler
- ✅ Öğrenci hakları korunur
- ✅ Conversation ID tutarlı kalır
- ✅ Mesaj geçmişi korunur

## 📝 Notlar

### Avantajlar
- 🔒 **Veri Güvenliği:** Mesajlar fiziksel olarak silinmez
- 👁️ **Görünüm Kontrolü:** Coach kendi listesini temizler
- 🎯 **Öğrenci Hakları:** Öğrenci tüm mesajları görebilir
- 🔄 **Geri Alınabilir:** Admin veritabanından `hiddenForCoach` field'ını kaldırabilir

### Dikkat Edilmesi Gerekenler
- ⚠️ Gizlendikten sonra tekrar görünür olmaz (öğrenci yeni mesaj atsa bile)
- ⚠️ Coach yeni mesaj atmak isterse yeni conversation oluşturmalı
- 💡 İsterseniz "gizleme kaldır" özelliği de eklenebilir (gelecekte)

## 🎉 Sonuç

Coach'lar artık sohbet listelerini temizleyebilir:
- ✅ Gereksiz conversation'ları gizle
- ✅ Liste düzenli kalsın
- ✅ Öğrenci hakları korunsun
- ✅ Veri kaybı olmasın

Sistem tamamen hazır! 🚀

