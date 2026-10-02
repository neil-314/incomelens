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
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


async def page_records(request):
    cookie = request.cookies.get(plaid.COOKIE)
    connected = False
    message = ""
    access_token = None
    if cookie:
        try:
            access_token = plaid.decrypt_token(cookie)
            connected = True
        except plaid.SandboxError as error:
            message = plaid.error_message(error)
    mode = request.query_params.get("mode", "sandbox" if connected else "demo")
    mode = "sandbox" if mode == "sandbox" else "demo"
    records = demo_transactions() if mode == "demo" else []
    if mode == "sandbox":
        try:
            if not access_token:
                raise plaid.SandboxError("SESSION")
            records = await plaid.ingest(access_token)
            if not records:
                message = (
                    "Connected successfully, but Plaid returned no transactions for this test account. "
                    "You can show sample data, or disconnect and try another Sandbox checking account."
                )
        except plaid.SandboxError as error:
            message = plaid.error_message(error)
    return clean_transactions(records), connected, mode, message


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    rows, connected, mode, message = await page_records(request)
    currencies = sorted(
        {
            "USD",
            *(row["iso_currency_code"] for row in rows if row.get("iso_currency_code")),
        }
    )
    currency = request.query_params.get("currency", "USD")
    if currency not in currencies:
        currency = "USD"
    view = request.query_params.get("view", "overview")
    if view not in {"overview", "transactions", "pipeline"}:
        view = "overview"
    report = analyze(rows, currency)
    return render_page(
        rows,
        report,
        currencies,
        currency,
        view,
        mode,
        connected,
        message,
        request.query_params.get("q", ""),
        request.query_params.get("kind", "all"),
    )


