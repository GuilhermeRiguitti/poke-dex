import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { readLearnset } from "@/src/modules/deck";

// GET /api/deck/learnset/[userPokemonId] — as cartas que o loadout pode escolher.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ userPokemonId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userPokemonId } = await params;
  const moves = await readLearnset(session.user.id, userPokemonId);
  if (!moves) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ moves });
}
