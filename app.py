"""IncomeLens web routes. Run with: python -m uvicorn app:app --reload"""

import json
import os
import uuid
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response

import plaid
from pipeline import analyze, clean_transactions, demo_transactions
from views import render_page

load_dotenv(".env.local")
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def private_responses(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
