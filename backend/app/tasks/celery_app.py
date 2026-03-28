"""Configuration Celery pour les tâches en arrière-plan."""

from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "postuly",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Paris",
    enable_utc=True,
    task_track_started=True,
    # Limiter la concurrence pour respecter les rate limits
    worker_concurrency=4,
    # Retry policy par défaut
    task_default_retry_delay=60,
    task_max_retries=3,
)

# Auto-découverte des tâches
celery_app.autodiscover_tasks(["app.tasks"])
