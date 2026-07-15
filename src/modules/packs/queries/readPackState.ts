import { prisma } from "@/src/lib/prisma";
import { canOpenFree, nextFreePackAt } from "../domain/cooldown";
import type { PackStateDTO } from "../ui/types";

// Linha do PackState → DTO. A UI nunca vê a linha crua.
export function toPackStateDTO(row: {
  lastFreePackAt: Date | null;
  extraPacks: number;
}): PackStateDTO {
  return {
    canOpen: canOpenFree(row.lastFreePackAt) || row.extraPacks > 0,
    nextFreePackAt: nextFreePackAt(row.lastFreePackAt)?.toISOString() ?? null,
    extraPacks: row.extraPacks,
  };
}

/**
 * O estado de pacotes do jogador, SÓ LEITURA — seguro no render de uma page
 * (CLAUDE.md, regra 2). Não cria a linha: a conta que nunca abriu um pacote não
 * tem PackState ainda, e o default (pode abrir agora, 0 extras) já é o certo. A
 * linha nasce no command openPack, quando o jogador abre o primeiro pacote.
 */
export async function readPackState(userId: string): Promise<PackStateDTO> {
  const row = await prisma.packState.findUnique({
    where: { userId },
    select: { lastFreePackAt: true, extraPacks: true },
  });

  return toPackStateDTO(row ?? { lastFreePackAt: null, extraPacks: 0 });
}
