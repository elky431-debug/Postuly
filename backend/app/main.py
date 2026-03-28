"""Point d'entrée de l'API FastAPI Postuly."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.auth import router as auth_router
from app.api.profiles import router as profiles_router
from app.api.campaigns import router as campaigns_router
from app.api.companies import router as companies_router
from app.api.applications import router as applications_router
from app.api.cv import router as cv_router

settings = get_settings()

app = FastAPI(
    title="Postuly API",
    description="API pour l'automatisation de candidatures d'emploi",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
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


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "postuly-api"}
