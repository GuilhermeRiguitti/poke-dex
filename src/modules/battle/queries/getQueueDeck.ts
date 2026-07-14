import { prisma } from "@/src/lib/prisma";
import type { QueueDeckDTO } from "../ui/types";

const deckSelect = {
  id: true,
  name: true,
  _count: { select: { deckCards: true } },
} as const;

// O deck do usuário como a tela da fila precisa dele. Cria o deck vazio se
// ainda não existir — mesmo comportamento do GET /api/deck, que era o que a
// página chamava do client. Agora a página lê isso no servidor, então não há
// mais o flash de "Carregando seu deck...".
//
// ATENÇÃO: Deck.userId NÃO é @unique no schema, então este findFirst/create
// é uma corrida — dois requests concorrentes (duas abas, um duplo-clique)
// criam DOIS decks. O orderBy é a defesa possível sem migration: todo mundo
// que lê converge no deck mais antigo, então uma duplicata órfã não faz o
// jogador montar o time num deck e batalhar com outro. A correção de verdade
// é @unique([userId]) + upsert — precisa de migration.
export async function getQueueDeck(userId: string): Promise<QueueDeckDTO> {
  const deck =
    (await prisma.deck.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: deckSelect,
    })) ??
    (await prisma.deck.create({
      data: { userId },
      select: deckSelect,
    }));

  return { id: deck.id, name: deck.name, pokemonCount: deck._count.deckCards };
}
