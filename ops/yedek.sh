#!/usr/bin/env bash
# Pi Kampüs şifreli gece yedeği (cron, 03:45, root): veritabanı + yüklenen dosyalar + .env tek dosyada,
# AES-256 ile şifreli → /home/vipozelders/yedek/disari/pikampus-<tarih>.tar.enc (sunucuda 7 gün, Google Drive'da 30 gün).
# .env yedeğe girer: APP_SECRET olmadan T.C. kimlik numaraları çözülemez.
# Geri açma: openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:yedek.key -in pikampus-<tarih>.tar.enc | tar xf -
set -euo pipefail

APP=/home/vipozelders/app
OUT=/home/vipozelders/yedek/disari
KEY=/etc/pikampus/yedek.key

mkdir -p "$OUT"
chmod 700 "$OUT"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

url=$(grep -E '^DATABASE_URL=' "$APP/.env" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/\?.*$//')
pg_dump -Fc "$url" > "$tmp/db.dump"
tar czf "$tmp/dosyalar.tgz" -C /home/vipozelders storage
cp "$APP/.env" "$tmp/env"

file="$OUT/pikampus-$(date +%F).tar.enc"
tar cf - -C "$tmp" db.dump dosyalar.tgz env | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY" -out "$file.part"
chmod 600 "$file.part"
mv "$file.part" "$file"
find "$OUT" -name 'pikampus-*.tar.enc' -mtime +7 -delete
echo "$(date '+%F %T') tamam: $(basename "$file") $(du -h "$file" | cut -f1)"

# Google Drive'a kopya (rclone, yalnızca kendi oluşturduğu dosyalara erişir); Drive'da 30 gün tutulur
RCLONE_CONF=/etc/pikampus/rclone.conf
if [ -f "$RCLONE_CONF" ]; then
  # rclone'un ortak Google hesabı yoğun saatlerde istek sınırına takılabiliyor; sabırla yeniden dener
  retry=(--retries 5 --low-level-retries 20 --retries-sleep 30s)
  rclone --config "$RCLONE_CONF" "${retry[@]}" copy "$file" gdrive:PiKampusYedek
  rclone --config "$RCLONE_CONF" "${retry[@]}" delete --min-age 30d gdrive:PiKampusYedek
  touch /var/lib/pikampus-bekci/drive-son
  echo "$(date '+%F %T') Drive'a yüklendi"
fi
