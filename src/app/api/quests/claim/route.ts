import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { claimQuestReward, type ClaimQuestRewardInput } from "@/src/modules/quests";
import { enforceRateLimit } from "@/src/lib/rateLimit";

// POST /api/quests/claim — troca uma quest completa por 1 token de tutor.
// Casca fina: sessão → freio → command → HTTP.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("questClaim", session.user.id);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as Partial<ClaimQuestRewardInput>;
  if (!body.questId) {
    return NextResponse.json({ error: "questId é obrigatório" }, { status: 400 });
  }

  const result = await claimQuestReward(session.user.id, { questId: body.questId });

  if (!result.ok) {
    // not_found = 404 (quest que não existe no catálogo). not_complete e
    // already_claimed = 409: o pedido está certo, o ESTADO é que não deixa.
    const status = result.error === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ tutorTokens: result.tutorTokens });
}
