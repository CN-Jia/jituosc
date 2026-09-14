#!/bin/bash
# Let's Encrypt SSL 证书自动续签脚本
# 建议加入 crontab: 0 3 * * 1 /opt/jituo/deploy/certbot/renew.sh >> /var/log/certbot-renew.log 2>&1

set -e

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting SSL certificate renewal..."

# 续签证书
certbot renew --quiet --no-self-upgrade

# 重载 Nginx（不中断已有连接）
nginx -t && systemctl reload nginx

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Renewal complete."
