import { operatorSession } from "@/lib/clima/operator";
import { parsePreferences } from "@/lib/clima/prefs";
import { mergePlaceList, readPreferences, writePreferences } from "@/lib/clima/prefs-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await operatorSession();
  const { prefs, storage } = await readPreferences();
  if (!session) return Response.json({ signedIn: false, storage });
  return Response.json({ signedIn: true, storage, prefs });
}

export async function PUT(request: Request) {
  const session = await operatorSession();
  if (!session) return Response.json({ stored: false, signedIn: false }, { status: 401 });
  const incoming = parsePreferences(await request.json().catch(() => null));
  const { prefs } = await readPreferences();
  const stored = await writePreferences(mergePlaceList(prefs, incoming));
  return Response.json({ stored, signedIn: true });
}
