#!/usr/bin/env bash
# Pi Kampüs sunucu bekçisi (cron, 5 dakikada bir, root). Siteye, servislere, diske, sertifikaya, alan adına, yedeğe (sunucu ve Google Drive),
# e-posta kuyruğuna ve yeni hatalara bakar; sorun başlayınca, sürdükçe 3 saatte bir ve düzelince e-posta + Telegram gönderir.
# Ayarlar: /etc/pikampus/bekci.env (ALERT_EMAILS, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, HC_PING_URL). E-posta uygulamanın SMTP hesabıyla gider.
# Sunucu tamamen kapanırsa bekçi de susar: her turun sonunda Healthchecks.io'ya ping atılır, ping kesilince haberi oradan gelir.
#   pikampus-bekci          kontrolleri çalıştırır
#   pikampus-bekci deneme   uyarı kanallarına deneme mesajı gönderir
set -u

CONF=/etc/pikampus/bekci.env
STATE=/var/lib/pikampus-bekci
APP_ENV=/home/vipozelders/app/.env
BACKUP_DIR=/home/vipozelders/yedek/disari
SITE=pikampus.com
SERVER_IP=194.62.52.232
REMIND_EVERY=$((3 * 3600))

ALERT_EMAILS=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
HC_PING_URL=""
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"
mkdir -p "$STATE"
chmod 700 "$STATE"

env_get() { grep -E "^$1=" "$APP_ENV" 2>/dev/null | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }

