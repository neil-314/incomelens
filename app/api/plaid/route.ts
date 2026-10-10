import { NextRequest, NextResponse } from "next/server";
import {
  configured,
  plaid,
  saveSession,
  session,
  ingest,
  disconnect,
} from "@/lib/plaid";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json(
    { configured: configured() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: NextRequest) {
  if (
    !req.headers.get("origin") ||
    new URL(req.headers.get("origin")!).host !== req.headers.get("host")
  )
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const body = await req.json();
    let result: object;
    switch (body.action) {
      case "link":
        result = await plaid("/link/token/create", {
          client_name: "IncomeLens",
          language: "en",
          country_codes: ["US"],
          user: { client_user_id: crypto.randomUUID() },
          products: ["transactions"],
          transactions: { days_requested: 210 },
        });
        break;
      case "exchange":
        if (
          typeof body.public_token !== "string" ||
          body.public_token.length > 1000
        )
          return NextResponse.json(
            { error: "Invalid token." },
            { status: 400 },
          );
        const exchanged = await plaid<{ access_token: string }>(
          "/item/public_token/exchange",
          { public_token: body.public_token },
        );
        await saveSession(exchanged.access_token);
        result = { connected: true };
        break;
      case "sync":
        result = { transactions: await ingest(await session()) };
        break;
      case "disconnect": {
        try {
          await plaid("/item/remove", { access_token: await session() });
        } finally {
          await disconnect();
        }
        result = { connected: false };
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const code = (error as Error).message;
    return NextResponse.json(
      {
        error:
          code === "CONFIG"
            ? "Plaid Sandbox needs server environment variables. Demo mode is ready."
            : code === "SESSION"
              ? "Connection expired. Connect your Sandbox again."
              : "Sandbox request failed. Please retry shortly.",
      },
      { status: code === "CONFIG" ? 503 : code === "SESSION" ? 401 : 502 },
    );
  }
}
