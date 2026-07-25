"""
Central configuration for AirportOS backend.

All values are overridable via environment variables so the same image
runs unmodified in local Docker Compose and in Kubernetes (via ConfigMap
/ Secret injection).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "AirportOS - AI Disruption Recovery Copilot"
    ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production-please"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12

    DATABASE_URL: str = "postgresql+asyncpg://airportos:airportos@postgres:5432/airportos"
    REDIS_URL: str = "redis://redis:6379/0"

    # Kafka is the target production event bus. In this MVP the same
    # publish/subscribe interface (app.eventbus) is backed by an in-process
    # asyncio implementation so the system runs without external infra.
    # Setting KAFKA_ENABLED=true (and providing a real client) is the
    # documented upgrade path — see docs/ARCHITECTURE.md.
    KAFKA_ENABLED: bool = False
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"

    # LLM configuration. If OPENAI_API_KEY is not set, the system falls
    # back to a deterministic, explainable heuristic reasoning engine so
    # the product is fully demoable offline / without billing.
    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-5"

    SIMULATOR_FLIGHT_COUNT: int = 500
    SIMULATOR_GATE_COUNT: int = 90
    SIMULATOR_TICK_SECONDS: float = 2.0

    CORS_ORIGINS: list[str] = ["*"]


settings = Settings()
