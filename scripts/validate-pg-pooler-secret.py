#!/usr/bin/env python3
"""GitHub Actions: SOURCE/TARGET pooler URI yapısını kontrol et; şifreyi yazdırmaz."""
import os
import sys
from urllib.parse import urlparse, unquote


def check(name: str, raw: str) -> bool:
    if not raw or not raw.strip():
        print(f"::error::{name} boş.", file=sys.stderr)
        return False
    # Gizli satır sonu / CR (GitHub UI çok sık)
    u = urlparse(raw.strip().replace("\r", "").replace("\n", ""))
    if u.scheme not in ("postgresql", "postgres"):
        print(f"::error::{name}: scheme postgresql olmalı.", file=sys.stderr)
        return False
    host = u.hostname or ""
    if "pooler.supabase.com" not in host:
        print(
            f"::warning::{name}: host *.pooler.supabase.com değil ({host!r}). "
            "GitHub runner IPv6 kullanmaz; Session pooler önerilir.",
            file=sys.stderr,
        )
    user = unquote(u.username or "")
    pw = unquote(u.password or "")
    if not user.startswith("postgres.") or "." not in user[len("postgres.") :]:
        print(
            f"::error::{name}: kullanıcı 'postgres.<project_ref>' olmalı; "
            f"şu an libpq şöyle parse etti: kullanıcı uzunluğu={len(user)} "
            f"(ilk 20 char: {user[:20]!r}…). Şifrede '@' veya ':' varsa URL-encode edin.",
            file=sys.stderr,
        )
        return False
    if len(pw) < 1:
        print(
            f"::error::{name}: şifre parse edilemedi (uzunluk 0). "
            "Muhtemel neden: şifrede @ veya : var ve URI kırıldı — "
            "URL-encode (@→%40, :→%3A) veya şifreyi sadece harf+rakam yapıp tekrar deneyin.",
            file=sys.stderr,
        )
        return False
    ref = user.split(".", 1)[1]
    print(
        f"OK {name}: host={host} ref_prefix={ref[:8]}… password_parsed_len={len(pw)}"
    )
    return True


def main() -> int:
    src = os.environ.get("SOURCE_DATABASE_URL", "")
    dst = os.environ.get("TARGET_DATABASE_URL", "")
    ok = check("SOURCE_DATABASE_URL", src) and check("TARGET_DATABASE_URL", dst)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
