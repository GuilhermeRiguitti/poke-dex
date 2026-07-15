// Contrato de dados entre o servidor e a UI de pacotes. Só interface — não pesa
// no bundle. Nada daqui é linha do Prisma nem resposta crua da PokéAPI.

import type { PokemonCardDTO } from "@/src/modules/pokedex";
import type { RarityTier } from "../domain/rarity";

/** Uma carta sorteada num pacote. */
export interface PackCardDTO {
  pokemonId: number;
  /**
   * O visual da carta. `null` quando a PokéAPI não devolveu o pokémon (cache
   * frio + rede fora): o jogador GANHA a carta mesmo assim — um erro de rede
   * não pode fazer o pacote render menos do que ele deu.
   */
  card: PokemonCardDTO | null;
  bst: number;
  /** faixa só pra apresentação (cor/borda) — não é o peso do sorteio */
  rarity: RarityTier;
  /** false = repetida (o jogador já tinha esse pokémon). Gancho pra troca/pó. */
  isNew: boolean;
}

/** Estado do "cofre" de pacotes do jogador — dirige o botão e o cronômetro. */
export interface PackStateDTO {
  canOpen: boolean;
  /** ISO do próximo pacote grátis; null = pode abrir agora */
  nextFreePackAt: string | null;
  /** pacotes-bônus prontos pra abrir (recompensa de login) */
  extraPacks: number;
}

export interface OpenPackResultDTO {
  cards: PackCardDTO[];
  packState: PackStateDTO;
}
