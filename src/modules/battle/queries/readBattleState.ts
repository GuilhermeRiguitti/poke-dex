import { prisma } from "@/src/lib/prisma";
import { battleTypeNames } from "./battleTypeNames";
import { loadTypeChart } from "./loadTypeChart";
import { toBattleDTO } from "./toBattleDTO";

// É o que o render server-side da página usa. getBattleState (o irmão desta
// função) resolve o turno, o que além de escrever pode fazer I/O de rede pra
// montar a matriz de tipos. Isso é aceitável dentro de uma rota de API — o
// client fica esperando o fetch — mas dentro do render da página significaria:
// dependência lenta ou fora do ar => a página inteira falha, e o jogador cai no
// error.tsx do jogo em vez de ver a batalha.
//
// A resolução do turno não depende deste caminho: o polling de /status chama
// tryResolveTurn a cada 2s, então qualquer turno pendente resolve em no
// máximo um tick, com a mesa já na tela.
export async function readBattleState(battleId: string, userId: string) {
  const battle = await prisma.battle.findUnique({
    where: { id: battleId },
    include: {
      participants: {
        include: {
          pokemons: {
            orderBy: { slot: "asc" }
          }
        }
      },
      turnLogs: {
        orderBy: { turnNumber: "desc" },
        take: 10
      },
    },
  });
  if (!battle) return { error: "not_found" as const };

  const isParticipant = battle.participants.some((p) => p.userId === userId);
  if (!isParticipant) return { error: "forbidden" as const };

  // Só leitura, como o resto da função: a matriz vem do espelho (`Type`), que é
  // banco e não rede — nada aqui pode derrubar o render da página.
  const chart = await loadTypeChart(battleTypeNames(battle));

  return { battle: toBattleDTO(battle, Date.now(), chart) };
}
