#!/usr/bin/env bash
# Run ONE SQL behaviour file against a disposable PostgreSQL 16 database.
# Each behaviour file owns its fixtures and documents its required schema chain.
set -Eeuo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: set DATABASE_URL to a disposable PostgreSQL 16 database" >&2
  exit 2
fi
if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: DATABASE_URL=postgres://... $0 tests/sql/<behaviour-file>.sql" >&2
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql is required (PostgreSQL 16 client)" >&2
  exit 2
fi

sql_file="$1"
output="$(mktemp)"
trap 'rm -f "$output"' EXIT

echo "Running $sql_file against the supplied disposable database"
# Some legacy behaviour files set ON_ERROR_STOP=0 so assertions can continue after a failure.
# Therefore psql's exit status alone is insufficient: capture and reject every SQL ERROR and FAIL line.
if ! psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$sql_file" 2>&1 | tee "$output"; then
  echo "ERROR: psql exited unsuccessfully for $sql_file" >&2
  exit 1
fi
if grep -Ei '(^|[[:space:]])(ERROR:|FAIL[[:space:]])' "$output"; then
  echo "ERROR: SQL behaviour assertions failed in $sql_file" >&2
  exit 1
fi
echo "PASS: $sql_file (no SQL errors or FAIL assertions)"
