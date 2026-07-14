import { prisma } from "@/src/lib/prisma";
import { toBattleDTO } from "./toBattleDTO";

// Leitura PURA da partida — não resolve turno, não escreve, não toca a rede.
//
// É o que o render server-side da página usa. getBattleState (o irmão desta
// função) chama tryResolveTurn, que além de escrever pode bater na PokéAPI
// pra montar a matriz de tipos num cache miss. Isso é aceitável dentro de uma
// rota de API — o client fica esperando o fetch — mas dentro do render da
// página significaria: PokéAPI lenta ou fora do ar => a página inteira falha,
// e o jogador vê tela de erro em vez da batalha (não há error.tsx).
//
// A resolução do turno não depende deste caminho: o polling de /status chama
// tryResolveTurn a cada 2s, então qualquer turno pendente resolve em no
// máximo um tick, com a mesa já na tela.
export async function readBattleState(battleId: string, userId: string) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: { include: { pokemons: { orderBy: { slot: "asc" } } } },
      turnLogs: { orderBy: { turnNumber: "desc" }, take: 10 },
    },
  });
  if (!battle) return { error: "not_found" as const };

  const isParticipant = battle.participants.some((p) => p.userId === userId);
  if (!isParticipant) return { error: "forbidden" as const };

  return { battle: toBattleDTO(battle) };
}
