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
