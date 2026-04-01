"""Route d'envoi d'email via Gmail (appelée par n8n)."""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from app.services.gmail import send_email

router = APIRouter()


class SendEmailBody(BaseModel):
    to: str
    subject: str
    body: str
    userId: str
    applicationId: str


@router.post("/send")
async def send_email_route(
    payload: SendEmailBody,
    x_internal_key: str = Header(...),
) -> dict:
    if x_internal_key != "postuly_internal_2024":
        raise HTTPException(status_code=401, detail="Non autorisé")

    result = await send_email(
        user_id=payload.userId,
        to_email=payload.to,
        subject=payload.subject,
        body=payload.body,
    )
    return {"success": True, "message_id": result.get("message_id")}
