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
            raw(transaction_id="bad-date", date="2026-02-30"),
            raw(transaction_id="bad-format", date="20260801"),
        ]
    )
    assert len(rows) == 1
    assert rows[0]["amount"] == -1200


def test_stable_income_currency_and_future_dates():
    rows = [
        raw(transaction_id=month, date=f"2026-{month}-01")
        for month in ["06", "07", "08", "09"]
    ]
    rows += [
        raw(transaction_id="cad", amount=-9000, iso_currency_code="CAD"),
        raw(transaction_id="future", amount=-9000, date="2026-09-30"),
        raw(transaction_id="old", amount=-99999, date="2020-01-01"),
    ]
    result = analyze(clean_transactions(rows), today=date(2026, 9, 10))
    assert result["score"] == 100
    assert result["average"] == 1000
    assert result["current"]["income"] == 1000
    assert result["sources"][0]["total"] == 4000
    assert result["sources"][0]["recurring"]


def test_missing_and_zero_income_months():
    assert analyze([], today=date(2026, 9, 10))["score"] is None
    rows = [
        raw(date="2026-06-01"),
        raw(transaction_id="b", date="2026-07-01"),
        raw(transaction_id="c", date="2026-08-01", name="COFFEE", amount=10),
    ]
    assert analyze(clean_transactions(rows), today=date(2026, 9, 10))["score"] == 29


def test_cents_are_not_lost():
    rows = clean_transactions(
        [raw(amount=-0.1), raw(transaction_id="two", amount=-0.2)]
    )
    assert analyze(rows, today=date(2026, 8, 10))["current"]["income"] == 0.3


def test_months_cross_year_boundary_and_demo_never_uses_future_dates():
    assert month_keys(date(2026, 1, 1))[0] == "2025-07"
    assert all(
        row["date"] <= "2026-01-01" for row in demo_transactions(date(2026, 1, 1))
    )


def test_sync_additions_modifications_and_removals():
    bodies = []

    async def page(path, body):
        bodies.append(body.copy())
        if "cursor" not in body:
            return {
                "added": [raw(), raw(transaction_id="removed")],
                "modified": [],
                "removed": [],
                "next_cursor": "next",
                "has_more": True,
            }
        return {
            "added": [],
            "modified": [raw(amount=-1500)],
            "removed": [{"transaction_id": "removed"}],
            "next_cursor": "done",
            "has_more": False,
        }

    records = asyncio.run(ingest("test-token", page))
    assert len(records) == 1
    assert records[0]["amount"] == -1500
    assert bodies[1]["cursor"] == "next"


def test_sync_restarts_from_initial_cursor_after_mutation():
    calls = []

    async def page(path, body):
        calls.append(body.copy())
        if len(calls) == 1:
            return {
                "added": [raw(transaction_id="stale")],
                "modified": [],
                "removed": [],
                "next_cursor": "next",
                "has_more": True,
            }
        if len(calls) == 2:
            raise SandboxError("RETRY_SYNC")
        assert "cursor" not in body
        return {
            "added": [raw()],
            "modified": [],
            "removed": [],
            "next_cursor": "done",
            "has_more": False,
        }

    assert [
        row["transaction_id"] for row in asyncio.run(ingest("test-token", page))
    ] == ["one"]


def test_sync_retries_are_bounded():
    calls = []

    async def page(path, body):
        calls.append(body)
        raise SandboxError("RETRY_SYNC")

    with pytest.raises(SandboxError):
        asyncio.run(ingest("test-token", page))
    assert len(calls) == 3
