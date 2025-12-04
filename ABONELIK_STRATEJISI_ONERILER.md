# Abonelik ve Yenileme Stratejisi Önerileri 🎯

## 📊 Mevcut Sistem

### Plan Yapısı
- **Trial:** 7 gün, günde 3 soru, ₺0
- **Lite:** 30 gün, günde 10 soru, ₺99
- **Premium:** 30 gün, sınırsız soru, ₺399

### Mevcut Davranış
- ✅ Trial bitince → Premium sayfasına yönlendiriliyor
- ✅ Lite/Premium bitince → Premium sayfasına yönlendiriliyor
- ❌ Süresi biten kullanıcı **hiçbir şey yapamıyor** (kilitleniyor)

## 🎯 Önerilen Stratejiler

### **Strateji 1: Freemium Modeli** (👍 ÖNERİLEN)

En popüler SaaS yaklaşımı - Kullanıcıyı kaybetme, dönüşüm oranını artırma.

#### Trial Bitince → "Freemium" (Ücretsiz Kısıtlı Mod)
```
Özellikler:
✅ Günde 1 soru (çok kısıtlı)
✅ Coach ile mesajlaşma (devam eder)
✅ Eski sorulara bakma
✅ İstatistiklere erişim
❌ AI çözüm yok (sadece coach çözümü)
❌ Öncelikli destek yok
```

**Avantajlar:**
- 👥 Kullanıcıyı kaybetmezsiniz
- 💰 Sürekli dönüşüm fırsatı
- 📈 Engagement yüksek kalır
- 🎓 Öğrenci alışkanlık kazanır

**Banner:**
```
⚠️ Trial süreniz doldu!
Günde sadece 1 soru sorabilirsiniz.
Sınırsız erişim için Premium'a geçin.
[Plan Seç]
```

#### Lite/Premium Bitince → Trial'a Geri Dön
```
Premium/Lite → Trial (günde 3 soru)
```

**Avantajlar:**
- 🔄 Kullanıcı sistemi kullanmaya devam eder
- 💳 Yenileme için baskı
- 📊 İstatistikleri görebilir

**Banner:**
```
⏰ Lite/Premium süreniz doldu!
Artık günde 3 soru sorabilirsiniz (Trial).
Daha fazla soru için planınızı yenileyin.
[Planı Yenile]
```

---

### **Strateji 2: Hard Paywall** (Agresif)

Kullanıcıyı zorlayarak hemen ödemeye yönlendirme.

#### Trial Bitince → TAM KİLİT
```
❌ Hiçbir soru soramaz
❌ Coach ile mesajlaşamaz
✅ Sadece eski sorulara bakabilir (read-only)
```

**Avantajlar:**
- 💰 Dönüşüm oranı potansiyel olarak yüksek
- 🎯 Net mesaj: "Ödemelisin"

**Dezavantajlar:**
- 👎 Kullanıcı kaybı çok yüksek
- 😞 Kötü UX
- 🚫 Öğrenci hayal kırıklığı

---

### **Strateji 3: Esnek Yenileme** (Dengeli)

Trial ve ödeme arasında dengeli yaklaşım.

#### Trial Bitince → "Extended Trial" (Uzatılmış Deneme)
```
İlk 7 gün: Günde 3 soru
8-14. gün: Günde 2 soru (Extended)
15-21. gün: Günde 1 soru (Last Chance)
22+ gün: Read-only (kilitleniyor)
```

**Avantajlar:**
- ⏰ Kademeli azaltma (ani şok yok)
- 🎯 Zamanla baskı artıyor
- 💡 Kullanıcı değeri görüyor

#### Lite/Premium Bitince → Grace Period (3 gün ödemesiz)
```
Son 3 gün: "Aboneliğiniz 3 gün içinde bitecek!" banner'ı
Bitiş günü: "Son gün!" banner'ı
Bittikten sonra +3 gün grace period: Tam erişim ama günde 1 uyarı
3 gün sonra: Trial'a dön (günde 3 soru)
```

**Avantajlar:**
- 🎁 Grace period → Kullanıcı memnuniyeti
- 💳 Yenileme hatırlatmaları
- 🔄 Ani kesinti yok

---

## 🏆 TAVSİYEM: Strateji 1 (Freemium) + Bonus Özellikler

### İdeal Akış

#### 1️⃣ Trial (7 gün)
```
✅ Günde 3 soru
✅ AI + Coach çözümü
✅ Tüm özellikler
```

**Banner (5-6-7. günler):**
```
⏰ Trial süreniz bitiyor! 
{X} gün kaldı. Premium'a geçin.
[Plan Seç]
```

