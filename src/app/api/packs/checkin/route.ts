import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { checkInLogin } from "@/src/modules/packs";

// POST /api/packs/checkin — marca a presença diária (streak de login).
//
// Disparado pelo <DailyCheckIn> no layout de (game), uma vez por carga. A regra
// (contar dias seguidos, conceder bônus a cada 7) e a idempotência por dia moram
// no command; a rota é casca: sessão + command + JSON.
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await checkInLogin(session.user.id);
  return NextResponse.json(result);
}
