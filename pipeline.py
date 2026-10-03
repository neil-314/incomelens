"""Ordinary Python rules: raw bank records -> cleaned records -> monthly totals."""

import math
import re
import statistics
from datetime import date
from decimal import Decimal


def month_keys(today):
    """Six previous calendar months plus the current month, across year boundaries."""
    end = today.year * 12 + today.month - 1
    return [
        f"{number // 12:04d}-{number % 12 + 1:02d}"
        for number in range(end - 6, end + 1)
    ]


def clean_transactions(records):
    # Last version wins if Plaid returns the same transaction ID more than once.
    unique = {
        row["transaction_id"]: row
        for row in records
        if isinstance(row.get("transaction_id"), str)
    }
    cleaned = []
    for row in unique.values():
        try:
            transaction_date = date.fromisoformat(row["date"])
            amount = float(row["amount"])
            if transaction_date.isoformat() != row["date"] or not math.isfinite(amount):
                continue
        except (KeyError, ValueError, TypeError):
            continue
        name = str(row.get("name", "Unknown transaction"))
        uppercase = name.upper()
        category = (row.get("personal_finance_category") or {}).get("primary", "")
        kind, reason = (
