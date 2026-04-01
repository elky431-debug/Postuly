"""Déchiffrement / chiffrement alignés sur frontend/src/lib/crypto.ts (AES-256-GCM, clé = SHA-256(ENCRYPTION_KEY))."""

from __future__ import annotations

import hashlib
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _key32(secret: str) -> bytes:
    return hashlib.sha256(secret.encode("utf-8")).digest()


def decrypt_token_field(encrypted: str, secret: str) -> str:
    """Inverse de chiffrer() côté Next : format iv_hex:tag_hex:ciphertext_hex."""
    parts = encrypted.split(":")
    if len(parts) != 3:
        raise ValueError("Format chiffré invalide")
    iv_hex, tag_hex, ciphertext_hex = parts
    key = _key32(secret)
    nonce = bytes.fromhex(iv_hex)
    ciphertext = bytes.fromhex(ciphertext_hex)
    tag = bytes.fromhex(tag_hex)
    aesgcm = AESGCM(key)
    plain = aesgcm.decrypt(nonce, ciphertext + tag, None)
    return plain.decode("utf-8")


def encrypt_token_field(plaintext: str, secret: str) -> str:
    """Même sortie que chiffrer() côté Next."""
    key = _key32(secret)
    nonce = os.urandom(16)
    aesgcm = AESGCM(key)
    combined = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    tag = combined[-16:]
    ciphertext = combined[:-16]
    return f"{nonce.hex()}:{tag.hex()}:{ciphertext.hex()}"


def maybe_decrypt_token(value: Optional[str], secret: str) -> str:
    """Si format iv:tag:hex (comme Next) et clé fournie → déchiffre ; sinon texte brut."""
    if not value:
        return ""
    if not (secret and secret.strip()):
        return value
    parts = value.split(":")
    if len(parts) != 3:
        return value
    try:
        return decrypt_token_field(value, secret.strip())
    except Exception as exc:
        raise ValueError(
            "Token Gmail illisible : vérifie ENCRYPTION_KEY (identique à frontend/.env.local)."
        ) from exc


def maybe_encrypt_token(value: Optional[str], secret: str) -> str:
    """Chiffre pour réécriture en base si secret présent."""
    if not value or not (secret and secret.strip()):
        return value or ""
    return encrypt_token_field(value, secret.strip())
