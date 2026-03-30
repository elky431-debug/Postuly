from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Charge backend/.env — ignore les clés inconnues (ex. DATABASE_URL)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # API INSEE / SIRENE
    insee_api_key: str = ""

    # IA
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"

    # Resend
    resend_api_key: str = ""

    # n8n (workflows, ex. envoi d’e-mails)
    n8n_webhook_url: str = ""

    # Vérification email
    millionverifier_api_key: str = ""

    # URLs
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    # Sécurité
    secret_key: str = "change-me-in-production"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
