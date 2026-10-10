export type Raw = {
  transaction_id: string;
  date: string;
  name: string;
  amount: number;
  iso_currency_code: string | null;
  pending: boolean;
  personal_finance_category?: { primary: string; detailed: string } | null;
};
export type Clean = Raw & {
  source: string;
  kind: "income" | "expense" | "transfer" | "review";
  reason: string;
  confidence: number;
};
export function cleanTransactions(rows: Raw[]): Clean[] {
  const unique = new Map(rows.map((r) => [r.transaction_id, r]));
  return [...unique.values()]
    .filter(
      (r) =>
        Number.isFinite(r.amount) &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
        !Number.isNaN(Date.parse(r.date)),
    )
    .map((r) => {
      const category = r.personal_finance_category?.primary ?? "";
      const name = r.name.toUpperCase();
      let kind: Clean["kind"] = "review",
        reason = "Unrecognized credit; excluded from income until reviewed.",
        confidence = 40;
      if (r.pending) {
        reason = "Pending transaction; excluded until posted.";
        confidence = 0;
      } else if (
        category.startsWith("TRANSFER") ||
        /TRANSFER|REFUND|REVERSAL|CASHBACK/.test(name)
      ) {
        kind = "transfer";
        reason = "Transfer or returned money, not earned income.";
        confidence = 90;
      } else if (r.amount > 0) {
        kind = "expense";
        reason = "Positive Plaid amounts represent money leaving the account.";
        confidence = 95;
      } else if (
        r.amount < 0 &&
        (category === "INCOME" ||
          /PAYROLL|SALARY|FREELANCE|CLIENT PAYMENT/.test(name))
      ) {
        kind = "income";
        reason =
          "Posted credit with an income category or recognizable income description.";
        confidence = category === "INCOME" ? 98 : 85;
      }
      const source =
        name
          .replace(
            /PAYROLL|SALARY|DIRECT DEP(?:OSIT)?|FREELANCE|CLIENT PAYMENT|\*|\d+/g,
            " ",
          )
          .replace(/\s+/g, " ")
          .trim() || r.name;
      return {
        ...r,
        source: source.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        kind,
        reason,
        confidence,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function analyze(
  rows: Clean[],
  currency = "USD",
  today = new Date().toISOString().slice(0, 10),
) {
  const current = today.slice(0, 7);
  const start = new Date(`${current}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 6);
  const months = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + i);
    return {
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      income: 0,
      expenses: 0,
    };
  });
  const eligible = rows.filter(
    (r) => r.iso_currency_code === currency && r.date <= today && !r.pending,
  );
  for (const row of eligible) {
    const m = months.find((m) => m.month === row.date.slice(0, 7));
    if (!m) continue;
    if (row.kind === "income") m.income += Math.round(-row.amount * 100) / 100;
    if (row.kind === "expense") m.expenses += row.amount;
  }
  const observed = months
    .slice(0, -1)
    .filter((m) => eligible.some((r) => r.date.startsWith(m.month)));
  const average = observed.length
    ? observed.reduce((s, m) => s + m.income, 0) / observed.length
    : 0;
  const variance = observed.length
    ? observed.reduce((s, m) => s + (m.income - average) ** 2, 0) /
      observed.length
    : 0;
  const score =
    observed.length >= 3 && average > 0
      ? Math.round(Math.max(0, 100 * (1 - Math.sqrt(variance) / average)))
      : null;
  const sources = [
    ...new Set(
      eligible.filter((r) => r.kind === "income").map((r) => r.source),
    ),
  ]
    .map((source) => {
      const tx = eligible.filter(
        (r) =>
          r.kind === "income" &&
          r.source === source &&
          r.date >= months[0].month + "-01",
      );
      const distinct = new Set(tx.map((r) => r.date.slice(0, 7))).size;
      return {
        source,
        total: tx.reduce((s, r) => s - r.amount, 0),
        count: tx.length,
        recurring: distinct >= 3,
        months: distinct,
      };
    })
    .sort((a, b) => b.total - a.total);
  return {
    months,
    average,
    score,
    sources,
    current: months.at(-1)!,
    completeMonths: observed.length,
    review: rows.filter((r) => r.kind === "review").length,
  };
}
export function demoTransactions(
  today = new Date().toISOString().slice(0, 10),
): Raw[] {
  const out: Raw[] = [];
  const base = new Date(today.slice(0, 7) + "-01T00:00:00Z");
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCMonth(d.getUTCMonth() - i);
    const month = d.toISOString().slice(0, 7);
    const add = (
      day: number,
      name: string,
      amount: number,
      category: string,
    ) => {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      if (date <= today)
        out.push({
          transaction_id: `${month}-${name}-${day}`,
          date,
          name,
          amount,
          iso_currency_code: "USD",
          pending: false,
          personal_finance_category: { primary: category, detailed: category },
        });
    };
    add(1, "PAYROLL ACME STUDIO", -2400, "INCOME");
    add(15, "PAYROLL ACME STUDIO", -2400, "INCOME");
    add(5, "FREELANCE NORTHSTAR", -(650 + i * 45), "INCOME");
    add(2, "RENT GREENWOOD", 1650, "RENT_AND_UTILITIES");
    add(6, "GROCERY MARKET", 245 + i * 12, "FOOD_AND_DRINK");
    add(7, "TRANSFER SAVINGS", -400, "TRANSFER_IN");
    add(8, "UNIDENTIFIED DEPOSIT", -90, "OTHER_INFLOW");
  }
  return out;
}
