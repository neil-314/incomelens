import asyncio
from datetime import date

import pytest

from pipeline import analyze, clean_transactions, demo_transactions, month_keys
from plaid import SandboxError, ingest


def raw(**changes):
    return {
        "transaction_id": "one",
        "date": "2026-08-01",
        "name": "PAYROLL ACME",
        "amount": -1000,
        "pending": False,
        "iso_currency_code": "USD",
        **changes,
    }


def test_classification_rules():
    rows = clean_transactions(
