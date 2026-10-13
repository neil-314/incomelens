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
        transfer_match = re.search(r"TRANSFER|REFUND|REVERSAL|CASHBACK", uppercase)
        income_match = re.search(r"PAYROLL|SALARY|FREELANCE|CLIENT PAYMENT", uppercase)
        kind, reason = (
            "review",
            "Unrecognized credit; excluded from income until reviewed.",
        )
        if row.get("pending"):
            reason = "Pending transaction; excluded until posted."
        elif category.startswith("TRANSFER") or transfer_match:
            evidence = (
                f'category "{category}"'
                if category.startswith("TRANSFER")
                else f'description contains "{transfer_match.group()}"'
            )
            kind, reason = (
                "transfer",
                f"Transfer or returned money: {evidence}; excluded from earned income.",
            )
        elif amount > 0:
            kind, reason = (
                "expense",
                "Positive Plaid amounts represent money leaving the account.",
            )
        elif amount < 0 and (category == "INCOME" or income_match):
            kind, reason = (
                "income",
                'Posted credit; category "INCOME" matched.'
                if category == "INCOME"
                else f'Posted credit; description contains "{income_match.group()}".',
            )
        source = re.sub(
            r"PAYROLL|SALARY|DIRECT DEP(?:OSIT)?|FREELANCE|CLIENT PAYMENT|\*|\d+",
            " ",
            uppercase,
        )
        source = " ".join(source.split()).title() or name
        # Keep raw fields alongside the cleaned result so every decision is traceable.
        cleaned.append(
            {
                **row,
                "amount": amount,
                "name": name,
                "source": source,
                "kind": kind,
                "reason": reason,
            }
        )
    return sorted(cleaned, key=lambda row: row["date"], reverse=True)


def analyze(records, currency="USD", today=None):
    today = today or date.today()
    keys = month_keys(today)
    months = [
        {
            "month": key,
            "label": date.fromisoformat(key + "-01").strftime("%b"),
            "income": Decimal(0),
            "expenses": Decimal(0),
        }
        for key in keys
    ]
    eligible = [
        row
        for row in records
        if row.get("iso_currency_code") == currency
        and row["date"] <= today.isoformat()
        and not row.get("pending")
        and row["date"][:7] in keys
    ]
    for row in eligible:
        month = months[keys.index(row["date"][:7])]
        amount = Decimal(str(row["amount"])).quantize(Decimal("0.01"))
        if row["kind"] == "income":
            month["income"] -= amount
        elif row["kind"] == "expense":
            month["expenses"] += amount
    observed = {row["date"][:7] for row in eligible}
    history = [
        float(month["income"]) for month in months[:-1] if month["month"] in observed
    ]
    average = statistics.mean(history) if history else 0
    score = None
    if len(history) >= 3 and average > 0:
        score = math.floor(
            max(0, 100 * (1 - statistics.pstdev(history) / average)) + 0.5
        )
    sources = []
    for source in sorted(
        {row["source"] for row in eligible if row["kind"] == "income"}
    ):
        payments = [
            row
            for row in eligible
            if row["kind"] == "income" and row["source"] == source
        ]
        distinct_months = len({row["date"][:7] for row in payments})
        sources.append(
            {
                "source": source,
                "total": float(
                    sum((-Decimal(str(row["amount"])) for row in payments), Decimal(0))
                ),
                "count": len(payments),
                "months": distinct_months,
                "recurring": distinct_months >= 3,
            }
        )
    for month in months:
        month["has_records"] = month["month"] in observed
        month["income"], month["expenses"] = (
            float(month["income"]),
            float(month["expenses"]),
        )
    return {
        "months": months,
        "current": months[-1],
        "average": average,
        "score": score,
        "complete_months": len(history),
        "sources": sorted(sources, key=lambda source: source["total"], reverse=True),
        "review": sum(row["kind"] == "review" for row in records),
    }


def demo_transactions(today=None):
    today = today or date.today()
    records = []
    for index, month in enumerate(month_keys(today)):
        examples = [
            (1, "PAYROLL ACME STUDIO", -2400, "INCOME"),
            (15, "PAYROLL ACME STUDIO", -2400, "INCOME"),
            (5, "FREELANCE NORTHSTAR", -(650 + (6 - index) * 45), "INCOME"),
            (2, "RENT GREENWOOD", 1650, "RENT_AND_UTILITIES"),
            (6, "GROCERY MARKET", 245 + (6 - index) * 12, "FOOD_AND_DRINK"),
            (7, "TRANSFER SAVINGS", -400, "TRANSFER_IN"),
            (8, "UNIDENTIFIED DEPOSIT", -90, "OTHER_INFLOW"),
        ]
        for day, name, amount, category in examples:
            transaction_date = f"{month}-{day:02d}"
            if transaction_date <= today.isoformat():
                records.append(
                    {
                        "transaction_id": f"{month}-{name}-{day}",
                        "date": transaction_date,
                        "name": name,
                        "amount": amount,
                        "iso_currency_code": "USD",
                        "pending": False,
                        "personal_finance_category": {
                            "primary": category,
                            "detailed": category,
                        },
                    }
                )
    return records
