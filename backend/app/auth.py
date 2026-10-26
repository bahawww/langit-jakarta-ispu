"""Autentikasi admin: password argon2, JWT di cookie httpOnly, rate limit login."""

import hmac
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Annotated
from urllib.parse import urlsplit

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from fastapi import Depends, HTTPException, Request

from app.config import get_settings

COOKIE = "ispu_session"
_ALG = "HS256"
LOGIN_LIMIT = 5  # percobaan per jendela per IP
LOGIN_WINDOW_S = 60
_hasher = PasswordHasher()


def check_config() -> None:
    s = get_settings()
    missing = [
        k
        for k, v in {
            "ADMIN_USERNAME": s.admin_username,
            "ADMIN_PASSWORD": s.admin_password,
            "JWT_SECRET": s.jwt_secret,
        }.items()
        if not v
    ]
    if missing:
        raise RuntimeError(f"konfigurasi auth belum diisi di deploy/.env: {', '.join(missing)}")
    if len(s.jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET minimal 32 karakter")


@lru_cache
def _password_hash() -> str:
    # Plaintext dari .env hanya dipakai sekali untuk membuat hash di memori.
    return _hasher.hash(get_settings().admin_password)


def verify_credentials(username: str, password: str) -> bool:
    s = get_settings()
    try:
        ok_pw = _hasher.verify(_password_hash(), password)
    except VerificationError:
        ok_pw = False
    return hmac.compare_digest(username.encode(), s.admin_username.encode()) and ok_pw


def issue_token(username: str) -> tuple[str, int]:
    s = get_settings()
    max_age = s.session_hours * 3600
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": username, "iat": now, "exp": now + timedelta(seconds=max_age)},
        s.jwt_secret,
        algorithm=_ALG,
    )
    return token, max_age


def client_ip(request: Request) -> str:
    # Di belakang Cloudflare Tunnel -> Caddy: IP asli ada di CF-Connecting-IP.
    return (
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )


# shortcut: limiter in-memory per proses; cukup untuk 1 proses uvicorn, pindah ke Redis bila
# api dijalankan dengan beberapa worker/replika.
_attempts: dict[str, deque[float]] = defaultdict(deque)


def check_login_rate(ip: str) -> None:
    now = time.monotonic()
    q = _attempts[ip]
    while q and now - q[0] > LOGIN_WINDOW_S:
        q.popleft()
    if len(q) >= LOGIN_LIMIT:
        retry = int(LOGIN_WINDOW_S - (now - q[0])) + 1
        raise HTTPException(
            429,
            f"Terlalu banyak percobaan login. Coba lagi dalam {retry} detik.",
            headers={"Retry-After": str(retry)},
        )
    q.append(now)


def reset_login_rate(ip: str) -> None:
    _attempts.pop(ip, None)


def _same_origin(request: Request) -> bool:
    origin = request.headers.get("origin")
    if not origin:
        return True  # non-browser client (curl, tes); cookie SameSite=Strict tetap berlaku
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    return urlsplit(origin).netloc == host


def require_admin(request: Request) -> str:
    if request.method not in ("GET", "HEAD", "OPTIONS") and not _same_origin(request):
        raise HTTPException(403, "Origin tidak diizinkan")
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Perlu login")
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Sesi tidak valid atau kedaluwarsa") from None
    if payload.get("sub") != get_settings().admin_username:
        raise HTTPException(401, "Sesi tidak valid")
    return payload["sub"]


AdminDep = Annotated[str, Depends(require_admin)]
