import { prisma } from "@/src/lib/prisma";
import { startOfUtcDay } from "@/src/lib/utcDay";
import { EGG_BIRTH_LEVEL, EGG_SOURCE, resolveBreedingEitherWay } from "../domain/breeding";
import { progressionFromLevel } from "../domain/leveling";
import { getUnlockedMoveIds } from "../queries/getUnlockedMoveIds";
import { readEggMoveIds } from "../queries/readEggMoveIds";

// Cruza duas cartas do jogador e faz nascer uma terceira. ESCREVE — só rota.
//
// UM POR DIA UTC, e o limite mora numa coluna do PackState (não em tabela nova):
// saldo por jogador é exatamente o que aquela tabela já é, e ela tem `userId`
// como @id justamente pra o claim caber num updateMany condicionado.
//
// Concorrência (CLAUDE.md regra 6): dois cliques no "Cruzar" chegam juntos. O
// claim do dia é a PRIMEIRA operação da transação — quem não casa o `where`
// (porque o outro já carimbou hoje) sai com count 0 e NÃO ESCREVE NADA. Sem
// isso, dois cliques dariam dois filhotes de graça.
//
// O I/O pesado (ler os dois pais, o repertório de um e os egg moves do outro)
// fica FORA e ANTES da transação: transação aberta esperando leitura é transação
// que estoura e segura conexão do pool (consequência #2).

export interface BreedPokemonInput {
  parentAId: string;
  parentBId: string;
}

export type BreedPokemonResult =
  | { ok: true; userPokemonId: string; pokemonId: string; moveId: string }
  | { ok: false; error: "not_found" | "same_card" | "no_egg_move" | "already_bred_today" };

export async function breedPokemon(
  userId: string,
  input: BreedPokemonInput,
  now: Date = new Date(),
): Promise<BreedPokemonResult> {
  if (input.parentAId === input.parentBId) return { ok: false, error: "same_card" };

  // Os dois pais são do jogador? O `userId` vai no PRÓPRIO where, e a contagem
  // tem que BATER — carta de outro dono derruba tudo com `not_found`, sem virar
  // oráculo de "esse id existe" (mesmo padrão do saveDeck).
  const parents = await prisma.userPokemon.findMany({
    where: { id: { in: [input.parentAId, input.parentBId] }, userId },
    select: { id: true, pokemonId: true, level: true },
  });
  if (parents.length !== 2) return { ok: false, error: "not_found" };

  const a = parents.find((p) => p.id === input.parentAId)!;
  const b = parents.find((p) => p.id === input.parentBId)!;

  const [aPlayable, bPlayable, aEgg, bEgg] = await Promise.all([
    getUnlockedMoveIds({ userPokemonId: a.id, pokemonId: a.pokemonId, level: a.level }),
    getUnlockedMoveIds({ userPokemonId: b.id, pokemonId: b.pokemonId, level: b.level }),
    readEggMoveIds(a.pokemonId),
    readEggMoveIds(b.pokemonId),
  ]);

  const match = resolveBreedingEitherWay(
    { userPokemonId: a.id, pokemonId: a.pokemonId, playableMoveIds: [...aPlayable], eggMoveIds: aEgg },
    { userPokemonId: b.id, pokemonId: b.pokemonId, playableMoveIds: [...bPlayable], eggMoveIds: bEgg },
  );
  if (!match) return { ok: false, error: "no_egg_move" };

  const todayStart = startOfUtcDay(now);
  // O filhote nasce em EGG_BIRTH_LEVEL (= 1), e o XP do nível 1 é o mesmo nas
  // seis curvas — então o default aqui é correto, não uma omissão. Se um dia o
  // ovo nascer em nível maior, a curva da espécie do filhote passa a ser
  // obrigatória (senão o par (xp, level) fica incoerente).
  const progress = progressionFromLevel(EGG_BIRTH_LEVEL);

  return prisma.$transaction(
    async (tx) => {
      // ── CLAIM (1ª operação). Molde literal do checkInLogin.
      const claim = await tx.packState.updateMany({
        where: {
          userId,
          OR: [{ lastBreedAt: null }, { lastBreedAt: { lt: todayStart } }],
        },
        data: { lastBreedAt: now },
      });
      if (claim.count === 0) {
        // count 0 = já cruzou hoje, OU perdeu a corrida de dois cliques, OU a
        // linha do PackState nem existe (conta que nunca abriu pacote). Os três
        // dão "hoje não" — e nenhum escreve.
        return { ok: false as const, error: "already_bred_today" as const };
      }

      const filhote = await tx.userPokemon.create({
        data: {
          userId,
          pokemonId: match.childSpeciesId,
          // xp e level SEMPRE juntos, e só pelo helper (CLAUDE.md regra 3.1):
          // gravar um sem o outro cria estado que ninguém repara depois.
          level: progress.level,
          xp: progress.xp,
        },
        select: { id: true },
      });

      await tx.userPokemonMove.create({
        data: { userPokemonId: filhote.id, moveId: match.moveId, source: EGG_SOURCE },
      });

      return {
        ok: true as const,
        userPokemonId: filhote.id,
        pokemonId: match.childSpeciesId,
        moveId: match.moveId,
      };
    },
    { timeout: 15_000, maxWait: 5_000 },
  );
}
