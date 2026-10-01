# IncomeLens

Understand monthly income, recurring payment sources and cash flow, with rules you can inspect. Built in Python 3.12 with FastAPI and Plaid Sandbox.

**Live app:** https://incomelens-olive.vercel.app

## What to do in the app

IncomeLens explores how bank transactions can answer three questions: how much income arrives each month, where it comes from, and how much it varies. It is a working prototype for salary and freelance income analysis, using simulated records only.

Start with the sample dataset; no login is required. Review the Overview, search and filter Transactions, then open Data pipeline to compare original descriptions with cleaned names and classification rules. The page includes a separate Plaid Sandbox guide for testing the bank connection. Test banks may have no transactions or income, so sample data is the easiest way to explore all features. Stability describes past income variation; it is not a credit score or forecast.

![IncomeLens introduction and guide](docs/introduction.jpg)

## Run it

Install Python 3.12, then:

```sh
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000
```

Open http://127.0.0.1:8000. Sample data works without accounts or secrets.

## Four files to understand

| File | What to read it for |
| --- | --- |
| `app.py` | Routes: show a page, export records, connect/disconnect Plaid |
| `pipeline.py` | Clean descriptions, classify records, calculate monthly totals |
