import { NextRequest, NextResponse } from "next/server";
import { fetchPokemon } from "@/lib/pokeapi";

// GET /api/pokeapi/[id] — única porta de entrada da PokéAPI no app.
// Dados de Pokémon (nome, sprite, stats, tipos, moves) nunca são persistidos
// no nosso banco, só cacheados via fetch do Next (ver lib/pokeapi.ts).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pokemon = await fetchPokemon(id);

  if (!pokemon) {
    return NextResponse.json({ error: "Pokémon not found" }, { status: 404 });
  }

  return NextResponse.json(pokemon);
}
