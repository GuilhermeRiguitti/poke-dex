const POKEAPI_BASE = "https://pokeapi.co/api/v2";

/** Extrai o id numérico de uma URL de recurso da PokéAPI, ex: ".../pokemon/25/" → 25 */
export function extractIdFromUrl(url: string): number {
  return parseInt(url.split("/").filter(Boolean).pop()!, 10);
}

// A fair use policy da PokéAPI (https://pokeapi.co/docs/v2) pede, em primeiro
// lugar: "Locally cache resources whenever you request them." Não há rate limit
// aplicado desde que migraram pra hospedagem estática, mas eles pedem
// explicitamente pra limitar a frequência de requests pra segurar o custo de
// hospedagem deles. Cachear não é otimização aqui — é a contrapartida de usar
// uma API pública e gratuita.
//
// São duas camadas, de propósito:
//  - esta (cache de fetch do Next): read-through, por deploy. Cobre a listagem
//    da PokéDex, onde não dá pra pré-aquecer nada — o usuário navega 1025
//    pokémon que ele justamente NÃO tem.
//  - pokeapiCache.ts (tabela PokeApiCache): persiste entre deploys, e é ela que
//    atende o que o usuário JÁ capturou. Ver o comentário lá.
//
// force-cache explícito, e sem revalidate: dado de uma geração já lançada é
// imutável, então revalidar é re-buscar 1025 recursos pra receber byte a byte a
// mesma coisa. O explícito também importa porque, nesta versão do Next, fetch
// NÃO é cacheado por padrão, e um fetch descoberto DEPOIS de uma Request-time
// API (o `await headers()` do auth, que toda page nossa faz) fica de fora do
// cache a menos que opte por ele — era esse o caso aqui.
const CACHE_FOREVER = { cache: "force-cache" } as const;

/**
 * Como a espécie aprende um move, EM UM version group (= um par de jogos).
 * É o dado que torna o learnset fiel à série: o mesmo move é aprendido em
 * níveis diferentes conforme o jogo, e por métodos diferentes (subir de nível,
 * TM, ovo, tutor). Quem escolhe qual entrada vale é pokedex/domain/learnset.ts.
 */
export interface MoveLearnDetail {
  /** nível em que o move é aprendido. 0 quando o método não é level-up. */
  levelLearnedAt: number;
  /** "level-up" | "machine" | "egg" | "tutor" | ... (a API tem outros raros) */
  learnMethod: string;
  /** ex: "scarlet-violet", "red-blue" */
  versionGroup: string;
}

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
  moves: { move: { name: string; url: string }; learnDetails: MoveLearnDetail[] }[];
}

export interface NormalizedMove {
  id: number;
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  damageClass: "physical" | "special" | "status";
}

export interface NormalizedType {
  id: number;
  name: string;
  /** multiplicadores de dano deste tipo atacando os tipos listados */
  doubleDamageTo: string[];
  halfDamageTo: string[];
  noDamageTo: string[];
}

/** Uma entrada do índice da PokéAPI: só nome + url (o id sai da url). */
export interface PokemonIndexEntry {
  name: string;
  url: string;
}

/** GET /pokemon?offset&limit — o índice paginado, sem os detalhes de cada um. */
export async function fetchPokemonIndex(offset: number, limit: number): Promise<PokemonIndexEntry[]> {
  const res = await fetch(`${POKEAPI_BASE}/pokemon?offset=${offset}&limit=${limit}`, CACHE_FOREVER);
  if (!res.ok) return [];

  const data = await res.json();
  return data.results ?? [];
}

export async function fetchPokemon(idOrName: number | string): Promise<NormalizedPokemon | null> {
  const res = await fetch(`${POKEAPI_BASE}/pokemon/${idOrName}`, CACHE_FOREVER);
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
    moves: (data.moves ?? []).map(
      (m: {
        move: { name: string; url: string };
        version_group_details?: {
          level_learned_at: number;
          move_learn_method: { name: string };
          version_group: { name: string };
        }[];
      }) => ({
        move: { name: m.move.name, url: m.move.url },
        learnDetails: (m.version_group_details ?? []).map((d) => ({
          levelLearnedAt: d.level_learned_at ?? 0,
          learnMethod: d.move_learn_method?.name ?? "unknown",
          versionGroup: d.version_group?.name ?? "unknown",
        })),
      })
    ),
  };
}

export async function fetchMove(idOrName: number | string): Promise<NormalizedMove | null> {
  const res = await fetch(`${POKEAPI_BASE}/move/${idOrName}`, CACHE_FOREVER);
  if (!res.ok) return null;

  const data = await res.json();
  const damageClass = data.damage_class?.name;

  return {
    id: data.id,
    name: data.name,
    type: data.type?.name ?? "normal",
    power: data.power ?? null,
    accuracy: data.accuracy ?? null,
    pp: data.pp ?? 10,
    priority: data.priority ?? 0,
    damageClass: damageClass === "physical" || damageClass === "special" ? damageClass : "status",
  };
}

export async function fetchType(idOrName: number | string): Promise<NormalizedType | null> {
  const res = await fetch(`${POKEAPI_BASE}/type/${idOrName}`, CACHE_FOREVER);
  if (!res.ok) return null;

  const data = await res.json();
  const relations = data.damage_relations ?? {};
  const names = (list: { name: string }[] | undefined) => (list ?? []).map((t) => t.name);

  return {
    id: data.id,
    name: data.name,
    doubleDamageTo: names(relations.double_damage_to),
    halfDamageTo: names(relations.half_damage_to),
    noDamageTo: names(relations.no_damage_to),
  };
}
