from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    seed_dir: Path = Path("/seed")
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
