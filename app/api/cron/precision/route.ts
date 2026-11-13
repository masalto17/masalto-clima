import { timingSafeEqual } from "crypto";
import { runPrecisionCron } from "@/lib/clima/load";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, message: "Falta un CRON_SECRET válido." }, { status: 401 });
  }
  try {
    const result = await runPrecisionCron(new Date());
    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json(
      { ok: false, stored: false, message: "No se pudo actualizar el registro de aciertos." },
      { status: 200 },
    );
  }
}
