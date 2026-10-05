"""Plaid Sandbox HTTP requests and encrypted connection cookies. Server-only."""

import base64
import hashlib
import os

import httpx
from cryptography.fernet import Fernet, InvalidToken

COOKIE = "incomelens_python_session"


class SandboxError(Exception):
    """A safe error code, never an upstream response containing private values."""


def configured():
    return bool(
        os.getenv("PLAID_CLIENT_ID")
        and os.getenv("PLAID_SECRET")
        and len(os.getenv("SESSION_SECRET", "")) >= 32
    )


def cipher():
    if not configured():
        raise SandboxError("CONFIG")
    key = hashlib.sha256(os.environ["SESSION_SECRET"].encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_token(access_token):
    return cipher().encrypt(access_token.encode()).decode()


def decrypt_token(cookie):
    if not cookie:
        raise SandboxError("SESSION")
    try:
        return cipher().decrypt(cookie.encode(), ttl=7200).decode()
    except (InvalidToken, ValueError):
        raise SandboxError("SESSION") from None


