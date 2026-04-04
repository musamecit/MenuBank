#!/usr/bin/env python3
"""
GitHub Actions runner'da IPv6 genelde ulaşılamaz; libpq'ya PGHOSTADDR (IPv4) + PGHOST (SNI) verir.

Kullanım (bash):
  eval "$(python3 scripts/pg_ci_libpq_env.py SOURCE_DATABASE_URL)"
  psql -v ON_ERROR_STOP=1 -c 'select 1'

İlk argüman: okunacak ortam değişkeninin adı (SOURCE_DATABASE_URL veya TARGET_DATABASE_URL).
"""
from __future__ import annotations

import os
import re
import shlex
import subprocess
import sys
import urllib.parse


def dig_a(host: str) -> str:
    for srv in ("8.8.8.8", "1.1.1.1"):
        r = subprocess.run(
            ["dig", "+short", "A", host, f"@{srv}"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        for line in r.stdout.splitlines():
            t = line.strip()
            if re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}", t):
                return t
    r = subprocess.run(
        ["dig", "+short", "A", host],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    for line in r.stdout.splitlines():
        t = line.strip()
        if re.fullmatch(r"(?:\d{1,3}\.){3}\d{1,3}", t):
            return t
    return ""


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: pg_ci_libpq_env.py SOURCE_DATABASE_URL|TARGET_DATABASE_URL", file=sys.stderr)
        sys.exit(2)
    key = sys.argv[1]
    raw = (os.environ.get(key) or "").strip()
    if not raw:
        print(f"missing env {key}", file=sys.stderr)
        sys.exit(1)
    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme not in ("postgresql", "postgres"):
        print("URL must be postgresql:// or postgres://", file=sys.stderr)
        sys.exit(1)
    host = parsed.hostname
    if not host:
        print("URL has no host", file=sys.stderr)
        sys.exit(1)
    port = parsed.port or 5432
    user = urllib.parse.unquote(parsed.username or "postgres")
    password = urllib.parse.unquote(parsed.password or "")
    db = (parsed.path or "/postgres").lstrip("/") or "postgres"

    ipv4 = dig_a(host)
    if not ipv4:
        print(f"no IPv4 A record for {host} (dig)", file=sys.stderr)
        sys.exit(1)

    ssl = os.environ.get("PGSSLMODE", "require")
    timeout = os.environ.get("PGCONNECT_TIMEOUT", "30")

    print(f"export PGHOST={shlex.quote(host)}")
    print(f"export PGHOSTADDR={shlex.quote(ipv4)}")
    print(f"export PGPORT={shlex.quote(str(port))}")
    print(f"export PGUSER={shlex.quote(user)}")
    print(f"export PGPASSWORD={shlex.quote(password)}")
    print(f"export PGDATABASE={shlex.quote(db)}")
    print(f"export PGSSLMODE={shlex.quote(ssl)}")
    print(f"export PGCONNECT_TIMEOUT={shlex.quote(timeout)}")


if __name__ == "__main__":
    main()
