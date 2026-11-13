import { parsePreferences } from "@/lib/clima/prefs";
import { readPreferences, writePreferences } from "@/lib/clima/prefs-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await readPreferences();
  return Response.json(result);
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const prefs = parsePreferences(body);
  const stored = await writePreferences(prefs);
  return Response.json({ stored, prefs });
}
