import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { cancelTradeOffer } from "@/src/modules/trade";

// DELETE /api/trade/offer/[id] — retira a oferta de circulação.
// A checagem de dono vai DENTRO do command, no where do delete (padrão
// anti-IDOR do repo): oferta de outro jogador responde 404, igual a inexistente.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await cancelTradeOffer(session.user.id, id);

  if (!result.ok) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
