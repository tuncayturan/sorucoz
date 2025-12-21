# Mobile Klasörü - Ayrı Git Repository Kurulumu

## Adım Adım Komutlar

### 1. Mobil Klasörüne Git
```bash
cd d:\sorucozapp\mobile
```

### 2. Mevcut Git Durumunu Kontrol Et
```bash
# Eğer zaten bir git repository varsa
git status

# Eğer .git klasörü varsa, önce temizle (isteğe bağlı)
# Remove-Item -Recurse -Force .git
```

### 3. Yeni Git Repository Oluştur
```bash
# Yeni git repository başlat
git init

# Git config ayarla (eğer yapmadıysanız)
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### 4. Dosyaları Ekle
```bash
# Tüm dosyaları stage'e ekle
git add .

# Durumu kontrol et
git status
```

### 5. İlk Commit Yap
```bash
git commit -m "Initial commit for mobile app - EAS build ready"
```

### 6. EAS Build'i Çalıştır
```bash
# Artık mobile klasörü root olarak görünecek
eas build --platform android --profile production
```

## Önemli Notlar

1. **Ana proje git'i**: Ana projenin git'i (`d:\sorucozapp\.git`) mobile klasörünü ignore etmeli veya mobile klasörü ayrı bir repository olarak çalışacak
2. **Git çakışması**: Eğer ana proje git'inde mobile klasörü takip ediliyorsa, çakışma olabilir
3. **Çözüm**: Ana proje `.gitignore`'a `mobile/.git/` ekleyebilirsiniz

## Ana Proje Git'ini Güncelleme (İsteğe Bağlı)

Ana proje git'inde mobile klasörünün ayrı git repository olmasını ignore etmek için:

```bash
# Ana proje dizinine git
cd d:\sorucozapp

# .gitignore'a ekle
echo "mobile/.git/" >> .gitignore
```
