import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { addCard } from "@/src/modules/pokedex";

// POST /api/cards — captura um pokémon (põe na coleção).
//
// O GET que existia aqui foi removido: o único consumidor era o useEffect da
// página da coleção, que agora lê no servidor (pokedex/queries/getCollection).
//
// A rota é casca: valida a sessão, chama o command, traduz o resultado em HTTP.
// Nenhuma regra de negócio mora aqui — nem a validação do id na PokéAPI, nem o
// upsert, nem o aquecimento do cache. Tudo isso é o command.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pokemonId } = (await req.json()) as { pokemonId?: number };
  if (typeof pokemonId !== "number") {
    return NextResponse.json({ error: "pokemonId is required" }, { status: 400 });
  }

  const result = await addCard(session.user.id, pokemonId);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "invalid_id" ? 400 : 404 }
    );
  }

  return NextResponse.json(
    { userCardId: result.userCardId, pokemonId: result.pokemonId },
    { status: 201 }
  );
}
