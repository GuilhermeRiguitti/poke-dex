import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { applyTutor, type ApplyTutorInput } from "@/src/modules/pokemon";
import { enforceRateLimit } from "@/src/lib/rateLimit";

// POST /api/training/tutor — ensina um golpe de TUTOR gastando 1 token de tutor.
// Irmã do /api/training/tm; fica sob /training pelo mesmo motivo (a AÇÃO é
// treinar, mesmo com o command morando no módulo pokemon).
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("teachTm", session.user.id);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as Partial<ApplyTutorInput>;
  if (!body.userPokemonId || !body.moveId) {
    return NextResponse.json({ error: "userPokemonId e moveId são obrigatórios" }, { status: 400 });
  }

  const result = await applyTutor(session.user.id, {
    userPokemonId: body.userPokemonId,
    moveId: body.moveId,
  });

  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "no_tokens" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ moveId: result.moveId, tutorTokens: result.tutorTokens });
}
