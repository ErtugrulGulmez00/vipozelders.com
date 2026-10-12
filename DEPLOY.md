# Yayına alma rehberi

İki yol var:

- **A) Hızlı deneme:** Sunucu kiralamadan, kendi bilgisayarınızdan geçici bir internet adresiyle arkadaşınızla görüntülü dersi denersiniz. Bilgisayar açık kaldığı sürece çalışır.
- **B) Kalıcı yayın:** Bir VPS (sanal sunucu) üzerinde alan adınızla 7/24 çalışır. Gerçek kullanıcılar için bu yol.

---

## A) Hızlı deneme (VPS gerekmez)

### 1. Görüntülü ders için LiveKit Cloud (ücretsiz)

1. <https://cloud.livekit.io> adresinde ücretsiz hesap ve proje açın.
2. Proje → **Settings → Keys** bölümünden yeni anahtar oluşturun. **URL** (`wss://...livekit.cloud`), **API Key** ve **API Secret** değerlerini kopyalayın.
3. `.env` dosyasına yazın:

   ```env
   LIVEKIT_URL="wss://projeniz.livekit.cloud"
   LIVEKIT_API_KEY="API..."
   LIVEKIT_API_SECRET="..."
   ```

### 2. Geçici internet adresi (Cloudflare Tunnel, ücretsiz, hesap gerekmez)

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```

Komut `https://kelime-kelime-kelime.trycloudflare.com` gibi bir adres yazar. Bu adresi `.env` içindeki `APP_URL` alanına yazın:

```env
APP_URL="https://kelime-kelime-kelime.trycloudflare.com"
```

### 3. Siteyi canlı modda başlatın

Her biri ayrı terminalde (`npm run dev` açıksa önce kapatın):

```powershell
npm run db        # veritabanı (açık kalsın)
npm run build     # bir kez, birkaç dakika sürer
npm start         # site
```

### 4. Deneyin

1. Kendi bilgisayarınızda tünel adresini açın, `admin` ile giriş yapın.
2. Kendiniz veya arkadaşınız için öğretmen hesabı açın: **Yönetim → Öğretmenler → Hızlı öğretmen ekle** (kullanıcı adı ve geçici şifre ekranda çıkar). İsterseniz demo öğretmenlerden birini kullanın (`ayse.yilmaz` / `Ogretmen123`).
3. Arkadaşınız tünel adresinden **Kayıt ol** ile veli/öğrenci hesabı açar.
4. **Yönetim → Randevular → “Test dersi oluştur”**: öğretmeni seçin, arkadaşınızın e-postasını yazın, “Test dersini oluştur”a basın (ödemesiz, 2 dakika sonra başlar).
5. İki taraf da kendi panelindeki ders sayfasından **“Derse katıl”**a basar. Sınıfta kamera, mikrofon, **ekran paylaşımı**, **sohbet** ve **beyaz tahta** vardır.

Notlar:

- Tünel adresi `cloudflared` her açıldığında değişir; değişince `APP_URL`'i güncelleyip `npm start`'ı yeniden başlatın.
- Demo veriler yüklüdür; bu kurulum yalnızca deneme içindir, gerçek kullanıcı almayın.
- Kamera/mikrofon izni yalnızca HTTPS adreslerde verilir; tünel adresi HTTPS'tir.

---

## B) Kalıcı yayın (VPS)

**Gerekenler:** Ubuntu 24.04 kurulu bir VPS (en az 2 vCPU, 4 GB RAM; KVKK açısından Türkiye'de olması en sorunsuzu), bir alan adı (DNS'te `A` kaydı sunucunun IP adresine yönlendirilmiş), LiveKit Cloud projesi, PayTR mağaza hesabı, bir SMTP e-posta hesabı.

### 1. Sunucu paketleri

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git postgresql caddy
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

### 2. Veritabanı

```bash
sudo -u postgres psql <<'SQL'
CREATE USER vipozelders WITH PASSWORD 'GUCLU-BIR-SIFRE';
CREATE DATABASE vipozelders OWNER vipozelders;
ALTER DATABASE vipozelders SET timezone TO 'UTC';
\c vipozelders
CREATE EXTENSION IF NOT EXISTS btree_gist;
SQL
```

> Yönetilen veritabanı (Supabase, Neon vb.) da kullanılabilir: `DATABASE_URL`'i onların verdiği adresle değiştirin; saat dilimi UTC olmalı ve `btree_gist` eklentisi açık olmalı.

### 3. Uygulama

```bash
sudo useradd -m -s /bin/bash vipozelders
sudo -iu vipozelders
git clone https://github.com/ErtugrulGulmez00/vipozelders.com.git app
cd app
cp .env.example .env
nano .env
```

