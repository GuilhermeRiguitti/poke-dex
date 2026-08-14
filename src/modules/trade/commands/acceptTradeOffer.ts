import { prisma } from "@/src/lib/prisma";
import { isValidCodeShape, normalizeTradeCode } from "../domain/tradeCode";

// Aceita a oferta de um código e TRANSFERE a instância de UserPokemon.
// ESCREVE — só rota de API.
//
// A transferência é `update` do `userId`, e não delete+create, por dois motivos
// que importam: o `id` da carta sobrevive (então o `TradeLog` consegue apontar
// pra ela) e os `UserPokemonMove` vão junto — o TM que o dono antigo ensinou
// continua na carta, porque a relação é `onDelete: Cascade` sobre um id que não
// morre. Recriar perderia o histórico e os golpes concedidos.

export interface AcceptTradeOfferInput {
  code: string;
}

export type AcceptTradeOfferResult =
  | { ok: true; userPokemonId: string }
  | { ok: false; error: "invalid_code" | "own_offer" };

export async function acceptTradeOffer(
  userId: string,
  input: AcceptTradeOfferInput,
  now: Date = new Date(),
): Promise<AcceptTradeOfferResult> {
  const code = normalizeTradeCode(input.code ?? "");
  // Recusa pela FORMA antes de ir ao banco: economiza a query e, mais
  // importante, não deixa a latência denunciar nada (um código de forma inválida
  // e um inexistente respondem igualmente rápido).
  if (!isValidCodeShape(code)) return { ok: false, error: "invalid_code" };

  // Leitura FORA e ANTES da transação (CLAUDE.md consequência #2: I/O antes do
  // claim, transação curta).
  const offer = await prisma.tradeOffer.findUnique({
    where: { code },
    select: { id: true, fromUserId: true, userPokemonId: true, expiresAt: true },
  });

  // ⚠️ TODO erro de código responde a MESMA coisa: inexistente, vencido, ou já
  // aceito. Diferenciar transformaria a rota num oráculo — "este código existe
  // mas venceu" já é informação que um bote usaria pra mapear o espaço.
  if (!offer) return { ok: false, error: "invalid_code" };
  if (offer.expiresAt.getTime() <= now.getTime()) return { ok: false, error: "invalid_code" };

  // Aceitar a própria oferta não é ataque, é engano — vale a mensagem honesta.
  if (offer.fromUserId === userId) return { ok: false, error: "own_offer" };

  try {
    return await prisma.$transaction(
      async (tx) => {
        // ── CLAIM (1ª operação): quem APAGA a oferta ganhou a troca.
        // Molde do enqueueBattle. O `expiresAt` no where fecha a janela entre a
        // leitura de cima e este delete.
        const claim = await tx.tradeOffer.deleteMany({
          where: { id: offer.id, expiresAt: { gt: now } },
        });
        if (claim.count === 0) return { ok: false as const, error: "invalid_code" as const };

        // 2º claim: a carta ainda é de quem ofereceu? O `userId` do doador vai
        // no PRÓPRIO where — se ele soltou, trocou ou o dono mudou por qualquer
        // caminho, `count` é 0 e a gente derruba a transação inteira. O rollback
        // devolve a oferta apagada acima (mesma manobra do token no applyTM).
        const moved = await tx.userPokemon.updateMany({
          where: { id: offer.userPokemonId, userId: offer.fromUserId },
          data: { userId },
        });
        if (moved.count === 0) throw new TradeConflictError();

        // A carta não pode continuar no time de quem se desfez dela: DeckSlot
        // não conhece `userId`, então o filtro é pelo id da carta — que é exato,
        // porque um slot só pode existir no deck do dono.
        await tx.deckSlot.deleteMany({ where: { userPokemonId: offer.userPokemonId } });

        // Re-checagem DENTRO da transação: entre a criação da oferta e agora, o
        // doador pode ter entrado em partida com essa carta. Se entrou, desfaz
        // tudo — senão o XP do fim da partida cairia em quem não jogou.
        const inLiveBattle = await tx.battlePokemon.findFirst({
          where: {
            userPokemonId: offer.userPokemonId,
            participant: { battle: { status: "IN_PROGRESS" } },
          },
          select: { id: true },
        });
        if (inLiveBattle) throw new TradeConflictError();

        await tx.tradeLog.create({
          data: {
            userPokemonId: offer.userPokemonId,
            fromUserId: offer.fromUserId,
            toUserId: userId,
          },
        });

        return { ok: true as const, userPokemonId: offer.userPokemonId };
      },
      { timeout: 15_000, maxWait: 5_000 },
    );
  } catch (e) {
    // Conflito conhecido: a transação inteira voltou atrás (a oferta continua de
    // pé). Pro jogador é indistinguível de código inválido, de propósito.
    if (e instanceof TradeConflictError) return { ok: false, error: "invalid_code" };
    throw e;
  }
}

/** Sinal interno pra forçar rollback. Não vaza pra fora do módulo. */
class TradeConflictError extends Error {
  constructor() {
    super("trade_conflict");
    this.name = "TradeConflictError";
  }
}
