import { prisma } from "@/src/lib/prisma";
import type { BattleMoveDef } from "../domain/types";

const DAMAGE_CLASSES = new Set(["physical", "special", "status"]);

/**
 * Traduz os `Move.id` que o jogador escolheu na barra de skills pro formato do
 * motor (`BattleMoveDef`), lendo o espelho local.
 *
 * Existe porque o motor é PURO: ele recebe poder/tipo/PP resolvidos, não ids. E
 * roda **fora e antes** da transação de resolução — transação aberta esperando
 * I/O é transação que estoura e segura conexão do pool (CLAUDE.md regra 5).
 *
 * A ORDEM devolvida é a que o jogador escolheu, não a do banco: o índice na
 * barra é o que o `cardSlot` da jogada aponta, então trocar a ordem trocaria o
 * golpe usado. Id que não existe no espelho é descartado em silêncio — quem
 * valida se a carta pode ser montada é o submitAction, no momento da escolha.
 */
export async function loadMoveDefs(moveIds: string[]): Promise<BattleMoveDef[]> {
  if (moveIds.length === 0) return [];

  const rows = await prisma.move.findMany({
    where: { id: { in: moveIds } },
    select: {
      id: true,
      moveApiId: true,
      name: true,
      type: true,
      power: true,
      accuracy: true,
      damageClass: true,
      priority: true,
      pp: true,
    },
  });

  const porId = new Map(rows.map((r) => [r.id, r]));

  return moveIds
    .map((id) => porId.get(id))
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      id: r.moveApiId,
      name: r.name,
      type: r.type,
      power: r.power,
      accuracy: r.accuracy,
      damageClass: DAMAGE_CLASSES.has(r.damageClass)
        ? (r.damageClass as BattleMoveDef["damageClass"])
        : "physical",
      priority: r.priority,
      maxPp: r.pp,
      currentPp: r.pp,
    }));
}
