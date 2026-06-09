#!/bin/bash
set -e
PROJECT_DIR="/home/workspace/bio-sync-academy"
BACKUP_DIR="$PROJECT_DIR/.backups"

if [ -z "$1" ]; then
  echo "Usage: bash scripts/restore.sh <timestamp>"
  echo ""
  echo "Available backups:"
  ls -1 "$BACKUP_DIR" 2>/dev/null | grep "^backup-" | sed 's/backup-//'
  exit 1
fi

BACKUP_PATH="$BACKUP_DIR/backup-$1"

if [ ! -d "$BACKUP_PATH" ]; then
  echo "❌ Backup not found: $BACKUP_PATH"
  echo "Available backups:"
  ls -1 "$BACKUP_DIR" 2>/dev/null | grep "^backup-" | sed 's/backup-//'
  exit 1
fi

echo "=== Bio-Sync Academy Restore ==="
echo "Restoring from: backup-$1"
echo ""
echo "⚠️  This will overwrite the current project files."
read -p "Are you sure? (y/N): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Cancelled."
  exit 0
fi

rsync -a "$BACKUP_PATH/" "$PROJECT_DIR/"

echo ""
echo "✅ Restored to backup-$1"
echo "Run 'bun install' if dependencies changed."
