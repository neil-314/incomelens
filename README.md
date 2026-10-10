# IncomeLens

An explainable financial-data pipeline with a Next.js dashboard. Explore a realistic demo immediately, then connect simulated bank data through Plaid Sandbox.

![IncomeLens dashboard](docs/dashboard.png)

## Run it locally

Install Node.js 22 or newer, then open a terminal in this folder:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. No accounts or secrets are required for demo mode.

## What it does

- Monthly income and expense chart, month-to-date income and net cash flow.
- Completed-month average and a transparent income-stability score.
- Grouped income sources and recurring-pattern detection.
- Searchable transaction explorer and raw-to-cleaned explanations.
- JSON export; separate currency totals without pretending to convert currencies.
- Plaid Link, server-side token exchange, transaction synchronization and disconnect.
- Responsive desktop and mobile layouts.

## How to explain it to a friend

The UI is `app/page.tsx`. It takes transactions and renders charts with Recharts. `lib/pipeline.ts` is pure TypeScript: it removes duplicates, checks basic validity, classifies records using explicit rules, and computes summaries. `lib/plaid.ts` calls Plaid on the server. `app/api/plaid/route.ts` exposes the small set of actions the UI needs.

A Plaid credit has a **negative** amount. Income requires a posted credit plus an income category or recognizable income description. Transfers, refunds and pending transactions do not count as earned income. Unknown credits remain in a review queue. Confidence percentages are fixed rule-strength labels, not machine-learning probabilities. This is a rule-based application, not an AI classifier.

The chart covers six previous months and the current partial month. Stability uses only observed completed months within that window and needs at least three. It is `max(0, 100 * (1 - standard deviation / mean))`. An observed expense-only month has zero income; a month with no records is treated as missing history. This can overestimate stability if a source supplies incomplete coverage. Recurring means the same cleaned source appears in three distinct months; it does not predict payday. Source-name normalization can merge unrelated descriptions or split one employer across names.

Net cash flow here means **classified income minus expenses**, not every bank credit minus every debit. Transfers and unrecognized credits are excluded. The current month is partial, so month-over-month percentage changes are deliberately omitted.

## Add Plaid Sandbox later

1. Create a developer account at https://dashboard.plaid.com/signup and open its Keys page.
2. Copy `.env.example` to `.env.local` locally. Fill in `PLAID_CLIENT_ID` and the **Sandbox** `PLAID_SECRET` there, never in chat or GitHub.
3. Set `SESSION_SECRET` to a random string of at least 32 characters. For example, generate locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and copy it directly into the environment file. Do not share the output.
4. Restart the development server. Click **Connect Sandbox**. Choose a non-OAuth test bank such as First Platypus Bank and use Plaid’s sample credentials `user_good` / `pass_good`.
5. If the initial transaction response is empty, wait briefly and press **Refresh**. Plaid initializes transaction data asynchronously.

This app hardcodes `https://sandbox.plaid.com`; it cannot connect to production banks. Sandbox credentials are required for a real integration check. The demo is clearly labeled and does not silently substitute sample data after connection.

## Security and storage choices

Secrets are server-only environment variables and ignored by Git. Access tokens are stored in an encrypted, HttpOnly, SameSite=Strict cookie with a two-hour expiry and Secure in production. They are never returned in a JSON response or stored in browser localStorage. POST requests validate their Origin. Errors are sanitized; tokens and credentials are not logged.

This intentionally small Sandbox app has no user accounts or persistent database. A sync rebuilds transactions from the initial cursor, applies additions/modifications/removals, and restarts on pagination mutation. Pages and retries are bounded. Browser transaction state clears on reload; the encrypted connection can be resumed by connecting again or invoking refresh in a retained page. Disconnect removes the Plaid Item and clears the cookie. Reset demo only changes the display; it does not revoke a connection.

Before adapting this to real financial data, add authentication, encrypted database storage, per-user rate limits, signed webhook verification, durable cursors, account selection, consent/deletion flows, and operational monitoring. Do not enable real banking by merely changing the endpoint.

## Verify

```sh
npm test
npm run typecheck
npm run build
# Start npm run dev in another terminal first:
npx playwright install chromium
npx playwright test tests/browser.spec.ts --workers=1
```

Unit tests cover amount signs, pending items, transfers/refunds, unknown credits, duplicate IDs, invalid values, currency isolation, future dates, incomplete history, and stability. Browser tests cover navigation, filters, search, export, missing configuration and mobile overflow. GitHub Actions runs unit tests and the production build.

## Deploy on Vercel

1. Sign up at https://vercel.com/signup using the GitHub account containing this repository.
2. Click **Add New → Project**, import `incomelens`, keep the detected Next.js defaults, and click **Deploy**. Demo mode needs no environment variables.
3. To enable Sandbox, open the project’s **Settings → Environment Variables** and add the three variables from `.env.example`. Redeploy after adding them. Never prefix them with `NEXT_PUBLIC_`.
4. Future GitHub pushes are deployed automatically after the project is linked.

An anonymous temporary Vercel preview, if provided, is not a permanent production URL. Claim it through Vercel or import this repository for a durable deployment.

## Stack

Next.js App Router · TypeScript · Tailwind CSS 4 · Recharts · react-plaid-link · jose · Node test runner · Playwright.

References: https://plaid.com/docs/quickstart/ · https://plaid.com/docs/api/transactions/#transactionssync · https://nextjs.org/docs/app · https://vercel.com/docs/frameworks/full-stack/nextjs

## Verification limits

Live Plaid Sandbox exchange and ingestion require the developer credentials described above. Tests and demo data do not establish a working live bank integration. There are no webhooks, database or production bank connections in this version.
