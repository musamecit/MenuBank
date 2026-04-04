#!/usr/bin/env bash
# Git geçmişinden YEDEK DUMP dosyalarını kaldırır (SQL içinde API key URL’leri vardı).
# daily_backup.sh / env.ts içindeki ESKİ sırlar satır içinde kaldığı için:
#   ya GitHub’ın verdiği "Revoke secret" akışını kullanın + anahtarları rotate edin,
#   ya da aşağıdaki "replace-text" yöntemini Antigravity prompt’u ile uygulayın.
#
# Önkoşul: pip install git-filter-repo
# Sonra: git push --force origin main

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "Kur: pip install git-filter-repo" >&2
  exit 1
fi

echo "5 sn içinde Ctrl+C ile iptal — geçmiş yeniden yazılacak..."
sleep 5

git filter-repo --force \
  --path-glob 'backups/*.sql' \
  --path-glob 'backups/*.dump' \
  --invert-paths

echo "OK. Uzak repo:"
echo "  git push --force origin main"
