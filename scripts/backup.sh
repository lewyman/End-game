#!/bin/bash
set -e
PROJECT_DIR="/home/workspace/bio-sync-academy"
BACKUP_DIR="$PROJECT_DIR/.backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="backup-${TIMESTAMP}"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

mkdir -p "$BACKUP_DIR"

echo "=== Bio-Sync Academy Backup ==="
echo "Timestamp: $TIMESTAMP"
echo "Backing up to: $BACKUP_PATH"

rsync -a \
  --exclude='node_modules' \
  --exclude='.backups' \
  --exclude='dist' \
  --exclude='data/users' \
  --exclude='data/usage' \
  --exclude='data/stats' \
  --exclude='.git' \
  "$PROJECT_DIR/" "$BACKUP_PATH/"

echo ""
echo "✅ Backup created: $BACKUP_NAME"
echo ""
echo "To restore: bash scripts/restore.sh $TIMESTAMP"

ls -la "$BACKUP_PATH" | head -5
