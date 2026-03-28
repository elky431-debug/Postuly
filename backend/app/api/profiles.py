"""Routes pour la gestion des profils utilisateurs."""

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser
from app.db.client import get_supabase_admin
from app.models.schemas import ProfileResponse, ProfileUpdate

router = APIRouter()


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(user: CurrentUser) -> dict:
    """Récupère le profil de l'utilisateur connecté."""
    supabase = get_supabase_admin()
    response = supabase.table("profiles").select("*").eq("id", user["id"]).single().execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Profil non trouvé")

    return response.data


@router.patch("/me", response_model=ProfileResponse)
async def update_my_profile(body: ProfileUpdate, user: CurrentUser) -> dict:
    """Met à jour le profil (type, nom)."""
    supabase = get_supabase_admin()
    update_data = body.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    response = (
        supabase.table("profiles")
        .update(update_data)
        .eq("id", user["id"])
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Profil non trouvé")

    return response.data[0]
