// Quando uma carta PODE ser oferecida. Regra pura: recebe fatos já apurados,
// devolve o veredito. Quem vai ao banco descobrir os fatos é o command.

export type OfferCheck = "ok" | "in_deck" | "in_battle" | "already_offered";

export interface OfferFacts {
  /** A carta está montada no time do dono. */
  inDeck: boolean;
  /** A carta está numa partida IN_PROGRESS (snapshot congelado nela). */
  inLiveBattle: boolean;
  /** Já existe oferta viva desta carta. */
  alreadyOffered: boolean;
}

/**
 * A ordem dos testes é a ordem em que o jogador consegue AGIR: tirar do deck é
 * um clique, esperar a batalha acabar não é. Reclamar primeiro do que ele
 * resolve na hora dá o caminho mais curto pra oferta funcionar.
 *
 * Por que barrar carta em batalha: `BattlePokemon.userPokemonId` é gravado por
 * VALOR (snapshot congelado, sem FK), então trocar no meio da partida não
 * quebraria nada visível — a partida seguiria com a cópia congelada — mas o XP
 * do fim seria creditado ao NOVO dono, que não jogou nada. Barrar é mais barato
 * que ensinar o `grantXp` a desconfiar do dono.
 *
 * Por que barrar carta no deck: o time é do dono, e transferir por baixo
 * deixaria um `DeckSlot` apontando pra carta de outro jogador. O aceite ainda
 * limpa o slot como rede, mas o certo é o jogador tirar do time sabendo o que
 * está fazendo.
 */
export function canOffer(facts: OfferFacts): OfferCheck {
  if (facts.alreadyOffered) return "already_offered";
  if (facts.inDeck) return "in_deck";
  if (facts.inLiveBattle) return "in_battle";
  return "ok";
}
