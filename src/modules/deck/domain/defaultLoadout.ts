// Qual barra de cartas o servidor monta quando o jogador NÃO escolhe.
// Pura: sem Prisma, sem fetch, sem React.

import { CARDS_PER_SLOT } from "./rules";

/** O mínimo que a escolha precisa saber de cada carta candidata. */
export interface LoadoutCandidate {
  moveId: string;
  /** null = golpe de status (não causa dano) */
  power: number | null;
  levelLearnedAt: number;
}

/**
 * As até CARDS_PER_SLOT cartas que um pokémon leva quando ninguém escolheu.
 *
 * Existe porque arrastar da coleção pro deck é UM gesto: não há modal no meio
 * pra perguntar as skills. Recebe só o que já está DESBLOQUEADO (quem filtra é
 * quem chama, com a regra do servidor) e ordena:
 *
 * 1. **poder, do maior pro menor** — é o que faz o pokémon jogar sozinho. Não é
 *    "as primeiras aprendidas": as primeiras são tackle e growl, e o deck
 *    montado por arrasto sairia inútil.
 * 2. nível de aprendizado, do maior pro menor — desempata a favor do que veio
 *    depois na evolução do bicho.
 * 3. `moveId` — desempate final, só pra a escolha ser SEMPRE a mesma. Sem ele,
 *    duas chamadas iguais poderiam montar barras diferentes conforme a ordem
 *    que o banco devolveu, e o teste não teria como travar nada.
 *
 * Golpe de status (`power: null`) vai pro fim, mas ENTRA se sobrar vaga — um
 * pokémon com menos de 6 golpes de dano não pode ficar com a barra pela metade.
 */
export function defaultLoadout(unlocked: LoadoutCandidate[]): string[] {
  return [...unlocked]
    .sort(
      (a, b) =>
        (b.power ?? -1) - (a.power ?? -1) ||
        b.levelLearnedAt - a.levelLearnedAt ||
        a.moveId.localeCompare(b.moveId)
    )
    .slice(0, CARDS_PER_SLOT)
    .map((m) => m.moveId);
}
