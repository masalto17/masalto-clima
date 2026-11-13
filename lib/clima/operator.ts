import "server-only";
import { allowedEmails } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

/** Sesión de un usuario habilitado. Sin esto no se leen ni se pisan los destinos. */
export async function operatorSession(): Promise<{ email: string } | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const supabase = await createSessionClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.toLowerCase();
    if (!email) return null;
    const allowed = allowedEmails();
    if (allowed.length > 0 && !allowed.includes(email)) return null;
    return { email };
  } catch {
    return null;
  }
}
