from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    seed_dir: Path = Path("/seed")
    artifacts_dir: Path = Path("/artifacts")
    redis_url: str = "redis://redis:6379/0"
    log_level: str = "INFO"
    # Admin tunggal dari .env; api menolak start bila kosong (lihat app.auth.check_config).
    admin_username: str = ""
    admin_password: str = ""
    jwt_secret: str = ""
    cookie_secure: bool = True
    session_hours: int = 8
    upload_max_bytes: int = 5 * 1024 * 1024
    # Sinkronisasi opsional dari portal Satu Data Jakarta. URL = resource resmi yang dicantumkan
    # di data.go.id untuk dataset ini (bukan tebakan). Mati secara default.
    satudata_sync: bool = False
    satudata_url: str = (
        "https://satudata.jakarta.go.id/backend/restapi/v1/datasets/export/"
        "4a01bb54c2ab6ed3270b9e2b0950d584/"
        "data-indeks-standar-pencemar-udara-ispu-di-provinsi-dki-jakarta.csv"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
