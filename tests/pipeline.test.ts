import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTransactions, analyze, type Raw } from "../lib/pipeline";
const raw = (overrides: Partial<Raw> = {}): Raw => ({
  transaction_id: "one",
  date: "2026-08-01",
  name: "PAYROLL ACME",
  amount: -1000,
  pending: false,
  iso_currency_code: "USD",
  ...overrides,
});
test("Plaid sign, pending, transfers, refunds and unknown deposits", () => {
  const rows = cleanTransactions([
    raw(),
    raw({ transaction_id: "pending", pending: true }),
    raw({ transaction_id: "transfer", name: "TRANSFER FROM SAVINGS" }),
    raw({ transaction_id: "refund", name: "SHOP REFUND" }),
    raw({ transaction_id: "unknown", name: "ATM CREDIT" }),
    raw({ transaction_id: "expense", amount: 30, name: "COFFEE" }),
  ]);
  assert.equal(rows.find((r) => r.transaction_id === "one")?.kind, "income");
  assert.equal(
    rows.find((r) => r.transaction_id === "pending")?.kind,
    "review",
  );
  assert.equal(
    rows.find((r) => r.transaction_id === "transfer")?.kind,
    "transfer",
  );
  assert.equal(
    rows.find((r) => r.transaction_id === "refund")?.kind,
    "transfer",
  );
  assert.equal(
    rows.find((r) => r.transaction_id === "unknown")?.kind,
    "review",
  );
  assert.equal(
    rows.find((r) => r.transaction_id === "expense")?.kind,
    "expense",
  );
});
test("Deduplicates by ID, keeps updated version, drops invalid values", () => {
  const rows = cleanTransactions([
    raw(),
    raw({ amount: -1200 }),
    raw({ transaction_id: "bad", amount: NaN }),
    raw({ transaction_id: "date", date: "bad" }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, -1200);
});
test("Stable income scores 100; excludes partial months, future dates and other currencies", () => {
  const rows = cleanTransactions(
    ["06", "07", "08", "09"]
      .map((m) => raw({ transaction_id: m, date: `2026-${m}-01` }))
      .concat([
        raw({ transaction_id: "cad", amount: -9000, iso_currency_code: "CAD" }),
        raw({ transaction_id: "future", date: "2026-09-30", amount: -9000 }),
      ]),
  );
  const result = analyze(rows, "USD", "2026-09-10");
  assert.equal(result.score, 100);
  assert.equal(result.average, 1000);
  assert.equal(result.current.income, 1000);
  assert.equal(result.sources[0].recurring, true);
});
test("Expense-only observed months reduce stability; missing history does not invent a score", () => {
  assert.equal(analyze([], "USD", "2026-09-10").score, null);
  const rows = cleanTransactions([
    raw({ date: "2026-06-01" }),
    raw({ transaction_id: "b", date: "2026-07-01" }),
    raw({
      transaction_id: "c",
      date: "2026-08-01",
      amount: 100,
      name: "COFFEE",
    }),
  ]);
  assert.equal(analyze(rows, "USD", "2026-09-10").score, 29);
});
