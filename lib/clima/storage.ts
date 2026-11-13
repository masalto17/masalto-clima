import { parseLedger, type Ledger } from "./accuracy";

const BLOB_PATH = "clima/ledger.json";
const KV_KEY = "clima:ledger";

export type StorageKind = "blob" | "kv" | "none";

export function storageKind(env: NodeJS.ProcessEnv = process.env): StorageKind {
  if (env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) return "kv";
  return "none";
}

async function readBlob(token: string): Promise<string | null> {
  const { head } = await import("@vercel/blob");
  try {
    const meta = await head(BLOB_PATH, { token });
    const response = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Blob HTTP ${response.status}`);
    return response.text();
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "";
    if (name === "BlobNotFoundError" || /not found|404/i.test(message)) return null;
    throw error;
  }
}

async function writeBlob(token: string, body: string): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_PATH, body, {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

async function kvCommand(env: NodeJS.ProcessEnv, command: unknown[]): Promise<unknown> {
  const response = await fetch(env.KV_REST_API_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.KV_REST_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`KV HTTP ${response.status}`);
  const payload = (await response.json()) as { result?: unknown };
  return payload.result;
}

export async function readLedger(now: Date, env: NodeJS.ProcessEnv = process.env): Promise<Ledger> {
  const kind = storageKind(env);
  if (kind === "none") return parseLedger("", now);
  try {
    const raw =
      kind === "blob"
        ? await readBlob(env.BLOB_READ_WRITE_TOKEN!)
        : ((await kvCommand(env, ["GET", KV_KEY])) as string | null);
    if (!raw) return parseLedger("", now);
    return parseLedger(raw, now);
  } catch {
    return parseLedger("", now);
  }
}

export async function writeLedger(ledger: Ledger, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const kind = storageKind(env);
  if (kind === "none") return false;
  const body = JSON.stringify(ledger);
  if (kind === "blob") await writeBlob(env.BLOB_READ_WRITE_TOKEN!, body);
  else await kvCommand(env, ["SET", KV_KEY, body]);
  return true;
}
