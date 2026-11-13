import { loadClimateReport } from "@/lib/clima/load";
import { channelStatus, dispatchAlerts } from "@/lib/clima/notify";
import { parsePreferences } from "@/lib/clima/prefs";
import { readPreferences, writePreferences } from "@/lib/clima/prefs-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const { prefs, storage } = await readPreferences();
  return Response.json({ channels: channelStatus(), storage, prefs });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { prefs?: unknown; test?: boolean } | null;
  if (body?.prefs) await writePreferences(parsePreferences(body.prefs));
  if (!body?.test) return Response.json({ ok: true, channels: channelStatus() });
  try {
    const report = await loadClimateReport();
    const result = await dispatchAlerts(report, { test: true });
    return Response.json({ ok: true, ...result, channels: channelStatus() });
  } catch {
    return Response.json({ ok: false, sent: 0, channels: channelStatus() });
  }
}