#### 2️⃣ Trial Bitti → Freemium
```
✅ Günde 1 soru (AI çözüm YOK, sadece coach)
✅ Coach mesajlaşma
✅ Eski sorulara bakma
✅ İstatistikler
❌ AI çözüm yok
❌ Öncelikli destek yok
```

**Banner (her gün):**
```
🆓 Freemium modundasınız
Günde sadece 1 soru sorabilirsiniz.
AI çözüm almak için Premium'a geçin.
[Plan Seç]
```

#### 3️⃣ Lite/Premium Bitince → Freemium (veya Trial)

**Opsiyon A: Freemium'a dön**
```
Lite/Premium → Freemium (günde 1 soru, AI yok)
```

**Opsiyon B: Trial'a dön**
```
Lite/Premium → Trial (günde 3 soru, AI var, 7 gün)
```

**TAVSİYEM: Opsiyon B**
- Kullanıcı "premium tadını" hatırlar
- 7 gün içinde yenileme şansı yüksek
- Daha iyi UX

**Banner (son 7 gün):**
```
⏰ Aboneliğiniz {X} gün içinde bitecek!
Planınızı yenileyin, kesintisiz devam edin.
[Planı Yenile - %20 İndirim]
```

---

## 💡 Bonus Özellikler (Dönüşüm Artırıcı)

### 1. **Erken Yenileme İndirimi**
```typescript
// Son 7 gün içinde yenilerse %10-20 indirim
if (daysLeft <= 7 && daysLeft > 0) {
  discount = 20; // %20 indirim
} else if (daysLeft <= 14) {
  discount = 10; // %10 indirim
}
```

**Banner:**
```
🎁 Erken yenileme fırsatı!
Şimdi yenilerseniz %20 indirim!
[Yenile ve İndirim Kazan]
```

### 2. **Otomatik Yenileme (Opsiyonel)**
```
Kullanıcı onay verirse:
✅ 30 günde bir otomatik ödeme
✅ Kesinti yok
✅ Her yenilemede %10 sadakat indirimi
```

### 3. **Upgrade İndirimi**
```
Lite → Premium yükseltme:
✅ Kalan süre transfer edilir
✅ İlk ay %15 indirim
```

### 4. **Referans Programı**
```
Arkadaşını davet et:
✅ Arkadaşın kayıt olursa: Sen +3 gün premium
✅ Arkadaşın ödeme yaparsa: Sen %50 indirim kuponu
```

### 5. **Re-engagement Kampanyaları**
```
Expired kullanıcılara:
📧 Email: "Seni özledik! İlk ay %30 indirim"
🔔 Push: "Özel teklif: 7 gün trial + %20 indirim"
```

---

## 🔄 Önerilen Kullanıcı Akışı (UX Odaklı)

### Timeline:

```
Gün 0: Kayıt → 7 gün Trial (günde 3 soru, AI var)
  ↓
Gün 5: "⏰ 2 gün kaldı! Premium'a geçin."
Gün 6: "⚠️ Son gün! Yarın Freemium'a geçeceksiniz."
Gün 7: "🎁 Son şans! Bugün Premium alana %20 indirim!"
  ↓
Gün 8: Trial bitti → Freemium (günde 1 soru, AI yok)
  ↓
Gün 8-30: Freemium (her gün reminder banner)
  "🆓 Freemium modunda: Günde 1 soru. Premium için tıklayın."
  ↓
Gün 15: "🎯 Özel teklif! Bugün Premium'a geçersen +7 gün bonus!"
Gün 30: "💎 1 aylık kullanıcı bonusu: İlk ay %25 indirim!"
```

### Lite/Premium Kullanıcısı:

```
Premium Satın Alındı (30 gün)
  ↓
Gün 23: "⏰ 7 gün kaldı! Şimdi yenile, %15 indirim kazan."
Gün 27: "⚠️ 3 gün kaldı! Otomatik yenileme aktif et."
Gün 29: "🚨 Son gün! Yarın Trial'a düşeceksiniz."
Gün 30: "⏰ Süreniz doldu."
  ↓
Premium Bitti → Trial'a dön (7 gün, günde 3 soru, AI var)
  ↓
+7 gün sonra → Freemium
```

---

## 💰 Gelir Optimizasyonu

### Pricing Taktikleri:

1. **Yıllık Plan Ekle:**
```
Lite Aylık: ₺99/ay
Lite Yıllık: ₺990/yıl (₺82.5/ay) → %17 tasarruf

Premium Aylık: ₺399/ay
Premium Yıllık: ₺3,990/yıl (₺332.5/ay) → %17 tasarruf
```

2. **Aile Planı:**
```
Premium Aile (3 kullanıcı): ₺699/ay
(Tek başına 3x399 = ₺1,197 olurdu)
```

