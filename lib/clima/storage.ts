import { parseLedger, type Ledger } from "./accuracy";

const STORES = {
  ledger: { blob: "clima/ledger.json", kv: "clima:ledger" },
  preferencias: { blob: "clima/preferencias.json", kv: "clima:preferencias" },
} as const;

export type StoreName = keyof typeof STORES;

export type StorageKind = "blob" | "kv" | "none";

export function storageKind(env: NodeJS.ProcessEnv = process.env): StorageKind {
  if (env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) return "kv";
  return "none";
}

async function readBlob(token: string, path: string): Promise<string | null> {
  const { head } = await import("@vercel/blob");
  try {
    const meta = await head(path, { token });
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

async function writeBlob(token: string, path: string, body: string): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(path, body, {
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
    const stored = await readStored("ledger", env);
    if (!stored) return parseLedger("", now);
    return parseLedger(stored, now);
  } catch {
    return parseLedger("", now);
  }
}

export async function writeLedger(ledger: Ledger, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const kind = storageKind(env);
  if (kind === "none") return false;
  return writeStored("ledger", JSON.stringify(ledger), env);
}

export async function readStored(name: StoreName, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const kind = storageKind(env);
  if (kind === "none") return null;
  const store = STORES[name];
  if (kind === "blob") return readBlob(env.BLOB_READ_WRITE_TOKEN!, store.blob);
  return (await kvCommand(env, ["GET", store.kv])) as string | null;
}

export async function writeStored(name: StoreName, body: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const kind = storageKind(env);
  if (kind === "none") return false;
  const store = STORES[name];
  if (kind === "blob") await writeBlob(env.BLOB_READ_WRITE_TOKEN!, store.blob, body);
  else await kvCommand(env, ["SET", store.kv, body]);
  return true;
}
