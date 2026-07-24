import { prisma } from "@/src/lib/prisma";

/**
 * Quantos tokens de TM o jogador tem. Só leitura — seguro no render / na rota do
 * learnset (que devolve o saldo junto das cartas, pra a UI liberar o botão
 * "Ensinar (1 TM)"). Conta que nunca abriu pacote não tem PackState ainda → 0.
 */
export async function readTmTokens(userId: string): Promise<number> {
  const row = await prisma.packState.findUnique({
    where: { userId },
    select: { tmTokens: true },
  });
  return row?.tmTokens ?? 0;
}
