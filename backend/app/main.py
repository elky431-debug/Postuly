"""Point d'entrée de l'API FastAPI Postuly."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.auth import router as auth_router
from app.api.profiles import router as profiles_router
from app.api.campaigns import router as campaigns_router
from app.api.companies import router as companies_router
from app.api.applications import router as applications_router
from app.api.cv import router as cv_router
from app.api.diagnostic import router as diagnostic_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log = logging.getLogger("uvicorn.error")
    missing = [
        name
        for name, val in (
            ("SUPABASE_URL", settings.supabase_url),
            ("SUPABASE_ANON_KEY", settings.supabase_anon_key),
            ("SUPABASE_SERVICE_ROLE_KEY", settings.supabase_service_role_key),
        )
        if not (val or "").strip()
    ]
    if missing:
        log.warning(
            "backend/.env incomplet : %s — /api/profiles et /api/cv risquent d'échouer.",
            ", ".join(missing),
        )
    yield


app = FastAPI(
    title="Postuly API",
    description="API pour l'automatisation de candidatures d'emploi",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(profiles_router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(campaigns_router, prefix="/api/campaigns", tags=["Campaigns"])
app.include_router(companies_router, prefix="/api/companies", tags=["Companies"])
app.include_router(applications_router, prefix="/api/applications", tags=["Applications"])
app.include_router(cv_router, prefix="/api/cv", tags=["CV"])
app.include_router(diagnostic_router, prefix="/api/diagnostic", tags=["Diagnostic"])


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "postuly-api"}
