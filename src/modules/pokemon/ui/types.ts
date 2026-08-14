// Contrato de dados entre o servidor e a UI, pro pokémon em si (a ESPÉCIE).
//
// Nada daqui é linha do Prisma nem resposta crua da PokéAPI. O `NormalizedPokemon`
// da lib carrega o movepool INTEIRO (o Rattata tem ~130 moves, cada um com nome
// e url) — mandar isso como prop pra 20 cards de uma página da dex seria
// centenas de KB de RSC payload por navegação, pra desenhar um sprite e dois
// badges. O DTO do card tem 5 campos de propósito.
//
// Quem monta é queries/toPokemonDTO.ts, campo a campo. Como são `interface`,
// não pesam no bundle.

/** Um pokémon como um CARD precisa dele. Nada além do que a moldura desenha. */
export interface PokemonCardDTO {
  id: number;
  name: string;
  /** artwork oficial (grande) — é o que o card mostra */
  artworkUrl: string | null;
  /** sprite pequeno — é o que a vaga do deck mostra */
  iconUrl: string | null;
  types: string[];
}

export interface PokemonStatDTO {
  name: string;
  value: number;
}

/** O pokémon como a página de DETALHE precisa dele (aí sim, com os moves). */
export interface PokemonDetailDTO {
  id: number;
  name: string;
  artworkUrl: string | null;
  types: string[];
  /** decímetros e hectogramas, como a PokéAPI devolve — a UI converte */
  height: number;
  weight: number;
  stats: PokemonStatDTO[];
  /** só os que a tela mostra (não os ~130 do movepool) */
  moves: string[];
  totalMoves: number;
}

// ─── golpes de UM pokémon do jogador ───────────────────────────────────────

/**
 * Uma carta possível do learnset — o que o repertório e o seletor de loadout da
 * batalha mostram. Montado por queries/readLearnset.ts.
 */
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
  /**
   * COMO esta carta chega ao pokémon. `teachableViaTm` continua existindo porque
   * é o que a UI usa pra decidir o botão "Ensinar (1 TM)"; `source` é mais
   * amplo e diz o que a etiqueta da carta mostra.
   *
   * `egg` e `tutor` só aparecem CONCEDIDOS (`unlocked: true`) — ao contrário da
   * TM, não há botão pra ganhá-los aqui: ovo vem do cruzamento e tutor de
   * quest. Listar os não-concedidos seria mostrar uma porta sem maçaneta.
   */
  source: "level-up" | "machine" | "egg" | "tutor";
}

/** Resposta do POST /api/training/tm quando dá certo. */
export interface TeachTmResponseDTO {
  /** Move.id ensinado — a UI marca essa carta como desbloqueada. */
  moveId: string;
  /** saldo de tokens de TM depois do gasto. */
  tmTokens: number;
}
