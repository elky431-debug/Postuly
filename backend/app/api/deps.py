"""Dépendances partagées entre les routes API."""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from supabase import Client

from app.db.client import get_supabase_client


async def get_current_user(authorization: str = Header(...)) -> dict:
    """Vérifie le JWT Supabase et retourne les infos utilisateur."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token d'authentification invalide",
        )

    token = authorization.replace("Bearer ", "")
    supabase: Client = get_supabase_client()

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Utilisateur non trouvé",
            )
        return {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "token": token,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalide : {str(e)}",
        )


CurrentUser = Annotated[dict, Depends(get_current_user)]
