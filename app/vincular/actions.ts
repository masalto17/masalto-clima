"use server";

import { redirect } from "next/navigation";
import { allowedEmails, appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { hashLinkCode } from "@/lib/telegram/link-codes";

function vincularUrl(codigo: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ codigo, ...params });
  return `/vincular?${query.toString()}`;
}

export async function enviarLinkDeIngreso(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  // Misma respuesta esté o no habilitado el mail: no revela quién tiene acceso.
  if (allowedEmails().includes(email)) {
    const supabase = await createSessionClient();
    const next = encodeURIComponent(vincularUrl(codigo));
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appUrl()}/auth/callback?next=${next}` },
    });
    if (error) console.error("signInWithOtp:", error.message);
  }

  redirect(vincularUrl(codigo, { estado: "mail" }));
}

export async function vincularChat(formData: FormData) {
  const codigo = String(formData.get("codigo") ?? "");

  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  const email = user?.email?.toLowerCase();
  // Auth se comparte con Handy (incluye sesiones anónimas): exigir mail confirmado y habilitado.
  if (!user || !email || !user.email_confirmed_at || !allowedEmails().includes(email)) {
    redirect(vincularUrl(codigo, { error: "acceso" }));
  }

  const admin = createAdminClient();
  const codeHash = hashLinkCode(codigo);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

  if (!profile) {
    // Primer ingreso de un mail habilitado: perfil en la organización inicial.
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id")
      .order("created_at")
      .limit(1)
      .single();
    if (orgError) throw orgError;

    const { data: pending } = await admin
      .from("channel_link_codes")
      .select("display_name")
      .eq("code_hash", codeHash)
      .maybeSingle();

    const { error: insertError } = await admin.from("profiles").insert({
      id: user.id,
      organization_id: org.id,
      full_name: pending?.display_name ?? email.split("@")[0],
    });
    if (insertError) throw insertError;
  }

  const { data: result, error } = await admin.rpc("redeem_link_code", {
    p_code_hash: codeHash,
    p_profile_id: user.id,
  });
  if (error) throw error;

  if (result !== "ok") redirect(vincularUrl(codigo, { error: "codigo" }));
  redirect("/vincular?estado=ok");
}
