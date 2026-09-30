"use server";

import { redirect } from "next/navigation";
import { allowedEmails } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { hashLinkCode } from "@/lib/telegram/link-codes";

/** Canjea el token que mandó el bot con /web y abre la sesión sin pedir el mail. */
export async function entrarConLink(formData: FormData) {
  const token = String(formData.get("t") ?? "");
  if (!token) redirect("/entrar?error=link");

  const admin = createAdminClient();
  const { data: profileId, error } = await admin.rpc("redeem_web_login", {
    p_token_hash: hashLinkCode(token),
  });
  if (error) throw error;
  if (!profileId) redirect("/entrar?error=link");

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(profileId);
  if (userError) throw userError;
  const email = userData.user.email?.toLowerCase();
  // Mismas reglas que el ingreso por mail: Auth se comparte con Handy.
  if (!email || !userData.user.email_confirmed_at || !allowedEmails().includes(email)) {
    redirect("/entrar?error=acceso");
  }

  // Link mágico generado del lado del servidor (no manda mail) y canjeado acá mismo.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const session = await createSessionClient();
  const { error: verifyError } = await session.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) {
    console.error("entrar verifyOtp:", verifyError.message);
    redirect("/entrar?error=link");
  }

  redirect("/");
}
