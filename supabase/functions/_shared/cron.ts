import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "npm:@supabase/supabase-js@2";

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

/** Las funciones se publican sin JWT: solo entra quien manda el secreto del cron. */
export function isCronRequest(request: Request): boolean {
  const received = Buffer.from(request.headers.get("x-clima-cron-secret") ?? "");
  const expected = Buffer.from(Deno.env.get("CLIMA_CRON_SECRET") ?? "");
  return (
    expected.length > 0 && received.length === expected.length && timingSafeEqual(received, expected)
  );
}

/** Cliente con service_role sobre el esquema `clima`. */
export function createAdminClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    db: { schema: "clima" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return String(error);
}