3. **Öğrenci İndirimi:**
```
Öğrenci belgesi ile: %20 indirim
Okul grubu (5+ kişi): %30 indirim
```

---

## 🎯 Implementasyon Önerileri

### Yapılması Gerekenler:

### 1. **Freemium Modu Ekle**

`lib/subscriptionUtils.ts` dosyasına:
```typescript
export function getDailyQuestionLimit(plan: SubscriptionPlan, isExpired: boolean): number {
  if (isExpired && plan === "trial") {
    return 1; // Freemium: günde 1 soru
  }
  
  switch (plan) {
    case "trial": return 3;
    case "lite": return 10;
    case "premium": return Infinity;
    default: return 0;
  }
}

export function hasAIAccess(plan: SubscriptionPlan, isExpired: boolean): boolean {
  // Freemium'da AI yok
  if (isExpired && plan === "trial") {
    return false;
  }
  
  // Trial, Lite ve Premium'da AI var
  return true;
}
```

### 2. **Süre Dolmadan Uyarılar**

`app/home/page.tsx` veya global component'te:
```typescript
useEffect(() => {
  const daysLeft = getSubscriptionDaysLeft(userData.subscriptionEndDate);
  
  if (daysLeft === 7) {
    showToast("⏰ Aboneliğiniz 7 gün içinde bitecek! Şimdi yenilerseniz %15 indirim!", "info");
  } else if (daysLeft === 3) {
    showToast("⚠️ Aboneliğiniz 3 gün içinde bitecek! Planınızı yenileyin.", "info");
  } else if (daysLeft === 1) {
    showToast("🚨 Son gün! Yarın Trial'a düşeceksiniz.", "info");
  }
}, [userData]);
```

### 3. **Grace Period (Ödeme Gecikme Toleransı)**

Premium/Lite bitince +3 gün grace:
```typescript
export function checkSubscriptionStatus(...): SubscriptionStatus {
  const now = new Date();
  const subEnd = subscriptionEndDate?.toDate();
  
  if (subEnd) {
    // Grace period: bitiş + 3 gün
    const gracePeriodEnd = new Date(subEnd);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);
    
    if (now <= subEnd) {
      return "active"; // Aktif
    } else if (now <= gracePeriodEnd) {
      return "grace"; // Grace period (yeni status!)
    } else {
      return "expired"; // Gerçekten expired
    }
  }
  
  // Trial kontrolü...
}
```

### 4. **Otomatik Yenileme Sistemi**

Firestore'da:
```typescript
users/{userId} {
  autoRenew: boolean,
  paymentMethod: "card" | "paypal",
  nextPaymentDate: Timestamp,
}
```

Her gün çalışan Cloud Function:
```typescript
// Yarın süresi bitecek ve autoRenew=true olanları bul
// Ödeme al
// subscriptionEndDate'i +30 gün uzat
// Kullanıcıya email gönder
```

---

## 📈 Karşılaştırma Tablosu

| Durum | Strateji 1 (Freemium) | Strateji 2 (Hard Paywall) | Strateji 3 (Esnek) |
|-------|---------------------|------------------------|-------------------|
| **Trial bitince** | Günde 1 soru (AI yok) | Tamamen kilitle | Günde 2 soru (AI yok) |
| **Kullanıcı kaybı** | Düşük (%20) | Çok Yüksek (%70) | Orta (%40) |
| **Dönüşüm oranı** | Orta-Yüksek (%5-10) | Yüksek ama az (%15) | Orta (%5-8) |
| **Engagement** | Yüksek | Çok Düşük | Orta |
| **Lifetime Value** | En Yüksek | Düşük | Orta |

---

## 🎁 Kampanya Örnekleri

### 1. **İlk Ay Kampanyası**
```
🎉 Hoş Geldin Bonusu!
Trial bitiminde Premium'a geçersen:
✅ İlk ay %30 indirim (₺279 yerine ₺195)
✅ +3 gün bonus
```

### 2. **Geri Dön Kampanyası**
```
Expired kullanıcılara (30 gün sonra):
📧 Email: "Geri dönmeni istiyoruz!"
🎁 Teklif: 7 gün ücretsiz + ilk ay %40 indirim
```

### 3. **Sadakat Programı**
```
3 ay üst üste Premium: %10 sürekli indirim
6 ay üst üste Premium: %15 sürekli indirim + 1 ay ücretsiz
12 ay üst üste Premium: %20 sürekli indirim + 2 ay ücretsiz
```

### 4. **Yükseltme Teşviki**
```
Lite kullanıcısına:
"🚀 Premium'a geç, kalan {X} gün transfer edilsin!
İlk ay %20 indirim + {X} gün bonus!"
```

---

## 🔧 Kod Örnekleri

### Banner Component'i

