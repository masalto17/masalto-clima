"use server";

import { redirect } from "next/navigation";
import { allowedEmails, appUrl } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

export async function ingresar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  // Misma respuesta esté o no habilitado el mail: no revela quién tiene acceso.
  if (allowedEmails().includes(email)) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appUrl()}/auth/callback?next=%2F` },
    });
    if (error) console.error("signInWithOtp:", error.message);
  }

  redirect("/?estado=mail");
}

export async function salir() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/");
}
