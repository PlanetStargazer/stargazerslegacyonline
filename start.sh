#!/usr/bin/env bash
# Starts Stargazer's Legacy Online with PHP's built-in web server (fine for friends & testing).
# For a real deployment point Apache/nginx+php-fpm at the public/ folder (see README.md).
export PATH="/tmp/claude-1000/mm/php/bin:$PATH"
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"
if ! command -v php >/dev/null 2>&1; then
  echo "PHP was not found. Install it first, e.g.  sudo dnf install php-cli php-pdo   (or: sudo apt install php-cli php-sqlite3)" >&2
  exit 1
fi
if ! php -r 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);'; then
  echo "PHP is missing the pdo_sqlite extension (Fedora: php-pdo, Debian/Ubuntu: php-sqlite3)." >&2
  exit 1
fi
mkdir -p server/data
echo "Stargazer's Legacy Online -> http://localhost:${PORT}/   (Ctrl+C to stop)"
# several workers so that many players can poll at the same time (PHP >= 7.4, Linux/macOS)
export PHP_CLI_SERVER_WORKERS="${WORKERS:-8}"
exec php -S "${HOST}:${PORT}" -t public
