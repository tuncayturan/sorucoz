# EAS Build Limit Sorunu ve Çözümleri

## 🚨 Sorun: Free Plan Limit Aşıldı

**Hata Mesajı:**
```
This account has used its Android builds from the Free plan this month, which will reset in 9 days (on Thu Jan 01 2026).
Error: build command failed
```

## 📊 Durum

- ✅ Build dosyaları yüklendi
- ✅ VersionCode artırıldı (13 → 14)
- ❌ Build başlatılamadı (free plan limiti)

## 🔧 Çözümler

### Çözüm 1: Bekleme (Önerilen - Ücretsiz)

**Ne yapmalı:**
- 9 gün bekleyin (1 Ocak 2026'da limit sıfırlanacak)
- Limit sıfırlandıktan sonra build başlatın

**Komut:**
```bash
cd mobile
# 1 Ocak 2026'dan sonra çalıştırın
eas build --platform android --profile production
```

### Çözüm 2: EAS Pro Plan'a Geçiş (Hızlı)

**Avantajlar:**
- ✅ Sınırsız build
- ✅ Daha hızlı build süreleri
- ✅ Eşzamanlı build desteği
- ✅ Daha uzun timeout süreleri

**Fiyat:** $20/ay

**Nasıl yapılır:**
1. [expo.dev/accounts/tuncayturan/settings/billing](https://expo.dev/accounts/tuncayturan/settings/billing)
2. "Upgrade" butonuna tıklayın
3. Pro plan'ı seçin
4. Ödeme yapın
5. Build'i tekrar başlatın

### Çözüm 3: EAS Dashboard'dan Build Başlatma

Bazen CLI'de hata olsa da Dashboard'dan build başlatılabilir:

1. [expo.dev](https://expo.dev) → Giriş yapın
2. Projenizi seçin: **sorucozapp**
3. **Builds** sekmesine gidin
4. **"Create a build"** butonuna tıklayın
5. Platform: **Android**, Profile: **production**
6. **"Start build"** butonuna tıklayın

**Not:** Eğer limit dolmuşsa Dashboard'dan da başlatılamaz.

### Çözüm 4: Local Build (Gelişmiş)

Kendi bilgisayarınızda build alabilirsiniz:

**Gereksinimler:**
- Android SDK
- Java JDK
- Gradle
- Yeterli disk alanı (~10GB)

**Komut:**
```bash
cd mobile
eas build --platform android --profile production --local
```

**Not:** Local build karmaşık kurulum gerektirir, önerilmez.

## 📅 Limit Sıfırlanma Tarihi

**Tarih:** 1 Ocak 2026 (9 gün sonra)

**Saat:** Expo'nun belirlediği saatte (genellikle UTC 00:00)

**Sonrası:**
- Limit sıfırlanacak
- Yeni build'ler başlatılabilecek
- Free plan limiti tekrar kullanılabilir olacak

## 🔍 Mevcut Build'leri Kontrol Etme

### Son Build'leri Listele

```bash
cd mobile
eas build:list --platform android --limit 10
```

### Son Başarılı Build'i İndir

```bash
cd mobile
eas build:list --platform android --limit 10
# Başarılı build ID'sini bulun, sonra:
eas build:download --id <BUILD_ID>
```

### Son Başarılı Build'i Bul ve İndir

```bash
cd mobile
# Son başarılı build'i bul ve indir
eas build:list --platform android --limit 10 --json | findstr "finished"
```

## 💡 Öneriler

### Şimdilik Yapılacaklar

1. **Mevcut APK'yı kullanın:**
   - Son başarılı build'i indirin
   - Test edin
   - Gerekirse eski APK'yı kullanmaya devam edin

2. **Değişiklikleri hazır tutun:**
   - Tüm değişiklikler GitHub'da
   - Limit sıfırlandığında hemen build alabilirsiniz

3. **Build'i planlayın:**
   - 1 Ocak 2026'dan sonra build almayı planlayın
   - Önemli değişiklikler için Pro plan düşünün

### Pro Plan'a Geçiş Düşünün

**Ne zaman düşünülmeli:**
- Sık sık build almanız gerekiyorsa
- Production'a hızlı deploy etmeniz gerekiyorsa
- Test build'leri için limit yeterli değilse

**Maliyet:**
- $20/ay = Ayda sınırsız build
- Free plan = Ayda sınırlı build (şu anda dolmuş)

## 📝 Build Limit Bilgileri

### Free Plan Limitleri

- **Android builds:** Ayda sınırlı sayı (şu anda dolmuş)
- **iOS builds:** Ayda sınırlı sayı
- **Build süresi:** Daha uzun olabilir
- **Eşzamanlı build:** Sınırlı

### Pro Plan Limitleri

- **Android builds:** Sınırsız
- **iOS builds:** Sınırsız
- **Build süresi:** Daha hızlı
- **Eşzamanlı build:** Daha fazla

## 🎯 Hızlı Çözüm Özeti

**Şimdi:**
1. Son başarılı build'i indirin ve kullanın
2. 9 gün bekleyin (1 Ocak 2026)
3. Veya Pro plan'a geçin ($20/ay)

**1 Ocak 2026'dan sonra:**
```bash
cd mobile
eas build --platform android --profile production
```

## 📞 Destek

Sorun devam ederse:
- [Expo Discord](https://chat.expo.dev/)
- [EAS Support](https://expo.dev/support)
- [EAS Billing](https://expo.dev/accounts/tuncayturan/settings/billing)
