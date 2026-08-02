// Filtros da coleção. PURO: sem Prisma, sem fetch, sem React.
//
// Tudo aqui existe pra uma coisa: transformar a query string (entrada de
// usuário, pode ser qualquer lixo) num objeto TIPADO que a query e a UI possam
// usar sem checar de novo. NADA LANÇA — isto roda no render de uma page, e um
// throw viraria tela de erro no lugar da coleção (mesma razão do clampPage).

import { TYPE_COLORS } from "@/src/lib/typeColors";
import type { RarityTier } from "@/src/modules/packs/domain/rarity";

/** Cartas por página. 16 = 4 fileiras de 4 no grid mais largo. */
export const COLLECTION_PAGE_SIZE = 16;

/** Teto da busca. Trunca (não rejeita): paste acidental não pode zerar a tela. */
const MAX_QUERY_LENGTH = 50;

/** Os 18 tipos elementais, na ordem do seletor. Fonte: as chaves de typeColors. */
export const POKEMON_TYPES: readonly string[] = Object.keys(TYPE_COLORS);

/** As faixas de raridade, da mais comum pra mais rara. */
export const RARITY_TIERS: readonly RarityTier[] = ["common", "uncommon", "rare", "legendary"];

export type CollectionSort = "captured" | "level_desc" | "level_asc";

const SORTS: readonly CollectionSort[] = ["captured", "level_desc", "level_asc"];

export interface CollectionFilters {
  /** busca por nome, já trimada e truncada; null quando vazia */
  q: string | null;
  /** tipo elemental válido; null quando ausente ou desconhecido */
  type: string | null;
  /** faixa de raridade válida; null quando ausente ou desconhecida */
  rarity: RarityTier | null;
  sort: CollectionSort;
  /** sempre >= 1. O teto depende do total, que só a query sabe. */
  page: number;
}

const DEFAULTS: CollectionFilters = {
  q: null,
  type: null,
  rarity: null,
  sort: "captured",
  page: 1,
};

// Next entrega array quando a chave repete na URL (?q=a&q=b). Sem isto o
// ".trim()"/"parseInt" abaixo estouram num array e viram tela de erro — o
// oposto da promessa "nada lança". Repetição resolve pro PRIMEIRO valor.
const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export function parseCollectionFilters(
  raw: Record<string, string | string[] | undefined>
): CollectionFilters {
  const rawQ = first(raw.q);
  const rawType = first(raw.type);
  const rawRarity = first(raw.rarity);
  const rawSort = first(raw.sort);
  const rawPage = first(raw.page);

  const q = (rawQ ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const page = parsePage(rawPage);

  return {
    q: q.length > 0 ? q : null,
    type: POKEMON_TYPES.includes(rawType ?? "") ? rawType! : null,
    rarity: RARITY_TIERS.includes(rawRarity as RarityTier) ? (rawRarity as RarityTier) : null,
    sort: SORTS.includes(rawSort as CollectionSort) ? (rawSort as CollectionSort) : "captured",
    page,
  };
}

// Só piso: o teto depende do total de linhas, que a page só descobre depois da
// query. Página além do fim volta vazia e a tela mostra o estado de "nada
// encontrado" — mais barato que uma segunda consulta só pra recortar.
function parsePage(raw: string | undefined): number {
  const parsed = parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

/** Há filtro estreitando a lista? Página e ordenação NÃO contam. */
export function hasActiveFilter(f: CollectionFilters): boolean {
  return f.q !== null || f.type !== null || f.rarity !== null;
}

/**
 * O href da coleção com `patch` aplicado por cima dos filtros atuais.
 *
 * Trocar QUALQUER filtro volta pra página 1 — sem isso o jogador que estava na
 * página 5 e filtra "lendário" cai numa página que não existe mais e vê a tela
 * vazia. Trocar só a página, claro, preserva a página.
 *
 * Parâmetro no default é OMITIDO: a URL fica limpa e compartilhável.
 */
export function collectionHref(
  f: CollectionFilters,
  patch: Partial<CollectionFilters>
): string {
  const mexeuEmFiltro = "q" in patch || "type" in patch || "rarity" in patch;
  const next: CollectionFilters = {
    ...f,
    ...patch,
    page: "page" in patch ? patch.page! : mexeuEmFiltro ? 1 : f.page,
  };

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.type) params.set("type", next.type);
  if (next.rarity) params.set("rarity", next.rarity);
  if (next.sort !== DEFAULTS.sort) params.set("sort", next.sort);
  if (next.page !== DEFAULTS.page) params.set("page", String(next.page));

  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
} 
