"use client";
import { useEffect, useMemo, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  Layers3,
  LayoutDashboard,
  ArrowLeftRight,
  Sparkles,
  Link2,
  RefreshCw,
  ChevronRight,
  Download,
  ShieldCheck,
  CircleHelp,
} from "lucide-react";
import {
  analyze,
  cleanTransactions,
  demoTransactions,
  type Raw,
} from "@/lib/pipeline";
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
async function api(action: string, extra: object = {}) {
  const response = await fetch("/api/plaid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
function Connect({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (token: string) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}
export default function Dashboard() {
  const [raw, setRaw] = useState<Raw[]>([]);
  const [view, setView] = useState("Overview");
  const [mode, setMode] = useState<"demo" | "sandbox">("demo");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [filter, setFilter] = useState("all");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setRaw(demoTransactions());
    setReady(true);
  }, []);
  const cleaned = useMemo(() => cleanTransactions(raw), [raw]);
  const report = useMemo(() => analyze(cleaned, currency), [cleaned, currency]);
  const format = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  const filtered = cleaned.filter(
    (r) =>
      (filter === "all" || r.kind === filter) &&
      `${r.source} ${r.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const sync = async () => {
    const data = await api("sync");
    setRaw(data.transactions);
    setMode("sandbox");
    setMessage(
      data.transactions.length
        ? "Sandbox transactions refreshed."
        : "Your Sandbox is connected. Transactions are still being prepared; refresh shortly.",
    );
  };
  function exportData() {
    const blob = new Blob([JSON.stringify(cleaned, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "incomelens-cleaned.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!ready) return <main className="loading">Opening IncomeLens…</main>;
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="/">
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          income<span>lens</span>
          <b>●</b>
        </a>
        <div className="workspace">PERSONAL WORKSPACE</div>
        <nav>
          {[
            { label: "Overview", icon: LayoutDashboard },
            { label: "Transactions", icon: ArrowLeftRight },
            { label: "Data pipeline", icon: Sparkles },
            { label: "Income sources", icon: Layers3 },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setView(label)}
              className={view === label ? "active" : ""}
            >
              <Icon size={18} />
              {label}
              {view === label && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="aside-bottom">
          <div className="sandbox-card">
            <ShieldCheck size={21} />
            <strong>A safe place to explore</strong>
            <p>Built with test data. Your real bank account stays yours.</p>
            <span>PLAID SANDBOX</span>
          </div>
          <div className="profile">
            <div className="avatar">IL</div>
            <div>
              IncomeLens demo<small>Financial clarity, simplified</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header>
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className="header-right">
            <span className="status-dot" />
            {mode === "demo" ? "Sample data" : "Plaid Sandbox"}
            <span className="header-line" />
            <CircleHelp size={18} />
          </div>
        </header>
        <main>
          <div className="title-row">
            <div>
              <div className="eyebrow">YOUR MONEY, UNDERSTOOD</div>
              <h1>
                {view === "Overview"
                  ? "A clearer picture of your income."
                  : view === "Data pipeline"
                    ? "From messy data to meaningful insight."
                    : view === "Income sources"
                      ? "Know where your income comes from."
                      : "Every transaction, explained."}
              </h1>
              <p className="subtitle">
                {view === "Overview"
                  ? "See what’s coming in, spot patterns, and find your financial rhythm."
                  : "Transparent rules. Traceable results. No mystery calculations."}
              </p>
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  const data = await api("link");
                  setToken(data.link_token);
                })
              }
            >
              <Link2 size={16} />
              {busy ? "Working…" : "Connect Sandbox"}
            </button>
          </div>
          <div className="demo-banner">
            <span className="banner-icon">
              <Sparkles size={17} />
            </span>
            <div>
              <strong>
                {mode === "demo"
                  ? "You’re exploring the demo"
                  : "Connected to Plaid Sandbox"}
              </strong>
              <span>
                {mode === "demo"
                  ? "A realistic dataset, with a real data pipeline. Connect a Sandbox to try your own test data."
                  : "Only simulated bank data. Refresh to retrieve the latest posted transactions."}
              </span>
            </div>
            <span className="badge">
              {mode === "demo" ? "DEMO MODE" : "SANDBOX"}
            </span>
          </div>
          {message && (
            <div role="status" className="notice">
              {message}
            </div>
          )}
          <div className="toolbar">
            <div className="section-title">
              {view === "Overview" ? "Income at a glance" : view}
              <span>USD demo · separate currency totals</span>
            </div>
            <div className="toolbar-actions">
              <select
                aria-label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {[
                  ...new Set([
                    "USD",
                    ...raw
                      .map((r) => r.iso_currency_code)
                      .filter((c): c is string => !!c),
                  ]),
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {mode === "sandbox" && (
                <button disabled={busy} onClick={() => action(sync)}>
                  <RefreshCw size={14} />
                  Refresh
                </button>
              )}
              <button onClick={exportData}>
                <Download size={14} />
                Export
              </button>
            </div>
          </div>
          {view === "Overview" && (
            <>
              <div className="stats">
                <Stat
                  label="Income this month"
                  value={format(report.current.income)}
                  note="Month to date · partial month"
                  icon={<ArrowDownRight size={18} />}
                  accent
                />
                <Stat
                  label="Average monthly income"
                  value={format(report.average)}
                  note={`${report.completeMonths} observed completed months`}
                  icon={<Layers3 size={17} />}
                />
                <Stat
                  label="Net cash flow"
                  value={format(
                    report.current.income - report.current.expenses,
                  )}
                  note="Earned income minus expenses · MTD"
                  icon={<ArrowUpRight size={18} />}
                />
                <Stat
                  label="Income stability"
                  value={report.score === null ? "—" : `${report.score}`}
                  note={
                    report.score === null
                      ? "Needs 3 completed months"
                      : "/ 100 · lower variation, higher score"
                  }
                  icon={<ShieldCheck size={18} />}
                />
              </div>
              <div className="chart-grid">
                <section className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Your income over time</h2>
                      <p>A little perspective goes a long way.</p>
                    </div>
                    <span className="chip">Last 6 months + MTD</span>
                  </div>
                  <div className="legend">
                    <i />
                    Income <i className="expense-dot" />
                    Expenses
                  </div>
                  <div className="chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={report.months}
                        margin={{ top: 15, right: 12, bottom: 5, left: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="income"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#4c7967"
                              stopOpacity={0.24}
                            />
                            <stop
                              offset="100%"
                              stopColor="#4c7967"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          vertical={false}
                          stroke="#edf0eb"
                          strokeDasharray="3 4"
                        />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#88918a" }}
                          dy={10}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#88918a" }}
                          tickFormatter={(v) => `${v / 1000}k`}
                          width={40}
                        />
                        <Tooltip
                          formatter={(v) => format(Number(v))}
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #e1e7df",
                          }}
                        />
                        <Area
                          isAnimationActive={false}
                          type="monotone"
                          dataKey="income"
                          name="Income"
                          stroke="#47765f"
                          fill="url(#income)"
                          strokeWidth={3}
                        />
                        <Area
                          isAnimationActive={false}
                          type="monotone"
                          dataKey="expenses"
                          name="Expenses"
                          stroke="#c5b28c"
                          fill="transparent"
                          strokeDasharray="5 5"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-foot">
                    <span className="status-dot" />
                    Current month is in progress. Compare completed months for a
                    fair view.
                  </div>
                </section>
                <section className="insight-panel">
                  <div className="eyebrow">
                    <Sparkles size={15} /> THE BIGGER PICTURE
                  </div>
                  <h2>
                    Consistency is
                    <br />a kind of confidence.
                  </h2>
                  <div className="score-ring">
                    <span>
                      {report.score ?? "—"}
                      <small>stability score</small>
                    </span>
                  </div>
                  <p>
                    {report.score === null
                      ? "We need at least three completed months with activity to estimate income variation."
                      : `Your score measures variation across ${report.completeMonths} completed months. It’s a simple signal, not a prediction.`}
                  </p>
                  <button onClick={() => setView("Data pipeline")}>
                    See how it’s calculated <ArrowUpRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {(view === "Overview" || view === "Income sources") && (
            <section className="panel sources">
              <div className="panel-heading">
                <div>
                  <h2>Where your income comes from</h2>
                  <p>
                    Recognizable sources, grouped from cleaned descriptions.
                  </p>
                </div>
                <span className="chip">7-month window</span>
              </div>
              {report.sources.length === 0 ? (
                <p className="empty">
                  No classified income in this currency yet.
                </p>
              ) : (
                report.sources.map((s, i) => (
                  <div className="source-row" key={s.source}>
                    <div className={`source-icon tone-${i % 3}`}>
                      {s.source.slice(0, 1)}
                    </div>
                    <div className="source-name">
                      <strong>{s.source}</strong>
                      <small>
                        {s.count} payments · {s.months} months observed
                      </small>
                    </div>
                    <div className="source-bar">
                      <span
                        style={{
                          width: `${Math.max(4, (s.total / report.sources[0].total) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={s.recurring ? "recurring" : "chip"}>
                      {s.recurring ? "Recurring pattern" : "Occasional"}
                    </span>
                    <strong>{format(s.total)}</strong>
                  </div>
                ))
              )}
            </section>
          )}
          {view === "Data pipeline" && (
            <>
              <div className="pipeline-steps">
                {[
                  "01  Ingest raw records",
                  "02  Deduplicate & validate",
                  "03  Classify with rules",
                  "04  Aggregate by month",
                ].map((s) => (
                  <div key={s}>{s}</div>
                ))}
              </div>
              <section className="panel explanation">
                <h2>An explainable pipeline</h2>
                <p>
                  Plaid uses negative amounts for incoming money. Posted credits
                  count as income only when the income category or description
                  supports it. Transfers, refunds and pending transactions are
                  excluded. Unknown credits are flagged for review. Confidence
                  values reflect rule strength, not calibrated probabilities.
                </p>
                <p>
                  Stability = max(0, 100 × (1 − standard deviation ÷ mean
                  income)). It uses observed completed months, includes months
                  with activity but zero income, and requires at least three
                  months. Missing months are not assumed to be zero. Recurring
                  means income from the same cleaned source in at least three
                  distinct months; this is a pattern heuristic, not a
                  scheduled-payment prediction.
                </p>
                <p>
                  {report.review} records need review. Amounts are aggregated
                  separately by currency; no exchange-rate conversion is
                  applied.
                </p>
              </section>
            </>
          )}
          {(view === "Transactions" || view === "Data pipeline") && (
            <section className="panel table-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {view === "Data pipeline"
                      ? "Raw → cleaned"
                      : "Transaction explorer"}
                  </h2>
                  <p>
                    {filtered.length} records · pending and unknown credits
                    remain visible
                  </p>
                </div>
                <div className="table-controls">
                  <input
                    aria-label="Search transactions"
                    placeholder="Search descriptions…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    aria-label="Classification"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {["all", "income", "expense", "transfer", "review"].map(
                      (f) => (
                        <option key={f}>{f}</option>
                      ),
                    )}
                  </select>
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date / raw description</th>
                      <th>Cleaned source</th>
                      <th>Classification</th>
                      <th>Amount</th>
                      <th>Why this result?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.transaction_id}>
                        <td>
                          <small>
                            {r.date}
                            {r.pending ? " · pending" : ""}
                          </small>
                          <code>{r.name}</code>
                        </td>
                        <td>{r.source}</td>
                        <td>
                          <span className={`type ${r.kind}`}>{r.kind}</span>
                        </td>
                        <td className="amount">
                          {r.amount < 0 ? "+" : "−"}
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: r.iso_currency_code || "USD",
                          }).format(Math.abs(r.amount))}
                          {!r.iso_currency_code && " (currency unknown)"}
                        </td>
                        <td className="reason">
                          {r.reason}
                          <small>Rule confidence: {r.confidence}%</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <p className="empty">No matching transactions.</p>
              )}
            </section>
          )}
          <footer>
            <span>
              <ShieldCheck size={14} />
              Sandbox data only. Built for learning.
            </span>
            <div>
              <button
                onClick={() => {
                  setRaw(demoTransactions());
                  setMode("demo");
                  setMessage("Showing sample data.");
                }}
              >
                Reset demo
              </button>
              {mode === "sandbox" && (
                <button
                  onClick={() =>
                    action(async () => {
                      await api("disconnect");
                      setRaw(demoTransactions());
                      setMode("demo");
                    })
                  }
                >
                  Disconnect Sandbox
                </button>
              )}
              <span>IncomeLens · Make sense of the details.</span>
            </div>
          </footer>
        </main>
      </div>
      {token && (
        <Connect
          token={token}
          onExit={() => setToken(null)}
          onSuccess={(public_token) => {
            setToken(null);
            action(async () => {
              await api("exchange", { public_token });
              await sync();
            });
          }}
        />
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section className={`stat ${accent ? "stat-accent" : ""}`}>
      <div className="stat-label">
        {label}
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </section>
  );
}
