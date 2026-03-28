"""Routes d'authentification — proxy vers Supabase Auth."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from app.db.client import get_supabase_client

router = APIRouter()


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    redirect_url: str = "http://localhost:3000/auth/callback"


@router.post("/signup")
async def sign_up(body: SignUpRequest) -> dict:
    """Inscription par email/mot de passe."""
    supabase = get_supabase_client()
    try:
        response = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {
                "data": {"full_name": body.full_name}
            },
        })
        return {
            "user_id": response.user.id if response.user else None,
            "message": "Inscription réussie. Vérifiez votre email.",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin")
async def sign_in(body: SignInRequest) -> dict:
    """Connexion par email/mot de passe."""
    supabase = get_supabase_client()
    try:
        response = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user": {
                "id": response.user.id,
                "email": response.user.email,
                "full_name": response.user.user_metadata.get("full_name"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")


@router.post("/google")
async def google_auth(body: GoogleAuthRequest) -> dict:
    """Génère l'URL OAuth Google pour la connexion."""
    supabase = get_supabase_client()
    try:
        response = supabase.auth.sign_in_with_oauth({
            "provider": "google",
            "options": {
                "redirect_to": body.redirect_url,
                "scopes": "email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
            },
        })
        return {"url": response.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
