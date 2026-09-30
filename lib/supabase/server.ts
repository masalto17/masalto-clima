import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";
import { DB_SCHEMA } from "@/lib/supabase/admin";

/** Cliente con la sesión del usuario (cookies): respeta RLS. */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      db: { schema: DB_SCHEMA },
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component: no se pueden escribir cookies.
          }
        },
      },
    },
  );
}
