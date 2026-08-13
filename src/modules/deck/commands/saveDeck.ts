import { prisma } from "@/src/lib/prisma";
import { PLAYABLE_LEARN_METHOD } from "@/src/modules/pokemon";
import { validateDeckSlots, type DeckSlotsIssue } from "../domain/validateDeckSlots";
import { getOrCreateDeck } from "../queries/readDeck";
import { getDeckBoardQuery } from "../queries/getDeckBoard";
import type { DeckBoardDTO } from "../ui/types";

export type SaveDeckResult =
  | { ok: true; board: DeckBoardDTO }
  | { ok: false; error: "invalid_slots"; issue: DeckSlotsIssue }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid_cards"; names: string[] };

/**
 * Grava o TIME INTEIRO de uma vez. Substituiu addToDeck / removeFromDeck /
 * reorderDeck — os três eram um request por gesto.
 *
 * ── Por que virou uma escrita só ───────────────────────────────────────────
 * O jogador monta o time arrastando: põe, tira, troca de vaga, se arrepende.
 * Com um endpoint por gesto, cada arrastar era POST + `router.refresh()`, e a
 * carta só assentava quando o servidor respondia — arrastar tremia. Agora o
 * rascunho é do cliente (domain/deckDraft.ts) e o servidor vê só o resultado.
 *
 * De quebra some a coreografia que existia só por causa do gesto-a-gesto: o
 * `firstFreeOrder` (achar o buraco que uma remoção deixou) e as DUAS PASSADAS do
 * reorderDeck (mandar todo mundo pra `order` negativa antes de gravar a ordem
 * final, senão o @@unique([deckId, order]) recusava no meio). Apagar tudo e
 * inserir de novo não passa por estado intermediário nenhum: quando o
 * `createMany` roda, não há linha velha pra colidir.
 *
 * ── Tudo-ou-nada (CLAUDE.md, regra 5) ──────────────────────────────────────
 * O delete e o insert vão na MESMA `$transaction`. A função pode morrer no meio
 * (timeout, cold start, deploy) e não há worker pra consertar depois — morrer
 * entre os dois deixaria o jogador SEM DECK, sem nada pra reparar.
 *
 * ── Concorrência (regra 6) ─────────────────────────────────────────────────
 * Dois saves ao mesmo tempo (duas abas) não corrompem: cada um manda o time
 * completo, e a transação grava um deles inteiro. O último a entrar vence, que é
 * o que "salvar" quer dizer. Não há gravação parcial possível.
 *
 * ── O que o servidor NÃO confia no cliente ─────────────────────────────────
 * O corpo do PUT vem da rede. Aqui se checa, nesta ordem: a forma do time
 * (quantidade, posições, repetidos — `validateDeckSlots`, a MESMA função que o
 * botão de salvar usa), o DONO de cada pokémon, e se cada um tem ao menos uma
 * skill liberada.
 */
export async function saveDeck(userId: string, input: unknown): Promise<SaveDeckResult> {
  const parsed = validateDeckSlots(input);
  if (!parsed.ok) return { ok: false, error: "invalid_slots", issue: parsed.issue };

  const { slots } = parsed;
  const ids = slots.map((s) => s.userPokemonId);

  if (ids.length > 0) {
    // O pokémon é do jogador? Uma query pro time todo. Id de outro dono responde
    // igual a inexistente — não vira oráculo de "esse id existe".
    const owned = await prisma.userPokemon.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, level: true, pokemonId: true, pokemon: { select: { name: true } } },
    });
    if (owned.length !== ids.length) return { ok: false, error: "not_found" };

    // Um pokémon sem NENHUMA skill liberada entra em campo sem ação possível, e
    // `buildDuelSnapshot` lança — longe daqui, no meio do matchmaking, sem pista
    // do porquê. A trava é a mesma que o addToDeck fazia, agora pro time todo.
    //
    // Duas queries pro time inteiro, não duas por pokémon: só interessa se a
    // união (level-up destravado ∪ concedido — mergePlayableMoveIds) é VAZIA,
    // então basta saber quem tem pelo menos uma de cada lado.
    const [comLevelUp, comConcedida] = await Promise.all([
      prisma.pokemonMove.findMany({
        where: {
          OR: owned.map((p) => ({
            pokemonId: p.pokemonId,
            learnMethod: PLAYABLE_LEARN_METHOD,
            levelLearnedAt: { lte: p.level },
          })),
        },
        select: { pokemonId: true },
        distinct: ["pokemonId"],
      }),
      prisma.userPokemonMove.findMany({
        where: { userPokemonId: { in: ids } },
        select: { userPokemonId: true },
        distinct: ["userPokemonId"],
      }),
    ]);

    const especiesOk = new Set(comLevelUp.map((m) => m.pokemonId));
    const concedidasOk = new Set(comConcedida.map((m) => m.userPokemonId));

    const semSkill = owned.filter((p) => !especiesOk.has(p.pokemonId) && !concedidasOk.has(p.id));
    if (semSkill.length > 0) {
      // Devolve os NOMES: "não deu pra salvar" não diz qual carta tirar do time.
      return { ok: false, error: "invalid_cards", names: semSkill.map((p) => p.pokemon.name) };
    }
  }

  const deck = await getOrCreateDeck(userId);

  await prisma.$transaction(async (tx) => {
    await tx.deckSlot.deleteMany({ where: { deckId: deck.id } });
    if (slots.length > 0) {
      await tx.deckSlot.createMany({
        data: slots.map((s) => ({ deckId: deck.id, userPokemonId: s.userPokemonId, order: s.order })),
      });
    }
  });

  // Devolve o deck gravado pronto pra desenhar: a tela troca o rascunho pelo que
  // o servidor confirmou, sem um `router.refresh()` no meio. A coleção ao lado
  // não precisa recarregar — ela lista TODAS as cartas desde que o deck virou
  // rascunho (ver pokedex/queries/collectionWhere.ts).
  return { ok: true, board: await getDeckBoardQuery(userId) };
}
