#!/usr/bin/env bash
# Bekçiyi ve şifreli yedeği sunucuya kurar ya da günceller (root): bash /home/vipozelders/app/ops/kur.sh <uyarı e-postası>
# Var olan ayar dosyasına ve yedek anahtarına dokunmaz.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)

install -m 755 "$here/bekci.sh" /usr/local/bin/pikampus-bekci
install -m 755 "$here/yedek.sh" /usr/local/bin/pikampus-yedek
install -d -m 700 /etc/pikampus /var/lib/pikampus-bekci

if [ ! -f /etc/pikampus/bekci.env ]; then
  umask 077
  cat > /etc/pikampus/bekci.env <<EOF
# Uyarıların gideceği e-postalar (virgülle), Telegram botu ve Healthchecks.io ping adresi
ALERT_EMAILS="${1:-}"
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
HC_PING_URL=""
EOF
fi
if [ ! -f /etc/pikampus/yedek.key ]; then
  umask 077
  openssl rand -base64 48 > /etc/pikampus/yedek.key
fi

cat > /etc/cron.d/pikampus <<'EOF'
# Pi Kampüs: sunucu bekçisi ve şifreli gece yedeği (ops/kur.sh)
*/5 * * * * root /usr/local/bin/pikampus-bekci >/dev/null 2>&1
45 3 * * * root /usr/local/bin/pikampus-yedek >> /var/log/pikampus-yedek.log 2>&1
EOF
chmod 644 /etc/cron.d/pikampus
echo "kuruldu"
