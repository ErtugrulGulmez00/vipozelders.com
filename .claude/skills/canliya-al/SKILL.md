---
name: canliya-al
description: Pi Kampüs'ü canlıya (pikampus.com, Netverim VDS) alma adımları. Kullanıcı "canlıya al", "deploy et", "sunucuya yükle" dediğinde ya da sunucudaki .env'i değiştirmek gerektiğinde kullan.
---

# Canlıya alma (pikampus.com)

Sunucu: Netverim VDS, Ubuntu 22.04, `194.62.52.232`. SSH yalnızca anahtarla (`root`, BatchMode). Uygulama kullanıcısı `vipozelders`, kod `/home/vipozelders/app`, systemd servisi `vipozelders`, Caddy (HTTPS), PostgreSQL 14 yerel, LiveKit aynı sunucuda (`livekit.pikampus.com`).

## Önce

1. `dogrula` skill'indeki kontroller geçmiş olmalı (tip denetimi, lint, testler, derleme).
2. Değişiklikler commit'lenip **`paytr-ve-iyilestirmeler`** dalına gönderilmiş olmalı (sunucu bu dalı çeker). Commit'e yalnızca kendi dosyalarını ekle (`git add -A` yok).

## Süren ders kontrolü

Yeniden başlatma sanal sınıftaki dersi koparır. Komutu dosyadan gönder (PowerShell tırnakları bozar):

```bash
# scratchpad/active.sh
sudo -u postgres psql -d vipozelders -Atc "select count(*) from \"Booking\" where status='CONFIRMED' and \"startAt\" <= now() + interval '15 minutes' and \"endAt\" >= now()"
```

```powershell
Get-Content -Raw active.sh -Encoding UTF8 | ssh -o BatchMode=yes root@194.62.52.232 "tr -d '\r' | sed '1s/^\xEF\xBB\xBF//' | bash 2>/dev/null"
```

Sonuç `0` değilse kullanıcıya sor, ders bitince al.

## Canlıya alma

```powershell
ssh -o BatchMode=yes root@194.62.52.232 "sudo -iu vipozelders bash update.sh 2>&1 | tail -3 && systemctl restart vipozelders && sleep 5 && systemctl is-active vipozelders"
```

`update.sh`: git pull → `npm install` (npm ci değil; Windows'ta üretilen kilit dosyası) → `prisma migrate deploy` → `next build`. Başarıda `BUILD_OK <commit>` ve `active` görünür. `BUILD_OK` yoksa servis eski derlemeyle çalışmaya devam eder; çıktıyı oku, kullanıcıya bildir.

## Sonra

```bash
for p in / /ogretmenler /soru-sor /kurumlar-icin; do curl -s -o /dev/null -w "$p %{http_code}\n" https://pikampus.com$p; done
```

Panel adresleri girişsiz 307 döner, bu normaldir. Hata takibi: Yönetim → Hatalar.

## Sunucudaki .env

- Dosya: `/home/vipozelders/app/.env`. **Değerleri asla ekrana yazdırma**, sohbete ya da depoya koyma.
- Değişikliği küçük bir betikle yap (stdin üzerinden gönder, betiği sonra sil); ardından `systemctl restart vipozelders`.
- `.env` değişikliği yeniden başlatma ister; `"use cache"` kullanan sayfalar doğrudan SQL ile yapılan ayar değişikliklerini yeniden derlemeye kadar göstermez.

## Sunucuda tek seferlik betik

`/home/vipozelders/app/scripts/` altına stdin ile yaz, `npx tsx --env-file=.env scripts/x.ts` ile `vipozelders` kullanıcısıyla çalıştır, sonra sil. Yerelde önce dene.

## Yapılmayacaklar

- Zorla push (`--force`) yok; gerekirse kullanıcı kendisi yapar.
- `main` dalına aktarma (merge/push) kullanıcının işi.
- Canlı veritabanında silme/sıfırlama öncesi kullanıcıya sor.
