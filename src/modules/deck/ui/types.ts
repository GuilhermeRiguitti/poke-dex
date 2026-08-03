// Contrato de dados entre o servidor e a UI, pro deck (jogo novo: loadouts).
//
// Espelho ESTREITO das linhas do Prisma: nada daqui pode ser a linha crua. A
// linha de Deck carrega userId; a de DeckSlot carrega deckId — nada disso
// precisa (nem deve) chegar no browser.
//
// O `DeckSlotCardDTO` saiu junto com a tabela: a barra de skills não é mais do
// deck, é escolhida na batalha ao pôr o pokémon em campo.

import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import type { BaseStats } from "@/src/modules/progression/domain/leveling";

/** Uma vaga do time: 1 UserPokemon numa posição. É o que o addToDeck devolve. */
export interface DeckSlotDTO {
  /** id do DeckSlot (é o que o DELETE /api/deck/[id] recebe) */
  id: string;
  userPokemonId: string;
  order: number; // 0..5, posição no time
}

/**
 * Uma vaga do deck com o pokémon JÁ RESOLVIDO — o que a tela precisa pra
 * desenhar a carta, sem consultar a coleção.
 *
 * É o que separa o deck da listagem da coleção: as duas telas mostram a mesma
 * moldura, mas por caminhos independentes. A coleção nem lista quem está aqui
 * (`buildCollectionWhere` exclui no banco), então cruzar as duas listas pra
 * achar o nome/sprite da carta do deck era justamente o acoplamento que fazia
 * a carta sumir da vaga quando caía fora da página/filtro.
 */
export interface DeckBoardSlotDTO {
  /** id do DeckSlot — é o que o DELETE /api/deck/[id] recebe */
  id: string;
  order: number; // 0..5, posição no time (0 começa em campo)
  /** id público da PokéAPI (National Dex) */
  pokemonId: number;
  name: string;
  /** sprite pequeno — é o que a vaga do deck mostra */
  iconUrl: string | null;
  level: number;
  types: string[];
  rarity: RarityTier;
  /** base stats da espécie, crus — a carta deriva pelo nível pra desenhar */
  baseStats: BaseStats;
}

/** O deck como a TELA precisa dele: as vagas com as cartas prontas. */
export interface DeckBoardDTO {
  /** null quando o jogador ainda não tem deck (nasce no primeiro loadout) */
  id: string | null;
  slots: DeckBoardSlotDTO[];
}

/** O deck como a tela da fila precisa dele: só o tamanho, sem os membros. */
export interface DeckSummaryDTO {
  id: string;
  name: string;
  slotCount: number;
}

/** Uma carta possível do learnset — o que o seletor de loadout mostra. */
export interface LearnsetMoveDTO {
  /** Move.id (cuid) — é o que vai em moveIds no POST /api/deck */
  moveId: string;
  name: string;
  type: string;
  power: number | null;
  damageClass: "physical" | "special" | "status";
  /** nível em que a espécie aprende esta carta (dado real da PokéAPI); 0 para as de TM (não são por nível) */
  levelLearnedAt: number;
  /** já destravada pra este pokémon? (level-up pelo nível OU concedida). Travadas aparecem, mas não são selecionáveis. */
  unlocked: boolean;
  /** carta de MÁQUINA (TM): não vem por nível, é ensinada gastando 1 token de TM. */
  teachableViaTm: boolean;
}
