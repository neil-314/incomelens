"use client";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  analyze,
  cleanTransactions,
  demoTransactions,
  type Raw,
} from "@/lib/pipeline";
import { IncomeChart } from "@/components/income-chart";
import { TransactionTable } from "@/components/transaction-table";

type Tab = "Overview" | "Transactions" | "Data pipeline";

// All private Plaid operations run through our server route.
async function request(action: string, values: object = {}) {
  const response = await fetch("/api/plaid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...values }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

function BankLink({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}

export default function Home() {
  const [transactions, setTransactions] = useState<Raw[]>([]);
  const [tab, setTab] = useState<Tab>("Overview");
  const [currency, setCurrency] = useState("USD");
  const [connected, setConnected] = useState(false);
  const [showingSandbox, setShowingSandbox] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTransactions(demoTransactions());
    setLoaded(true);
  }, []);
  const cleaned = cleanTransactions(transactions);
  const report = analyze(cleaned, currency);
  const currencies = [
    ...new Set([
      "USD",
      ...transactions.flatMap((t) =>
        t.iso_currency_code ? [t.iso_currency_code] : [],
      ),
    ]),
  ];
  const money = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const data = await request("sync");
    setTransactions(data.transactions);
    setShowingSandbox(true);
    setMessage(
      data.transactions.length
        ? "Transactions updated."
        : "Plaid is preparing the transactions. Try Refresh in a moment.",
    );
  }
  function exportTransactions() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(cleaned, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "incomelens-cleaned.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!loaded) return <main className="container">Loading transactions…</main>;
  return (
    <div className="container">
      <header>
        <div>
          <h1>IncomeLens</h1>
          <p>Income and cash flow from bank transactions.</p>
        </div>
        <div className="actions">
          {connected ? (
            <>
              <button disabled={busy} onClick={() => run(refresh)}>
                Refresh
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await request("disconnect");
                    setConnected(false);
                    setShowingSandbox(false);
                    setTransactions(demoTransactions());
                  })
                }
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const data = await request("link");
                  setLinkToken(data.link_token);
                })
              }
            >
              {busy ? "Connecting…" : "Connect Sandbox"}
            </button>
          )}
        </div>
      </header>
      <div className="data-note">
        <span>
          <strong>{showingSandbox ? "Plaid Sandbox" : "Sample data"}</strong> ·{" "}
          {showingSandbox
            ? "Simulated bank records. No real bank connected."
            : "Generated locally. Connect Plaid Sandbox to use test-bank records."}
        </span>
        {showingSandbox && (
          <button
            onClick={() => {
              setTransactions(demoTransactions());
              setShowingSandbox(false);
            }}
          >
            Show sample data
          </button>
        )}
      </div>
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
      <nav aria-label="Views">
        {(["Overview", "Transactions", "Data pipeline"] as Tab[]).map(
          (name) => (
            <button
              key={name}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ),
        )}
      </nav>
      <div className="section-heading">
        <h2>{tab}</h2>
        <div className="actions">
          <label>
            Currency{" "}
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button onClick={exportTransactions}>Export JSON</button>
        </div>
      </div>

      {tab === "Overview" && (
        <>
          <dl className="totals">
            <div>
              <dt>Income this month</dt>
              <dd>{money(report.current.income)}</dd>
              <small>Month to date</small>
            </div>
            <div>
              <dt>Monthly average</dt>
              <dd>{money(report.average)}</dd>
              <small>
                {report.completeMonths} completed months with records
              </small>
            </div>
            <div>
              <dt>Net cash flow</dt>
              <dd>{money(report.current.income - report.current.expenses)}</dd>
              <small>Income − expenses this month</small>
            </div>
            <div>
              <dt>Income stability</dt>
              <dd>
                {report.score === null ? (
                  "—"
                ) : (
                  <>
                    {report.score}
                    <span>/100</span>
                  </>
                )}
              </dd>
              <small>
                {report.score === null
                  ? "Needs 3 completed months"
                  : "Based on monthly income variation"}
              </small>
            </div>
          </dl>
          <section className="chart-section">
            <h3>Monthly income and expenses</h3>
            <p className="muted">
              Six previous months and the current partial month.
            </p>
            <IncomeChart months={report.months} currency={currency} />
          </section>
          <section>
            <h3>Income sources</h3>
            <p className="muted">
              Grouped by cleaned description over the displayed period.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Payments</th>
                    <th>Pattern</th>
                    <th className="number">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sources.map((source) => (
                    <tr key={source.source}>
                      <td>{source.source}</td>
                      <td>{source.count}</td>
                      <td>
                        {source.recurring
                          ? `Recurring · ${source.months} months`
                          : "Occasional"}
                      </td>
                      <td className="number">{money(source.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!report.sources.length && <p>No income found in this currency.</p>}
          </section>
        </>
      )}
      {tab === "Transactions" && <TransactionTable rows={cleaned} />}
      {tab === "Data pipeline" && (
        <>
          <section className="rules">
            <h3>How the data is processed</h3>
            <ol>
              <li>
                <strong>Ingest:</strong> request transactions from Plaid
                Sandbox, or load the sample dataset.
              </li>
              <li>
                <strong>Clean:</strong> remove duplicate IDs and invalid
                records; normalize source names.
              </li>
              <li>
                <strong>Classify:</strong> a posted credit counts as income when
                its category or description indicates income. Exclude transfers,
                refunds and pending payments. Flag unknown credits for review.
              </li>
              <li>
                <strong>Summarize:</strong> group income by month, source and
                currency.
              </li>
            </ol>
            <p>
              Plaid uses negative amounts for incoming money. The table shows
              the original description next to our cleaned result and the rule
              used.
            </p>
            <details>
              <summary>Stability and recurring income rules</summary>
              <p>
                Stability = max(0, 100 × (1 − standard deviation ÷ average
                income)). We use completed months with records and require at
                least three. Months with records but no income count as zero;
                missing history is excluded. This is a descriptive score, not a
                prediction.
              </p>
              <p>
                A source is marked recurring when it appears in at least three
                distinct months. Source grouping uses simple text rules and can
                make mistakes.
              </p>
            </details>
          </section>
          <h3>Raw → cleaned records</h3>
          <TransactionTable rows={cleaned} explain />
        </>
      )}
      <footer>
        <span>
          Sandbox project · {cleaned.length} records · {report.review} flagged
          for review
        </span>
        <span>Totals are separate by currency.</span>
      </footer>
      {linkToken && (
        <BankLink
          token={linkToken}
          onExit={() => setLinkToken(null)}
          onSuccess={(publicToken) => {
            setLinkToken(null);
            run(async () => {
              await request("exchange", { public_token: publicToken });
              setConnected(true);
              await refresh();
            });
          }}
        />
      )}
    </div>
  );
}
