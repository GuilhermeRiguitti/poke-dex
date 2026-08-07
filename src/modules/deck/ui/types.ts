// Contrato de dados entre o servidor e a UI, pro deck (jogo novo: loadouts).
//
// Espelho ESTREITO das linhas do Prisma: nada daqui pode ser a linha crua. A
// linha de Deck carrega userId; a de DeckSlot carrega deckId — nada disso
// precisa (nem deve) chegar no browser.
//
// O `DeckSlotCardDTO` saiu junto com a tabela: a barra de skills não é mais do
// deck, é escolhida na batalha ao pôr o pokémon em campo.
//
// O `DeckSlotDTO` (id do DeckSlot + order) saiu quando montar o time virou
// rascunho de cliente: não há mais endpoint que receba o id de UM slot, e as
// linhas são apagadas e reinseridas a cada save — um id que muda a cada
// gravação não serve nem de chave de lista. Quem identifica a carta é o
// `userPokemonId`.

import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import type { BaseStats } from "@/src/modules/progression/domain/leveling";

/**
 * Uma carta como a VAGA do deck precisa dela — tudo que a linha desenha, sem
 * consultar a coleção.
 *
 * É o contrato COMPARTILHADO entre as duas origens de uma vaga: o deck gravado
 * (`getDeckBoardQuery`) e a carta que o jogador acabou de arrastar da coleção.
 * Com o rascunho no cliente, soltar a carta na vaga 3 tem que desenhá-la ali na
 * hora, sem ida ao servidor — então a coleção precisa entregar exatamente estes
 * campos. Um tipo só é o que garante que as duas vagas ficam idênticas.
 */
export interface DeckCardDTO {
  /** id do UserPokemon — a identidade da carta em todo o rascunho */
  userPokemonId: string;
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

/** Uma carta do deck GRAVADO, com a posição que o banco guardou. */
export interface DeckBoardSlotDTO extends DeckCardDTO {
  /** posição no time, 0..DECK_LIMIT-1 (a 0 começa em campo) */
  order: number;
}

/**
 * O deck como a TELA precisa dele: as vagas com as cartas prontas.
 *
 * `slots` traz SÓ as ocupadas, cada uma com o `order` dela — o deck é posicional
 * e pode ter buraco (carta na vaga 0 e na 4, o meio vazio). Quem espalha isso
 * nas DECK_LIMIT posições é o `draftFrom` (domain/deckDraft.ts).
 */
export interface DeckBoardDTO {
  /** null quando o jogador ainda não tem deck (nasce no primeiro save) */
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
  /** Move.id (cuid) */
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
