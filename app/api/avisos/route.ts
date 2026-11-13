import { loadClimateReport } from "@/lib/clima/load";
import { channelStatus, dispatchAlerts } from "@/lib/clima/notify";
import { operatorSession } from "@/lib/clima/operator";
import { parsePreferences } from "@/lib/clima/prefs";
import { mergeChannels, readPreferences, writePreferences } from "@/lib/clima/prefs-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const session = await operatorSession();
  const { prefs, storage } = await readPreferences();
  return Response.json({
    signedIn: Boolean(session),
    channels: channelStatus(),
    storage,
    prefs: session ? prefs : null,
  });
}

export async function POST(request: Request) {
  const session = await operatorSession();
  if (!session) return Response.json({ ok: false, signedIn: false }, { status: 401 });
  const body = await request.json().catch(() => null) as { prefs?: unknown; test?: boolean } | null;
  if (body?.prefs) {
    const { prefs } = await readPreferences();
    await writePreferences(mergeChannels(prefs, parsePreferences(body.prefs)));
  }
  if (!body?.test) return Response.json({ ok: true, signedIn: true, channels: channelStatus() });
  try {
    const report = await loadClimateReport();
    const result = await dispatchAlerts(report, { test: true });
    return Response.json({ ok: true, signedIn: true, ...result, channels: channelStatus() });
  } catch {
    return Response.json({ ok: false, signedIn: true, sent: 0, channels: channelStatus() }, { status: 200 });
  }
}
