// BST e raridade — fatos da ESPÉCIE. PUROS: sem Prisma, sem fetch, sem React.
//
// A "fortitude" de um pokémon é o BST (base stat total) — a soma dos 6 base
// stats. Foi escolhido entre os candidatos porque é o único monotônico com
// poder real: base_experience premia Blissey (608) acima de Arceus (324), e
// capture_rate dá 255 pra Eternatus (lendário) igual a um Caterpie. BST vai de
// ~180 (Sunkern) a 720 (Arceus) sem inversões, e é o MESMO número que a engine
// de batalha usa pra calcular dano — raridade = poder de verdade em partida.
//
// Mora no `pokemon` e não no `packs` porque BST e raridade são da espécie, não
// do sorteio: quem consome é a carta (moldura), o filtro da coleção e o espelho.
// O SORTEIO (peso por raridade, drawPack) é do packs — ver packs/domain/draw.ts.
//
// ─── FRONTEIRA (leia antes de usar `bstOf`) ────────────────────────────────
//
// A partir da migration `pokemon_bst_rarity`, o BST e a raridade também vivem
// no banco, como coluna de `Pokemon`. Os dois coexistem, e cada um tem seu
// lugar:
//
//   • `bstOf(apiId)` / BST_BY_ID  — é do SORTEIO. `drawPack` pondera as 1025
//     espécies da dex, e a maioria NÃO tem linha em `Pokemon`; não há coluna
//     pra ler. Não use em nada que já tenha a linha na mão.
//
//   • `pokemon.bst` / `pokemon.rarity` — é de quem TEM a linha (coleção, deck,
//     carta). Ler a coluna é o que garante que a raridade desenhada na carta é
//     a MESMA que o filtro do banco usou pra achar ela.
//
// `rarityTier(bst)` continua sendo a única definição dos cortes — só que agora
// roda na IMPORTAÇÃO (syncPokedex), não na leitura.

import { BST_BY_ID } from "./rarity.generated";

/** BST de um pokémon pelo id público da PokéAPI. 0 se fora da dex conhecida. */
export function bstOf(pokemonId: number): number {
  return BST_BY_ID[pokemonId - 1] ?? 0;
}

/** Quantas espécies a tabela gerada conhece — o pool default do sorteio. */
export const DEX_SIZE = BST_BY_ID.length;

export type RarityTier = "common" | "uncommon" | "rare" | "legendary";

/**
 * Faixa de raridade só pra APRESENTAÇÃO (cor/borda da carta). Não entra no
 * sorteio — o sorteio usa o peso contínuo (packs/domain/draw.ts). Os cortes
 * seguem os degraus naturais do BST: fracos < 350, medianos < 480, fortes <
 * 580, o topo (pseudo-lendários e lendários) daí pra cima.
 */
export function rarityTier(bst: number): RarityTier {
  if (bst < 350) return "common";
  if (bst < 480) return "uncommon";
  if (bst < 580) return "rare";
  return "legendary";
}
