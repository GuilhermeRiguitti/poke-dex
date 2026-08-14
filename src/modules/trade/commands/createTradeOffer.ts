import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { expiryFrom, generateTradeCode } from "../domain/tradeCode";
import { canOffer } from "../domain/tradeRules";

// Põe uma carta à disposição e devolve o código que o dono vai passar adiante.
// ESCREVE — só rota de API.
//
// Concorrência (CLAUDE.md regra 6): não existe `findFirst` → `create` aqui, que
// seria corrida. Os DOIS claims são as uniques da tabela:
//   - `code` @unique: colisão de sorteio (astronomicamente improvável, mas
//     possível) vira P2002 e a gente re-sorteia. Sem a unique, dois jogadores
//     ficariam com o MESMO código e o aceite pegaria a oferta errada.
//   - `userPokemonId` @unique: dois cliques no "Oferecer" da mesma carta — o
//     segundo bate na unique e vira `already_offered` em vez de criar duas
//     ofertas vivas da mesma carta (que dariam duas trocas da mesma instância).

export interface CreateTradeOfferInput {
  userPokemonId: string;
}

export type CreateTradeOfferResult =
  | { ok: true; id: string; code: string; expiresAt: Date }
  | { ok: false; error: "not_found" | "in_deck" | "in_battle" | "already_offered" | "code_collision" };

/** Tentativas de re-sorteio antes de desistir. Mesmo espírito do MAX_MATCH_ATTEMPTS. */
const MAX_CODE_ATTEMPTS = 3;

export async function createTradeOffer(
  userId: string,
  input: CreateTradeOfferInput,
  now: Date = new Date(),
  rng: () => number = Math.random,
): Promise<CreateTradeOfferResult> {
  // A carta é do jogador? Id de outro dono responde igual a inexistente — não
  // vira oráculo de "esse id existe" (mesmo princípio do saveDeck/applyTM).
  const card = await prisma.userPokemon.findUnique({
    where: { id: input.userPokemonId },
    select: { id: true, userId: true },
  });
  if (!card || card.userId !== userId) return { ok: false, error: "not_found" };

  const [inDeck, inLiveBattle, existing] = await Promise.all([
    prisma.deckSlot.findFirst({
      where: { userPokemonId: input.userPokemonId },
      select: { id: true },
    }),
    prisma.battlePokemon.findFirst({
      where: {
        userPokemonId: input.userPokemonId,
        participant: { battle: { status: "IN_PROGRESS" } },
      },
      select: { id: true },
    }),
    prisma.tradeOffer.findUnique({
      where: { userPokemonId: input.userPokemonId },
      select: { id: true },
    }),
  ]);

  const check = canOffer({
    inDeck: Boolean(inDeck),
    inLiveBattle: Boolean(inLiveBattle),
    alreadyOffered: Boolean(existing),
  });
  if (check !== "ok") return { ok: false, error: check };

  const expiresAt = expiryFrom(now);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateTradeCode(rng);
    try {
      const offer = await prisma.tradeOffer.create({
        data: { code, fromUserId: userId, userPokemonId: input.userPokemonId, expiresAt },
        select: { id: true, code: true, expiresAt: true },
      });
      return { ok: true, id: offer.id, code: offer.code, expiresAt: offer.expiresAt };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // Qual unique estourou decide o que fazer: `code` re-sorteia, o resto é
        // a corrida de dois cliques na mesma carta e não adianta insistir.
        const target = (e.meta?.target as string[] | string | undefined) ?? "";
        const hitCode = Array.isArray(target) ? target.includes("code") : String(target).includes("code");
        if (hitCode) continue;
        return { ok: false, error: "already_offered" };
      }
      throw e;
    }
  }

  return { ok: false, error: "code_collision" };
}
