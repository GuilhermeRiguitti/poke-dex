import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/modules/auth/auth";
import { readLearnset } from "@/src/modules/deck";
import { readTmTokens } from "@/src/modules/packs";

// GET /api/training/skills/[userPokemonId] — o repertório COMPLETO de um pokémon
// do jogador: o que ele já sabe, o que ainda vai aprender por nível, e o que dá
// pra ensinar por TM — mais o saldo de tokens.
//
// Mora em `training` e não em `deck` porque ensinar é treino, não montagem de
// time: desde que a barra de skills passou a ser escolhida na batalha, o deck
// não tem mais nada a ver com golpe. (A rota antiga era
// `/api/deck/learnset/[id]`, e saiu junto com o LoadoutBuilder.)
//
// Só LÊ (regra 2). `readLearnset` devolve null pro pokémon de outro dono, que é
// o que faz o 404 aqui não virar oráculo de "esse id existe".
export async function GET(_req: NextRequest, { params }: { params: Promise<{ userPokemonId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userPokemonId } = await params;
  const moves = await readLearnset(session.user.id, userPokemonId);
  if (!moves) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tmTokens = await readTmTokens(session.user.id);
  return NextResponse.json({ moves, tmTokens });
}