`.env` içinde doldurulacaklar:

| Ayar | Değer |
| --- | --- |
| `DATABASE_URL` | `postgresql://vipozelders:GUCLU-BIR-SIFRE@localhost:5432/vipozelders?schema=public` |
| `APP_URL` | `https://alanadiniz.com` |
| `APP_SECRET` | `openssl rand -base64 48` komutunun çıktısı. **Bir daha değiştirmeyin** (şifreli alanlar bununla çözülür). |
| `PAYMENT_PROVIDER` | `paytr` (denemede `mock`) |
| `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT` | PayTR mağaza paneli → Destek & Kurulum → Entegrasyon Bilgileri |
| `PAYTR_TEST_MODE` | Denemelerde `1`, gerçek satışta `0` |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | LiveKit Cloud projesi |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | E-posta hesabınız |
| `STORAGE_DIR` | `/home/vipozelders/storage` (yüklenen fotoğraf ve belgeler) |

Kurulum:

```bash
npm ci
npx prisma migrate deploy
NODE_ENV=production SEED_DEMO=false ADMIN_USERNAME=yonetici ADMIN_EMAIL=siz@alanadiniz.com npx prisma db seed
npm run build
```

Seed komutu yönetici için **geçici şifreyi ekrana bir kez yazar**; not alın. İlk girişte şifre değiştirmeniz istenir. Girişten sonra **Yönetim → Güvenlik** bölümünden iki adımlı doğrulamayı açın.

### 4. Sürekli çalışan servis

`/etc/systemd/system/vipozelders.service` dosyası (root olarak):

```ini
[Unit]
Description=VIP Ozel Ders
After=network.target postgresql.service

[Service]
User=vipozelders
WorkingDirectory=/home/vipozelders/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vipozelders
sudo journalctl -u vipozelders -f    # kayıtları izlemek için
```

Arka plan görevleri (ödeme süreleri, hatırlatmalar, iadeler, ders tamamlama) uygulamanın içinde dakikada bir çalışır; ek bir şey gerekmez.

### 5. HTTPS (Caddy)

`/etc/caddy/Caddyfile`:

```caddy
alanadiniz.com, www.alanadiniz.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
```

Caddy SSL sertifikasını kendisi alır ve yeniler.

### 6. Dış servis ayarları

- **PayTR paneli → Ayarlar → Bildirim URL:** `https://alanadiniz.com/api/odeme/paytr/bildirim`
- **LiveKit Cloud → Settings → Webhooks:** `https://alanadiniz.com/api/livekit/webhook` (yoklama kaydı için)
- **Yönetim → Site ayarları:** site adı, iletişim bilgileri, ticari unvan, komisyon ve kurallar
- **Yönetim → Sayfalar:** yasal metinleri avukatınıza kontrol ettirip “TASLAK” satırlarını silin

### 7. Yedekleme

```bash
sudo -iu vipozelders
mkdir -p ~/yedek
crontab -e
```

```cron
30 3 * * * pg_dump -Fc "postgresql://vipozelders:GUCLU-BIR-SIFRE@localhost:5432/vipozelders" > ~/yedek/db-$(date +\%F).dump && tar czf ~/yedek/dosyalar-$(date +\%F).tgz -C ~ storage && find ~/yedek -mtime +14 -delete
```

Yedekleri ara sıra sunucu dışına (ör. kendi bilgisayarınıza) da kopyalayın.

### 8. Güncelleme

```bash
sudo -iu vipozelders
cd app
git pull
npm ci
npx prisma migrate deploy
npm run build
exit
sudo systemctl restart vipozelders
```

### Sorun giderme

- **Site açılmıyor:** `sudo journalctl -u vipozelders -n 100` ve `sudo systemctl status caddy`.
- **Girişte “Beklenmeyen bir hata oluştu” ya da giriş yapılamıyor:** `APP_URL` tarayıcının adres çubuğundaki adresle birebir aynı olmalı (`https://` ile). Site birden fazla adresten açılıyorsa diğerlerini `SERVER_ACTIONS_ALLOWED_ORIGINS="www.alanadiniz.com,ikinci-adres.com"` ile ekleyin ve servisi yeniden başlatın.
- **Ödeme onaylanmıyor:** PayTR panelindeki Bildirim URL'sini ve `PAYTR_*` değerlerini kontrol edin; **Yönetim → Finans** sayfasında ödemenin durumuna bakın.
- **Sanal sınıf “yapılandırılmadı” diyor:** `LIVEKIT_*` değerlerini girip servisi yeniden başlatın.
- **Yönetici telefonunu kaybetti:** `npm run admin:2fa-kapat -- yonetici` (sunucuda, uygulama klasöründe).
