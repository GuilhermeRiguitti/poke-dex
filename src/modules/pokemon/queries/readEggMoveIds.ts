import { prisma } from "@/src/lib/prisma";

// Os golpes que uma ESPÉCIE aprende por ovo. Só leitura.
//
// ⚠️ A cobertura é menor do que a série sugere, e isso é estrutural, não bug: a
// PK de `PokemonMove` é `[pokemonId, moveId]` (UMA linha por golpe) e o
// `METHOD_RANK` do `pickLearnEntry` guarda o método de menor rank. Então só
// sobrevive como `egg` o golpe que é EXCLUSIVAMENTE egg naquele version group —
// quem também é level-up ou TM foi gravado com o outro método.
//
// Medido no prod em 2026-08-14: 2.576 linhas `egg` em 548 das 1025 espécies
// (~4,7 por espécie que tem alguma). Dá jogo com folga, e por isso NÃO mexemos
// na PK — trocá-la mataria a unique `pokemonId_moveId` que o `applyTM` usa no
// findUnique, mexeria no índice quente e obrigaria a re-seedar as 1025.

export async function readEggMoveIds(pokemonId: string): Promise<string[]> {
  const rows = await prisma.pokemonMove.findMany({
    where: { pokemonId, learnMethod: "egg" },
    select: { moveId: true },
  });
  return rows.map((r) => r.moveId);
}
