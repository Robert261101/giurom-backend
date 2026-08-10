#!/usr/bin/env bash
# Rulează migrările din scripts/migration-manifest.txt + seed permisiuni (CI/CD pe server).
# Idempotent: evidență în `_applied_migrations` pe fiecare DB.
set -euo pipefail

ROOT="${GIUROM_BACKEND_ROOT:-$HOME/giurom-backend}"
MANIFEST="${1:-$ROOT/scripts/migration-manifest.txt}"

load_db_env() {
  local env_file="$1"
  if [[ ! -f "$env_file" ]]; then
    echo "ERROR: lipsește $env_file" >&2
    exit 1
  fi
  DB_HOST="$(grep -E '^DB_HOST=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\r')"
  DB_PORT="$(grep -E '^DB_PORT=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\r')"
  DB_USERNAME="$(grep -E '^DB_USERNAME=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\r')"
  DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\r')"
  DB_DATABASE="$(grep -E '^DB_DATABASE=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\r')"
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-3306}"
  if [[ -z "${DB_USERNAME}" || -z "${DB_DATABASE}" ]]; then
    echo "ERROR: DB_USERNAME/DB_DATABASE lipsă în $env_file" >&2
    exit 1
  fi
}

mysql_cmd() {
  mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p"$DB_PASSWORD" "$@"
}

ensure_tracking_table() {
  mysql_cmd "$DB_DATABASE" -e \
    "CREATE TABLE IF NOT EXISTS \`_applied_migrations\` (
      \`filename\` VARCHAR(255) NOT NULL PRIMARY KEY,
      \`applied_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
}

already_applied() {
  local filename="$1"
  local count
  count="$(mysql_cmd "$DB_DATABASE" -N -e \
    "SELECT COUNT(*) FROM \`_applied_migrations\` WHERE \`filename\`='${filename//\'/\\\'}';")"
  [[ "$count" != "0" ]]
}

mark_applied() {
  local filename="$1"
  mysql_cmd "$DB_DATABASE" -e \
    "INSERT INTO \`_applied_migrations\` (\`filename\`) VALUES ('${filename//\'/\\\'}');"
}

resolve_service_for_path() {
  local rel="$1"
  case "$rel" in
    suppliers-ms/*) echo "suppliers-ms" ;;
    stock/*) echo "stock" ;;
    *)
      echo "ERROR: path necunoscut în manifest: $rel" >&2
      exit 1
      ;;
  esac
}

# Pe server fișierele stau sub ROOT (rsync din CI), nu sub structura sursă stock/src/...
server_path_for() {
  local rel="$1"
  case "$rel" in
    suppliers-ms/migrations/*)
      echo "$ROOT/suppliers-ms/migrations/$(basename "$rel")"
      ;;
    stock/src/stock/migrations/*|stock/migrations/*)
      echo "$ROOT/stock/migrations/$(basename "$rel")"
      ;;
    *)
      echo "$ROOT/$rel"
      ;;
  esac
}

read_db_name_from_env() {
  local env_file="$1"
  grep -E '^DB_DATABASE=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\r'
}

# Unele SQL-uri (backfill cross-DB) folosesc placeholderi în loc de nume hardcodate.
materialize_sql_file() {
  local src="$1"
  local dest="$2"
  local auth_db employees_db
  auth_db="$(read_db_name_from_env "$ROOT/auth/.env")"
  employees_db="$(read_db_name_from_env "$ROOT/employees/.env")"
  if [[ -z "$auth_db" || -z "$employees_db" ]]; then
    echo "ERROR: nu pot citi DB_DATABASE din auth/employees .env" >&2
    exit 1
  fi
  sed -e "s/__AUTH_DB__/${auth_db}/g" -e "s/__EMPLOYEES_DB__/${employees_db}/g" "$src" > "$dest"
}

run_sql_from_manifest_line() {
  local rel="$1"
  local service file base tmp
  service="$(resolve_service_for_path "$rel")"
  file="$(server_path_for "$rel")"
  base="$(basename "$rel")"

  load_db_env "$ROOT/$service/.env"
  ensure_tracking_table

  if [[ ! -f "$file" ]]; then
    echo "ERROR: fișier lipsă pe server: $file (din $rel)" >&2
    exit 1
  fi
  if already_applied "$base"; then
    echo "SKIP already applied: $base ($DB_DATABASE)"
    return 0
  fi
  echo "APPLY $base -> $DB_DATABASE"
  if grep -q '__AUTH_DB__\|__EMPLOYEES_DB__' "$file"; then
    tmp="$(mktemp)"
    materialize_sql_file "$file" "$tmp"
    mysql_cmd "$DB_DATABASE" < "$tmp"
    rm -f "$tmp"
  else
    mysql_cmd "$DB_DATABASE" < "$file"
  fi
  mark_applied "$base"
  echo "OK $base"
}

run_auth_seed() {
  local seed="$ROOT/scripts/seed-stock-waste-permissions.js"
  if [[ ! -f "$seed" ]]; then
    echo "ERROR: seed lipsă: $seed" >&2
    exit 1
  fi
  load_db_env "$ROOT/auth/.env"
  echo "=== Seed permissions ($DB_DATABASE) ==="
  export DB_HOST DB_PORT
  export DB_USER="$DB_USERNAME"
  export DB_PASSWORD
  export DB_AUTH_NAME="$DB_DATABASE"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1090
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
  NODE_PATH="$ROOT/stock/node_modules${NODE_PATH:+:$NODE_PATH}" \
    node "$seed"
  echo "OK seed-stock-waste-permissions.js"
}

echo "ROOT=$ROOT"
echo "MANIFEST=$MANIFEST"

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: manifest lipsă: $MANIFEST" >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  line="$(echo "$line" | tr -d '\r' | sed 's/#.*//;s/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$line" ]] && continue
  run_sql_from_manifest_line "$line"
done < "$MANIFEST"

run_auth_seed
echo "DONE migrations"
