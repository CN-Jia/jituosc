#!/bin/bash
# 数据库每日备份脚本 —— 每天凌晨 3 点执行
# crontab: 0 3 * * * /var/www/jituo/deploy/backup.sh

set -e

BACKUP_DIR="/var/backups/jituo"
DB_NAME="jituo_prod"
DB_USER="jituo"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/jituo_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] 开始备份数据库 $DB_NAME ..."
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
echo "[$(date)] 备份完成：$BACKUP_FILE"

# 清理 7 天前的备份
find "$BACKUP_DIR" -name "jituo_*.sql.gz" -mtime +7 -delete
echo "[$(date)] 已清理 7 天前的旧备份"