```typescript
// components/SubscriptionBanner.tsx
export function SubscriptionBanner({ userData }) {
  const status = checkSubscriptionStatus(...);
  const daysLeft = getSubscriptionDaysLeft(...);
  
  if (status === "trial" && daysLeft <= 2) {
    return (
      <div className="bg-yellow-500 text-white p-4 rounded-xl">
        ⏰ Trial süreniz {daysLeft} gün içinde bitecek!
        <button>Premium'a Geç</button>
      </div>
    );
  }
  
  if (status === "expired" && userData.subscriptionPlan === "trial") {
    return (
      <div className="bg-blue-500 text-white p-4 rounded-xl">
        🆓 Freemium modunda: Günde 1 soru (AI yok)
        <button>Premium Al - Sınırsız Soru!</button>
      </div>
    );
  }
  
  if (status === "active" && daysLeft <= 7) {
    return (
      <div className="bg-orange-500 text-white p-4 rounded-xl">
        ⚠️ Aboneliğiniz {daysLeft} gün içinde bitecek!
        Şimdi yenile, %15 indirim kazan!
        <button>Yenile</button>
      </div>
    );
  }
  
  return null;
}
```

### Soru Sorma Kontrolü

```typescript
// app/soru-sor/page.tsx
const handleUpload = async () => {
  const status = checkSubscriptionStatus(...);
  const isExpired = status === "expired";
  const hasAI = hasAIAccess(userData.subscriptionPlan, isExpired);
  
  if (!questionInfo.canAsk) {
    if (isExpired) {
      showToast(
        "Günlük soru limitiniz doldu. Premium'a geçin!",
        "error"
      );
      setTimeout(() => router.push("/premium"), 1500);
    } else {
      showToast("Günlük soru limitiniz doldu.", "error");
    }
    return;
  }
  
  // Soru yükle
  await uploadQuestion();
  
  // AI çözümü - sadece AI access varsa
  if (hasAI) {
    await solveWithAI();
  } else {
    showToast("AI çözüm için Premium gerekli. Coach'unuzla görüşün!", "info");
  }
};
```

---

## 📊 Beklenen Sonuçlar

### Freemium Modeli (Tavsiye Edilen)

**Kullanıcı Davranışı:**
- Trial kullanıcılar: %80 Freemium'da kalır, %20 kaybolur
- Freemium'dan Premium: %5-10 dönüşüm (aylık)
- Lite/Premium bitenlerin %60'ı yeniler
- Toplam dönüşüm: %15-20

**Gelir:**
- Aylık kullanıcı başına: ₺30-60 (AVG)
- Lifetime value: ₺300-800
- Retention: %70-80

### Hard Paywall

**Kullanıcı Davranışı:**
- Trial kullanıcılar: %70 kaybolur, %30 Premium alır
- Toplam dönüşüm: %8-12

**Gelir:**
- Aylık kullanıcı başına: ₺40-80
- Lifetime value: ₺200-400
- Retention: %30-40

---

## 🎯 Sonuç ve Tavsiye

### **En İyi Strateji: Freemium + Grace Period + Erken Yenileme**

#### Trial (7 gün):
```
✅ Günde 3 soru, AI var, tüm özellikler
Banner (son 2 gün): "Premium'a geç, %20 indirim!"
```

#### Trial Bitince → Freemium:
```
✅ Günde 1 soru, AI YOK, coach var, eski sorular var
Banner: "Premium al, AI çözüm + sınırsız soru!"
```

#### Lite/Premium Bitince → 7 Günlük "Comeback Trial":
```
✅ Günde 3 soru, AI var, 7 gün
Banner: "Planını yenile, %15 indirim + kalan günler bonus!"
7 gün sonra → Freemium
```

### Neden Bu Strateji?

1. ✅ **Kullanıcı Kaybı Minimal** (Freemium ile engage kalırlar)
2. ✅ **Sürekli Dönüşüm Fırsatı** (her gün banner gösteriyorsunuz)
3. ✅ **İyi UX** (ani kesinti yok, kademeli geçiş)
4. ✅ **Lifetime Value Yüksek** (kullanıcı 6-12 ay kalır)
5. ✅ **Word-of-Mouth** (memnun kullanıcılar arkadaş getirir)

### İmplementasyon Önceliği:

1. ✅ **Hemen:** Freemium modu (günde 1 soru, AI yok)
2. ✅ **1 hafta:** Banner sistemi (süre uyarıları)
3. ⏰ **2 hafta:** Grace period (3 gün)
4. ⏰ **1 ay:** Erken yenileme indirimleri
5. ⏰ **2 ay:** Otomatik yenileme
6. ⏰ **3 ay:** Referans programı

İsterseniz şimdi Freemium modunu birlikte implement edelim! 🚀

