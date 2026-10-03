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


@app.get("/export")
async def export(request: Request):
    rows, _, _, message = await page_records(request)
    if message and not rows:
        return JSONResponse({"error": message}, status_code=502)
    return Response(
        json.dumps(rows, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": 'attachment; filename="incomelens-cleaned.json"'
        },
    )


@app.get("/api/plaid")
async def status():
    return {"configured": plaid.configured()}


@app.post("/api/plaid")
async def plaid_action(request: Request):
    # Only this site's browser pages may perform private Plaid actions.
    origin = urlparse(request.headers.get("origin", ""))
    if origin.scheme not in {"http", "https"} or origin.netloc != request.headers.get(
        "host"
    ):
        return JSONResponse({"error": "Invalid request origin."}, status_code=403)
    try:
        body = await request.json()
        if not isinstance(body, dict):
            raise TypeError()
    except (ValueError, TypeError):
        return JSONResponse({"error": "Invalid request body."}, status_code=400)
    try:
        action = body.get("action")
        if action == "link":
            data = await plaid.call(
                "/link/token/create",
                {
                    "client_name": "IncomeLens",
                    "language": "en",
                    "country_codes": ["US"],
                    "user": {"client_user_id": str(uuid.uuid4())},
                    "products": ["transactions"],
                    "transactions": {"days_requested": 210},
                },
            )
            return {"link_token": data["link_token"]}
        if action == "exchange":
            public_token = body.get("public_token")
            if (
                not isinstance(public_token, str)
                or not public_token
                or len(public_token) > 1000
            ):
                return JSONResponse({"error": "Invalid token."}, status_code=400)
            data = await plaid.call(
                "/item/public_token/exchange", {"public_token": public_token}
            )
            response = JSONResponse({"connected": True})
            response.set_cookie(
                plaid.COOKIE,
                plaid.encrypt_token(data["access_token"]),
