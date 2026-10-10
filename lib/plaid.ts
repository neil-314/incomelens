import "server-only";
import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import type { Raw } from "./pipeline";
const cookieName = "incomelens_session";
export function configured() {
  return Boolean(
    process.env.PLAID_CLIENT_ID &&
    process.env.PLAID_SECRET &&
    (process.env.SESSION_SECRET?.length ?? 0) >= 32,
  );
}
function key() {
  if (!configured()) throw new Error("CONFIG");
  return createHash("sha256").update(process.env.SESSION_SECRET!).digest();
}
export async function plaid<T>(path: string, body: object): Promise<T> {
  if (!configured()) throw new Error("CONFIG");
  const response = await fetch(`https://sandbox.plaid.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error_code === "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"
        ? "RETRY_SYNC"
        : "PLAID",
    );
  return data;
}
export async function saveSession(access_token: string) {
  const token = await new EncryptJWT({ access_token })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .encrypt(key());
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7200,
  });
}
export async function session() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) throw new Error("SESSION");
  try {
    const { payload } = await jwtDecrypt(token, key());
    return payload.access_token as string;
  } catch {
    throw new Error("SESSION");
  }
}
export async function disconnect() {
  (await cookies()).delete(cookieName);
}
export async function ingest(access_token: string) {
  // Rebuild from the beginning on each refresh: avoids storing a per-user database for this Sandbox demo.
  for (let attempt = 0; attempt < 3; attempt++) {
    let cursor: string | undefined;
    const rows = new Map<string, Raw>();
    try {
      for (let page = 0; page < 100; page++) {
        const data = await plaid<{
          added: Raw[];
          modified: Raw[];
          removed: { transaction_id: string }[];
          next_cursor: string;
          has_more: boolean;
        }>("/transactions/sync", { access_token, cursor, count: 500 });
        for (const r of [...data.added, ...data.modified])
          rows.set(r.transaction_id, r);
        for (const r of data.removed) rows.delete(r.transaction_id);
        cursor = data.next_cursor;
        if (!data.has_more) return [...rows.values()];
      }
      throw new Error("LIMIT");
    } catch (error) {
      if ((error as Error).message !== "RETRY_SYNC" || attempt === 2)
        throw error;
    }
  }
  return [];
}
