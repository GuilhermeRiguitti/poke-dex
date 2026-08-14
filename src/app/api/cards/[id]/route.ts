import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { removeCard } from "@/src/modules/pokedex";
import { enforceRateLimit } from "@/src/lib/rateLimit";

// DELETE /api/cards/[id] — solta um pokémon (tira da coleção).
// A checagem de dono vai dentro do command, no where do delete.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("removeCard", session.user.id);
  if (limited) return limited;

  const { id } = await params;
  const result = await removeCard(session.user.id, id);

  if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
