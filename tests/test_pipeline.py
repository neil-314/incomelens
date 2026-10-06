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
        [
            raw(),
            raw(transaction_id="pending", pending=True),
            raw(transaction_id="transfer", name="TRANSFER SAVINGS"),
            raw(transaction_id="refund", name="SHOP REFUND"),
            raw(transaction_id="unknown", name="ATM CREDIT"),
            raw(transaction_id="expense", name="COFFEE", amount=20),
        ]
    )
    assert {row["transaction_id"]: row["kind"] for row in rows} == {
        "one": "income",
        "pending": "review",
        "transfer": "transfer",
        "refund": "transfer",
        "unknown": "review",
        "expense": "expense",
    }


def test_deduplication_and_validation():
    rows = clean_transactions(
        [
            raw(),
            raw(amount=-1200),
            raw(transaction_id="bad-number", amount=float("nan")),
