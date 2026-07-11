const POKEAPI_BASE = "https://pokeapi.co/api/v2";

/** Extrai o id numérico de uma URL de recurso da PokéAPI, ex: ".../pokemon/25/" → 25 */
export function extractIdFromUrl(url: string): number {
  return parseInt(url.split("/").filter(Boolean).pop()!, 10);
}

// Dados de uma geração já lançada não mudam — cache "longo" é seguro.
const REVALIDATE_SECONDS = 60 * 60 * 24;

export interface NormalizedPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  baseExperience: number | null;
  sprites: {
    front_default: string | null;
    back_default: string | null;
    artwork: string | null;
  };
  stats: { base_stat: number; effort: number; stat: { name: string } }[];
  types: { slot: number; type: { name: string } }[];
  moves: { move: { name: string; url: string } }[];
}

export async function fetchPokemon(idOrName: number | string): Promise<NormalizedPokemon | null> {
  const res = await fetch(`${POKEAPI_BASE}/pokemon/${idOrName}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;

  const data = await res.json();

  return {
    id: data.id,
    name: data.name,
    height: data.height,
    weight: data.weight,
    baseExperience: data.base_experience ?? null,
    sprites: {
      front_default: data.sprites?.front_default ?? null,
      back_default: data.sprites?.back_default ?? null,
      artwork: data.sprites?.other?.["official-artwork"]?.front_default ?? null,
    },
    stats: (data.stats ?? []).map((s: { base_stat: number; effort: number; stat: { name: string } }) => ({
      base_stat: s.base_stat,
      effort: s.effort,
      stat: { name: s.stat.name },
    })),
    types: (data.types ?? []).map((t: { slot: number; type: { name: string } }) => ({
      slot: t.slot,
      type: { name: t.type.name },
    })),
    moves: (data.moves ?? []).map((m: { move: { name: string; url: string } }) => ({
      move: { name: m.move.name, url: m.move.url },
    })),
  };
}
