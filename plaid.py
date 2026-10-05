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


async def call(path, body):
    if not configured():
        raise SandboxError("CONFIG")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://sandbox.plaid.com" + path,
                json={
                    "client_id": os.environ["PLAID_CLIENT_ID"],
                    "secret": os.environ["PLAID_SECRET"],
                    **body,
                },
            )
        data = response.json()
    except (httpx.HTTPError, ValueError):
        raise SandboxError("PLAID") from None
    if response.is_error:
        code = (
            "RETRY_SYNC"
            if data.get("error_code") == "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
            else "PLAID"
        )
        raise SandboxError(code)
    return data


async def ingest(access_token, fetch_page=None):
    """Rebuild from the initial cursor; no database required for this small demo."""
    fetch_page = fetch_page or call
    for attempt in range(3):
        rows, cursor = {}, None
        try:
            for _ in range(100):
                body = {"access_token": access_token, "count": 500}
                if cursor is not None:
                    body["cursor"] = cursor
                page = await fetch_page("/transactions/sync", body)
                for row in page["added"] + page["modified"]:
