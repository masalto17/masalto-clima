import { NextResponse } from "next/server";
import { appUrl, requireEnv } from "@/lib/env";
import { loadOverview } from "@/lib/forecast/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/client";
import { handleUpdate, isValidSecret, type TelegramUpdate } from "@/lib/telegram/handler";
import { LINK_CODE_TTL_MS, generateLinkCode, hashLinkCode } from "@/lib/telegram/link-codes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!isValidSecret(secret, requireEnv("TELEGRAM_WEBHOOK_SECRET"))) {
    return new NextResponse(null, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    await handleUpdate(update, {
      appUrl: appUrl(),
      sendMessage,
      findLinked: async (chatId) => {
        const { data, error } = await supabase
          .from("channels")
          .select("organization_id, profiles(full_name)")
          .eq("kind", "telegram")
          .eq("external_id", chatId)
          .eq("active", true)
          .maybeSingle<{ organization_id: string; profiles: { full_name: string } | null }>();
        if (error) throw error;
        if (!data?.profiles) return null;
        return { name: data.profiles.full_name, organizationId: data.organization_id };
      },
      loadOverview: (organizationId, now) => loadOverview(supabase, now, organizationId),
      createLinkCode: async (chatId, displayName) => {
        const code = generateLinkCode();
        const { error } = await supabase.from("channel_link_codes").insert({
          code_hash: hashLinkCode(code),
          kind: "telegram",
          external_id: chatId,
          display_name: displayName,
          expires_at: new Date(Date.now() + LINK_CODE_TTL_MS).toISOString(),
        });
        if (error) throw error;
        return code;
      },
    });
  } catch (error) {
    console.error("telegram webhook:", error instanceof Error ? error.message : error);
    // 200 igual: si no, Telegram reintenta el mismo update en loop.
  }

  return NextResponse.json({ ok: true });
}
