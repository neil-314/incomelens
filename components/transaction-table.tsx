"use client";
import { useState } from "react";
import type { Clean } from "@/lib/pipeline";

export function TransactionTable({
  rows,
  explain = false,
}: {
  rows: Clean[];
  explain?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const filtered = rows.filter(
    (row) =>
      (kind === "all" || row.kind === kind) &&
      `${row.name} ${row.source}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div>
      <div className="filters">
        <input
          aria-label="Search transactions"
          placeholder="Search transactions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Classification"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {["all", "income", "expense", "transfer", "review"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <span className="muted">{filtered.length} records</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>{explain ? "Original description" : "Description"}</th>
              {explain && <th>Cleaned source</th>}
              <th>Type</th>
              <th className="number">Amount</th>
              {explain && <th>Rule</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.transaction_id}>
                <td className="date">
                  {row.date}
                  {row.pending && <small>Pending</small>}
                </td>
                <td>{explain ? <code>{row.name}</code> : row.source}</td>
                {explain && <td>{row.source}</td>}
                <td>
                  <span className={`type ${row.kind}`}>{row.kind}</span>
                </td>
                <td className="number">
                  {row.amount < 0 ? "+" : "−"}
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: row.iso_currency_code || "USD",
                  }).format(Math.abs(row.amount))}
                  {!row.iso_currency_code && <small>Currency unknown</small>}
                </td>
                {explain && <td className="rule">{row.reason}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <p className="empty">No matching transactions.</p>}
    </div>
  );
}
