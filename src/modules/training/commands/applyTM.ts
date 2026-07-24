import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { checkTmTeachable, TM_SOURCE } from "../domain/tm";

// Ensina um golpe de MÁQUINA (TM) a um Pokémon do jogador, gastando 1 token.
// ESCREVE — só rota de API. É o gasto que o token do check-in (packs) alimenta.
//
// Concorrência (CLAUDE.md regra 6): dois cliques no "Ensinar" chegam juntos. A
// atomicidade é dupla e vive na $transaction:
//  1) o token é um CLAIM otimista — `updateMany` condicionado a `tmTokens >= 1`.
//     Quem lê 0 (sem saldo, ou perdeu a corrida pro outro clique) sai com
//     count 0 e NÃO escreve.
//  2) o @@unique([userPokemonId, moveId]) do grant fecha o resto: se dois
//     cliques do MESMO golpe passam o claim, o segundo `create` viola a unique
//     e a transação inteira faz rollback — inclusive o decremento, então o
//     token do perdedor VOLTA. Traduzimos essa violação em `already_known`.

export interface ApplyTmInput {
  userPokemonId: string;
  moveId: string;
}

export type ApplyTmResult =
  | { ok: true; moveId: string; tmTokens: number }
  | { ok: false; error: "not_found" | "not_machine_move" | "already_known" | "no_tokens" };

export async function applyTM(userId: string, input: ApplyTmInput): Promise<ApplyTmResult> {
  // O Pokémon é do jogador? (id de outro dono responde igual a inexistente —
  // não vira oráculo de "esse id existe", como addToDeck.)
  const up = await prisma.userPokemon.findUnique({
    where: { id: input.userPokemonId },
    select: { id: true, userId: true, pokemonId: true },
  });
  if (!up || up.userId !== userId) return { ok: false, error: "not_found" };

  // A espécie aprende esse golpe? Por qual método? (só `machine` é ensinável por TM.)
  const [link, already] = await Promise.all([
    prisma.pokemonMove.findUnique({
      where: { pokemonId_moveId: { pokemonId: up.pokemonId, moveId: input.moveId } },
      select: { learnMethod: true },
    }),
    prisma.userPokemonMove.findUnique({
      where: { userPokemonId_moveId: { userPokemonId: input.userPokemonId, moveId: input.moveId } },
      select: { id: true },
    }),
  ]);

  const check = checkTmTeachable(link?.learnMethod ?? null, Boolean(already));
  if (check !== "ok") return { ok: false, error: check };

  try {
    return await prisma.$transaction(async (tx) => {
      // Claim do token: só desconta se há saldo. count 0 = sem token / perdeu a corrida.
      const claim = await tx.packState.updateMany({
        where: { userId, tmTokens: { gte: 1 } },
        data: { tmTokens: { decrement: 1 } },
      });
      if (claim.count === 0) return { ok: false as const, error: "no_tokens" as const };

      await tx.userPokemonMove.create({
        data: { userPokemonId: input.userPokemonId, moveId: input.moveId, source: TM_SOURCE },
      });

      const state = await tx.packState.findUniqueOrThrow({
        where: { userId },
        select: { tmTokens: true },
      });
      return { ok: true as const, moveId: input.moveId, tmTokens: state.tmTokens };
    });
  } catch (e) {
    // Corrida do MESMO golpe: o segundo create viola a unique → rollback total
    // (o token volta). É "já conhece", não um erro.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "already_known" };
    }
    throw e;
  }
}
