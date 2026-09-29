#!/bin/bash
# 数据库每日备份脚本
#
# 用法：
#   ./backup.sh
#   APP_DIR=/home/jia/jituosc BACKUP_DIR=/home/jia/backups/jituo ./backup.sh
#
# crontab 示例（每天凌晨 3 点）：
#   0 3 * * * APP_DIR=/home/jia/jituosc BACKUP_DIR=/home/jia/backups/jituo \
#     /home/jia/jituosc/deploy/backup.sh >> /home/jia/backups/jituo/backup.log 2>&1
#
# ⚠️ 连接串从后端 .env 读取，不再写死库名/用户名：
#    早期版本写死 DB_NAME=jituo_prod / DB_USER=jituo，而线上实际是 jthub_prod / jthub，
#    照跑会直接失败（而且 cron 里失败往往没人发现）。

set -euo pipefail

APP_DIR="${APP_DIR:-/home/jia/jituosc}"
BACKUP_DIR="${BACKUP_DIR:-/home/jia/backups/jituo}"
KEEP_DAYS="${KEEP_DAYS:-7}"
ENV_FILE="$APP_DIR/backend/.env"

[ -f "$ENV_FILE" ] || { echo "找不到 $ENV_FILE"; exit 1; }

# 优先用外部传入的 DATABASE_URL，否则从 .env 解析（去掉引号与可能的 CR）
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d '\r')
fi
[ -n "$DATABASE_URL" ] || { echo "未能从 $ENV_FILE 解析出 DATABASE_URL"; exit 1; }

# 从连接串里取出库名，用于备份文件命名
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's#.*/([^/?]+)(\?.*)?$#\1#')

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_$TS.sql.gz"

echo "[$(date '+%F %T')] 开始备份 $DB_NAME ..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# 校验：gzip 完整性 + 文件非空（否则静默产生一个坏备份比不备份更危险）
gzip -t "$BACKUP_FILE"
[ -s "$BACKUP_FILE" ] || { echo "备份文件为空，判定失败"; exit 1; }
echo "[$(date '+%F %T')] 备份完成：$BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# 清理超过 KEEP_DAYS 天的旧备份
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
echo "[$(date '+%F %T')] 已清理 $KEEP_DAYS 天前的旧备份"
