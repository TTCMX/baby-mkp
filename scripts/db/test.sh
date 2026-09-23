#!/usr/bin/env bash
# Validates supabase/migrations + seed + RLS tests on a throwaway local
# PostgreSQL (no Docker needed). Usage: npm run db:test
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
TMP="$(mktemp -d)"
PORT="${PGTEST_PORT:-55432}"
trap '"$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT

RUN_AS=""
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$TMP"
  RUN_AS="runuser -u postgres --"
fi

$RUN_AS "$PG_BIN/initdb" -D "$TMP/data" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
$RUN_AS "$PG_BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$TMP" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$ROOT/scripts/db/supabase-stubs.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ $(basename "$f")"
  "${PSQL[@]}" -o /dev/null -f "$f"
done
echo "→ seed.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
[ -n "${DB_DEBUG:-}" ] && { "${PSQL[@]}" -c "$DB_DEBUG"; exit 0; }
for f in "$ROOT"/supabase/tests/*.sql; do
  echo "→ test $(basename "$f")"
  "${PSQL[@]}" -o /dev/null -f "$f"
done
echo "✓ database checks passed"
