import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export const DB_SCHEMA = "clima";

/** Cliente con service_role: solo en el servidor, saltea RLS. */
export function createAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      db: { schema: DB_SCHEMA },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