send() {
  local subject="$1" body="$2" host port user pass from scheme to mail netrc
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    curl -s -m 20 "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
      --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" --data-urlencode "text=$subject
$body" >/dev/null || true
  fi
  host=$(env_get SMTP_HOST); port=$(env_get SMTP_PORT); user=$(env_get SMTP_USER); pass=$(env_get SMTP_PASSWORD)
  [ -z "$host" ] || [ -z "$ALERT_EMAILS" ] && return 0
  from="$user"
  scheme=smtp; [ "$port" = "465" ] && scheme=smtps
  mail="$STATE/mail.txt"; netrc="$STATE/netrc"
  umask 077
  printf 'machine %s login %s password %s\n' "$host" "$user" "$pass" > "$netrc"
  for to in ${ALERT_EMAILS//,/ }; do
    printf 'From: =?UTF-8?B?%s?= <%s>\r\nTo: %s\r\nSubject: =?UTF-8?B?%s?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n%s\r\n' \
      "$(printf 'Pi Kampüs Bekçi' | base64 -w0)" "$from" "$to" "$(printf '%s' "$subject" | base64 -w0)" "$body" > "$mail"
    curl -s -m 30 --ssl-reqd --url "$scheme://$host:${port:-587}" --netrc-file "$netrc" --mail-from "$from" --mail-rcpt "$to" -T "$mail" >/dev/null || true
  done
  rm -f "$netrc" "$mail"
}

if [ "${1:-}" = "deneme" ]; then
  send "✅ Pi Kampüs bekçisi çalışıyor" "Bu bir deneme mesajıdır. Sitede, sunucuda, alan adında ya da yedekte sorun olursa bu kanala haber gelecek."
  exit 0
fi

# ——— Kontroller: her biri sorun varsa açıklamayı yazdırıp 1 döner ———

check_services() {
  local bad=() s
  for s in vipozelders caddy livekit; do systemctl is-active --quiet "$s" || bad+=("$s"); done
  pg_isready -q || bad+=("postgresql")
  [ ${#bad[@]} -eq 0 ] || { echo "Çalışmayan servis: ${bad[*]}"; return 1; }
}

check_site() {
  local out
  out=$(curl -s -m 20 --resolve "$SITE:443:127.0.0.1" "https://$SITE/api/saglik") || { echo "Site yanıt vermiyor (sunucu içinden)."; return 1; }
  echo "$out" | grep -q '"ok":true' || { echo "Site ya da veritabanı sağlıksız: $out"; return 1; }
}

check_dns() {
  local out
  out=$(curl -s -m 20 "https://dns.google/resolve?name=$SITE&type=A") || return 0
  echo "$out" | grep -q "\"data\":\"$SERVER_IP\"" || { echo "Alan adı DNS'te bulunamıyor ya da başka bir IP'ye gidiyor (site herkes için kapalı olabilir). Alan adı durumunu kontrol edin."; return 1; }
}

check_disk() {
  local used
  used=$(df --output=pcent / | tail -1 | tr -dc '0-9')
  [ "$used" -lt 85 ] || { echo "Disk %$used dolu."; return 1; }
}

check_cert() {
  local end days
  end=$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$SITE" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  [ -n "$end" ] || { echo "SSL sertifikası okunamadı."; return 1; }
  days=$(( ($(date -d "$end" +%s) - $(date +%s)) / 86400 ))
  [ "$days" -ge 14 ] || { echo "SSL sertifikasının bitmesine $days gün kaldı (kendiliğinden yenilenmesi gerekiyordu)."; return 1; }
}

# Alan adı kaydı saatte bir sorgulanır
check_domain() {
  local cache="$STATE/rdap.json" status exp days
  if [ ! -s "$cache" ] || [ $(( $(date +%s) - $(stat -c %Y "$cache") )) -gt 3600 ]; then
    curl -s -m 20 "https://rdap.verisign.com/com/v1/domain/$SITE" -o "$cache.new" && [ -s "$cache.new" ] && mv "$cache.new" "$cache"
  fi
  [ -s "$cache" ] || return 0
  status=$(grep -o '"status":\[[^]]*\]' "$cache")
  if echo "$status" | grep -Eqi 'hold|redemption|pending delete'; then
    echo "Alan adı kayıt firmasınca askıya alınmış: $status. Natro panelini ve e-postanızı kontrol edin."; return 1
  fi
  exp=$(grep -o '"eventAction":"expiration","eventDate":"[^"]*"' "$cache" | grep -o '[0-9]\{4\}-[0-9-]*T[0-9:]*')
  [ -n "$exp" ] || return 0
  days=$(( ($(date -d "$exp" +%s) - $(date +%s)) / 86400 ))
  [ "$days" -ge 30 ] || { echo "Alan adının süresinin dolmasına $days gün kaldı. Natro'dan yenileyin."; return 1; }
}

check_backup() {
  local newest
  newest=$(find "$BACKUP_DIR" -name 'pikampus-*.tar.enc' -mmin -1560 2>/dev/null | head -1)
  [ -n "$newest" ] || { echo "Son 26 saatte gece yedeği alınmamış (/var/log/pikampus-yedek.log)."; return 1; }
}

check_drive() {
  local mark="$STATE/drive-son"
  [ -f /etc/pikampus/rclone.conf ] || return 0
  [ -f "$mark" ] && [ $(( $(date +%s) - $(stat -c %Y "$mark") )) -lt $((26 * 3600)) ] || { echo "Gece yedeği Google Drive'a yüklenemedi (/var/log/pikampus-yedek.log). Drive izni kaldırılmış ya da Drive dolmuş olabilir."; return 1; }
}

db_url() { env_get DATABASE_URL | sed -E 's/\?.*$//'; }

check_email_queue() {
  local url pending failed
  url=$(db_url); [ -n "$url" ] || return 0
  pending=$(psql "$url" -tAc "SELECT count(*) FROM \"EmailMessage\" WHERE status = 'PENDING' AND \"createdAt\" < now() - interval '20 minutes'" 2>/dev/null) || return 0
  failed=$(psql "$url" -tAc "SELECT count(*) FROM \"EmailMessage\" WHERE status = 'FAILED' AND \"createdAt\" > now() - interval '1 hour'" 2>/dev/null) || return 0
  if [ "${pending:-0}" -gt 0 ] || [ "${failed:-0}" -ge 3 ]; then
    echo "E-postalar gitmiyor: $pending e-posta 20 dakikadır kuyrukta, son 1 saatte $failed e-posta gönderilemedi (SMTP hesabını kontrol edin)."; return 1
  fi
}

# ——— Durum takibi: sorun başlayınca, sürdükçe 3 saatte bir ve düzelince haber ver ———

run_check() {
  local key="$1" fn="$2" title="$3" msg file now
  file="$STATE/sorun-$key"
  now=$(date +%s)
  if msg=$($fn); then
    if [ -f "$file" ]; then
      send "✅ Düzeldi: $title" "$(date '+%d.%m.%Y %H:%M') itibarıyla normal. Sorun $(( (now - $(stat -c %Y "$file.ilk" 2>/dev/null || echo "$now")) / 60 )) dakika sürdü."
      rm -f "$file" "$file.ilk"
    fi
  else
    if [ ! -f "$file" ]; then
      touch "$file" "$file.ilk"
      send "🚨 Sorun: $title" "$msg"$'\n\n'"Sunucu: $SERVER_IP · $(date '+%d.%m.%Y %H:%M')"
    elif [ $(( now - $(stat -c %Y "$file") )) -ge $REMIND_EVERY ]; then
      touch "$file"
      send "⏰ Sorun sürüyor: $title" "$msg"$'\n\n'"Başlangıç: $(date -d "@$(stat -c %Y "$file.ilk")" '+%d.%m.%Y %H:%M')"
    fi
  fi
}

run_check servisler check_services "Servis durdu"
run_check site check_site "Site yanıt vermiyor"
run_check dns check_dns "Alan adı / DNS"
run_check disk check_disk "Disk doluyor"
run_check sertifika check_cert "SSL sertifikası"
run_check alan-adi check_domain "Alan adı kaydı"
run_check yedek check_backup "Gece yedeği"
run_check drive-yedek check_drive "Google Drive yedeği"
run_check eposta check_email_queue "E-posta gönderimi"

# Sitede yeni (ya da tekrar eden) hata: uygulama aynı hata için 6 saatte bir işaretler, bekçi bunları iletir
url=$(db_url)
if [ -n "$url" ]; then
  now=$(date +%s)
  last=$(cat "$STATE/hata-son" 2>/dev/null || echo "$now")
  if errors=$(psql "$url" -tAc "SELECT coalesce(\"routePath\", source) || ': ' || left(message, 160) || ' (' || count || ' kez)' FROM \"ErrorEvent\" WHERE \"lastNotifiedAt\" > to_timestamp($last) AND \"lastNotifiedAt\" <= to_timestamp($now) ORDER BY \"lastNotifiedAt\" LIMIT 5" 2>/dev/null); then
    echo "$now" > "$STATE/hata-son"
    [ -n "$errors" ] && send "⚠️ Sitede hata" "$errors"$'\n\n'"Ayrıntı: https://$SITE/yonetim/hatalar"
  fi
fi

# Dış izleme: bekçi çalıştıkça ping gider
[ -n "$HC_PING_URL" ] && curl -fsS -m 10 --retry 3 -o /dev/null "$HC_PING_URL"
exit 0
