from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Smart Meal Planner"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    DATABASE_URL: str = "sqlite+aiosqlite:///./mealplanner.db"
    REDIS_URL: str = ""

    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "qwen/qwen3.6-27b"
    LLM_MAX_CACHE_AGE_HOURS: int = 24

    ADVCASH_ACCOUNT_EMAIL: str = ""
    ADVCASH_SCI_NAME: str = ""
    ADVCASH_SCI_PASSWORD: str = ""
    ADVCASH_CURRENCY: str = "USD"
    ADVCASH_PLAN_PRICE_USD: float = 6.0
    ADVCASH_SUBSCRIPTION_DAYS: int = 30

    # Volet payment gateway configuration
    VOLET_MERCHANT_ID: str = ""
    VOLET_API_KEY: str = ""
    VOLET_SECRET_KEY: str = ""
    VOLET_WEEKLY_PRICE_USD: float = 2.0
    VOLET_MONTHLY_PRICE_USD: float = 7.0
    VOLET_WEEKLY_SUBSCRIPTION_DAYS: int = 7
    VOLET_MONTHLY_SUBSCRIPTION_DAYS: int = 30

    ADMIN_CODE: str = "14122008"

    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"
    CORS_ORIGINS: Annotated[list[str], NoDecode] = []

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            return [o.strip() for o in v.split(",")]
        return v

    @property
    def resolved_cors_origins(self) -> list[str]:
        if self.CORS_ORIGINS:
            return [o.strip() for o in self.CORS_ORIGINS]
        if self.is_development:
            return ["*"]
        return [o.strip() for o in self.FRONTEND_URL.split(",")]

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() in {"development", "dev", "local"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
