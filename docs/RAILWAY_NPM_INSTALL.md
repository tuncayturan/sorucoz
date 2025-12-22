# Railway'de npm install Nasıl Çalışır?

## Otomatik Kurulum

Railway **otomatik olarak** her deployment sırasında `npm install` (veya `npm ci`) çalıştırır. Bu işlem `nixpacks.toml` dosyasındaki `[phases.install]` bölümünde tanımlıdır.

### Mevcut Yapılandırma

`nixpacks.toml` dosyanızda şu komut var:
```toml
[phases.install]
cmds = [
  "npm ci --prefer-offline --no-audit --legacy-peer-deps --ignore-scripts"
]
```

Bu komut:
- ✅ `package-lock.json` dosyasından bağımlılıkları yükler
- ✅ `expo-server-sdk` dahil tüm paketleri otomatik yükler
- ✅ Her deployment'da otomatik çalışır

## Deployment Tetikleme

### Yöntem 1: Git Push (Otomatik - Önerilen)

1. **Değişiklikleri GitHub'a push edin:**
   ```bash
   git add package.json package-lock.json
   git commit -m "expo-server-sdk eklendi"
   git push
   ```

2. **Railway otomatik olarak:**
   - GitHub'dan değişiklikleri çeker
   - `npm ci` çalıştırır (tüm paketleri yükler)
   - `npm run build` çalıştırır
   - Uygulamayı başlatır

### Yöntem 2: Railway Dashboard'dan Manuel Deploy

1. **Railway Dashboard'a gidin:**
   - [railway.app](https://railway.app) → Projenizi seçin

2. **Deployments sekmesine gidin:**
   - Sol menüden **"Deployments"** seçin

3. **Redeploy butonuna tıklayın:**
   - En son deployment'ın yanındaki **"..."** menüsüne tıklayın
   - **"Redeploy"** seçeneğini seçin
   - Railway otomatik olarak `npm ci` çalıştıracak

### Yöntem 3: Railway CLI (Gelişmiş)

1. **Railway CLI'yi yükleyin:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Railway'e giriş yapın:**
   ```bash
   railway login
   ```

3. **Projeyi link edin:**
   ```bash
   railway link
   ```

4. **Manuel deploy tetikleyin:**
   ```bash
   railway up
   ```

## Kontrol Etme

### 1. Railway Logs'u Kontrol Edin

1. Railway Dashboard → **Logs** sekmesine gidin
2. Build loglarında şunu görmelisiniz:
   ```
   [phases.install] Running: npm ci --prefer-offline --no-audit --legacy-peer-deps --ignore-scripts
   ...
   added 5 packages (expo-server-sdk dahil)
   ```

### 2. Build Başarılı mı Kontrol Edin

1. Railway Dashboard → **Deployments** sekmesine gidin
2. En son deployment'ın durumunu kontrol edin:
   - ✅ **"Active"** (yeşil) = Başarılı
   - ❌ **"Failed"** (kırmızı) = Hata var, logları kontrol edin

### 3. Uygulama Çalışıyor mu Kontrol Edin

1. Railway Dashboard → **Settings** → **Networking**
2. Domain'inize gidin (örn: `https://sorucoz-production.up.railway.app`)
3. Uygulama açılıyorsa deployment başarılıdır

## Sorun Giderme

### Problem: expo-server-sdk yüklenmiyor

**Çözüm 1: package-lock.json'u güncelleyin**
```bash
# Lokal olarak çalıştırın
npm install
git add package-lock.json
git commit -m "package-lock.json güncellendi"
git push
```

**Çözüm 2: Railway'de manuel redeploy**
1. Railway Dashboard → Deployments
2. En son deployment → "..." → "Redeploy"

**Çözüm 3: Build loglarını kontrol edin**
1. Railway Dashboard → Logs
2. "npm ci" komutunun çalıştığını ve hata olmadığını kontrol edin

### Problem: Build başarısız oluyor

**Kontrol Listesi:**
- ✅ `package.json` dosyasında `expo-server-sdk` var mı?
- ✅ `package-lock.json` dosyası güncel mi?
- ✅ Railway'de Node.js versiyonu 20.x mi? (nixpacks.toml'da tanımlı)
- ✅ Railway logs'unda hata var mı?

### Problem: Uygulama çalışmıyor

**Kontrol:**
1. Railway Dashboard → Logs → Runtime logs
2. `expo-server-sdk` import edilirken hata var mı?
3. Hata varsa, logları paylaşın

## Önemli Notlar

1. **Otomatik Kurulum:**
   - Railway her deployment'da otomatik `npm ci` çalıştırır
   - Manuel müdahale gerekmez
   - Sadece `package.json` ve `package-lock.json`'u güncelleyip push edin

2. **package-lock.json:**
   - Bu dosya commit edilmeli
   - Railway bu dosyayı kullanarak paketleri yükler
   - Eğer yoksa, `npm install` çalıştırıp commit edin

3. **Build Süresi:**
   - İlk deployment: ~5-10 dakika
   - Sonraki deployment'lar: ~3-5 dakika
   - `expo-server-sdk` küçük bir paket, ekstra süre eklemez

## Hızlı Kontrol

Deployment'ın başarılı olduğunu kontrol etmek için:

1. ✅ Railway Dashboard → Deployments → En son deployment "Active"
2. ✅ Railway Dashboard → Logs → "npm ci" başarılı
3. ✅ Uygulama domain'inde çalışıyor
4. ✅ Bildirimler çalışıyor (test edin)

## Sonuç

**Railway otomatik olarak `npm install` çalıştırır!** 

Sadece yapmanız gereken:
1. `package.json`'a `expo-server-sdk` ekleyin ✅ (Yapıldı)
2. `package-lock.json`'u güncelleyin ✅ (Yapıldı)
3. GitHub'a push edin ✅ (Yapıldı)
4. Railway otomatik deploy edecek ve paketleri yükleyecek ✅

**Ekstra bir şey yapmanıza gerek yok!** Railway her şeyi otomatik hallediyor.
