// Contrato de dados entre o servidor e a UI de pacotes. Só interface — não pesa
// no bundle. Nada daqui é linha do Prisma nem resposta crua da PokéAPI.

import type { PokemonCardDTO } from "@/src/modules/pokemon/ui/types";
import type { BaseStats } from "@/src/modules/pokemon/domain/leveling";
import type { RarityTier } from "@/src/modules/pokemon/domain/rarity";

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
  /**
   * Base stats da espécie, pras barras da carta. `null` quando a espécie não
   * veio do espelho — mesma razão do `card` acima: erro de leitura não pode
   * fazer o pacote render menos do que deu.
   */
  baseStats: BaseStats | null;
  /**
   * Nível de NASCIMENTO do pokémon que acabou de entrar na coleção. Não é
   * sempre STARTING_LEVEL: forma evoluída nasce no nível em que seria
   * alcançada (birthLevelForSpecies) — o Charizard sai bem acima de 1. É esse
   * nível que a carta mostra e por onde ela deriva os stats.
   */
  level: number;
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
  /** dias de login seguidos (streak) */
  loginStreak: number;
}

export interface OpenPackResultDTO {
  cards: PackCardDTO[];
  packState: PackStateDTO;
}
