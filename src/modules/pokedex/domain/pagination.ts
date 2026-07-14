// Paginação da PokéDex. Pura: sem Prisma, sem fetch, sem React.
// Isto morava solto dentro de app/(game)/page.tsx.

export const PAGE_SIZE = 20;

/** Gen 1-9 "reais"; acima de 1025 a PokéAPI lista formas alternativas. */
export const MAX_POKEMON = 1025;

export const TOTAL_PAGES = Math.ceil(MAX_POKEMON / PAGE_SIZE);

/**
 * Normaliza o `?page=` da URL, que é entrada do usuário e pode ser qualquer
 * coisa: vazio, "abc", "-3", "999999", "2.5". Sempre devolve uma página válida
 * dentro de [1, TOTAL_PAGES] — nunca lança, porque isto roda no render da page
 * e um throw aqui viraria tela de erro em vez de uma listagem.
 */
export function clampPage(raw: string | undefined): number {
  const parsed = parseInt(raw ?? "1", 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), TOTAL_PAGES);
}

/**
 * O intervalo de uma página no índice da PokéAPI.
 *
 * O `limit` é recortado no MAX_POKEMON de propósito: a última página não tem
 * 20 itens (1025 = 51 páginas de 20 + 5), e sem o recorte ela pediria 20 e
 * traria 15 formas alternativas ("deoxys-attack", "wormadam-sandy") que não
 * são pokémon da dex.
 */
export function pageRange(page: number): { offset: number; limit: number } {
  const offset = (page - 1) * PAGE_SIZE;
  return { offset, limit: Math.min(PAGE_SIZE, MAX_POKEMON - offset) };
}
