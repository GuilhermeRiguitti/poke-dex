import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { checkTutorTeachable, TUTOR_SOURCE } from "../domain/tutor";

// Ensina um golpe de TUTOR a um Pokémon do jogador, gastando 1 token de tutor.
// ESCREVE — só rota de API. É o gasto que a quest diária alimenta.
//
// Mesmo desenho do applyTM, com a moeda e o método trocados. A atomicidade é
// dupla e vive na $transaction (CLAUDE.md regra 6):
//  1) o token é um CLAIM otimista — `updateMany` condicionado a
//     `tutorTokens >= 1`. Quem lê 0 (sem saldo, ou perdeu a corrida pro outro
//     clique) sai com count 0 e NÃO escreve.
//  2) o @@unique([userPokemonId, moveId]) fecha o resto: se dois cliques do
//     MESMO golpe passam o claim, o segundo `create` viola a unique e a
//     transação inteira faz rollback — inclusive o decremento, então o token do
//     perdedor VOLTA. Traduzimos isso em `already_known`.

export interface ApplyTutorInput {
  userPokemonId: string;
  moveId: string;
}

export type ApplyTutorResult =
  | { ok: true; moveId: string; tutorTokens: number }
  | { ok: false; error: "not_found" | "not_tutor_move" | "already_known" | "no_tokens" };

export async function applyTutor(
  userId: string,
  input: ApplyTutorInput,
): Promise<ApplyTutorResult> {
  // O Pokémon é do jogador? Id de outro dono responde igual a inexistente.
  const up = await prisma.userPokemon.findUnique({
    where: { id: input.userPokemonId },
    select: { id: true, userId: true, pokemonId: true },
  });
  if (!up || up.userId !== userId) return { ok: false, error: "not_found" };

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

  const check = checkTutorTeachable(link?.learnMethod ?? null, Boolean(already));
  if (check !== "ok") return { ok: false, error: check };

  try {
    return await prisma.$transaction(async (tx) => {
      const claim = await tx.packState.updateMany({
        where: { userId, tutorTokens: { gte: 1 } },
        data: { tutorTokens: { decrement: 1 } },
      });
      if (claim.count === 0) return { ok: false as const, error: "no_tokens" as const };

      await tx.userPokemonMove.create({
        data: { userPokemonId: input.userPokemonId, moveId: input.moveId, source: TUTOR_SOURCE },
      });

      const state = await tx.packState.findUniqueOrThrow({
        where: { userId },
        select: { tutorTokens: true },
      });
      return { ok: true as const, moveId: input.moveId, tutorTokens: state.tutorTokens };
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
