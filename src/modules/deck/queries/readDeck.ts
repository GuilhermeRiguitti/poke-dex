import { prisma } from "@/src/lib/prisma";
import type { DeckDTO } from "../ui/types";
import { toDeckDTO } from "./toDeckDTO";

// ─────────────────────────────────────────────────────────────────────────
// A DÍVIDA DO Deck.userId, num lugar só.
//
// Deck.userId NÃO é @unique no schema. Logo, `findFirst` seguido de `create`
// é uma corrida: dois requests concorrentes (duas abas, um duplo-clique no
// "+ Deck") criam DOIS decks pro mesmo usuário.
//
// A defesa possível sem migration é o `orderBy: { createdAt: "asc" }`: todo
// mundo que lê converge no deck MAIS ANTIGO. Assim, mesmo que exista uma
// duplicata órfã, o jogador não monta o time num deck e batalha com outro.
//
// Isso estava escrito em DOIS lugares (GET /api/deck e battle/getQueueDeck),
// com o mesmo comentário copiado — e é exatamente o tipo de coisa que alguém
// conserta num lugar e esquece no outro. Agora `deckWhere` é a única definição
// de "qual é o deck do usuário", e todo mundo passa por aqui.
//
// A cura de verdade: migration com @@unique([userId]) + upsert. Aí este
// arquivo inteiro vira um upsert e o orderBy some.
// ─────────────────────────────────────────────────────────────────────────
const deckOfUser = (userId: string) =>
  ({ where: { userId }, orderBy: { createdAt: "asc" } }) as const;

const deckInclude = {
  deckCards: {
    include: { userCard: { select: { pokemonId: true } } },
    orderBy: { addedAt: "asc" },
  },
} as const;

/**
 * O deck do usuário, SÓ LEITURA. Devolve null se ele ainda não tem deck.
 *
 * É de propósito que isto NÃO cria o deck: quem chama é o render da página da
 * coleção, e render de page não escreve (CLAUDE.md, regra 2). O deck nasce no
 * command, quando o jogador coloca o primeiro pokémon nele — ver addToDeck.
 */
export async function readDeck(userId: string): Promise<DeckDTO | null> {
  const deck = await prisma.deck.findFirst({
    ...deckOfUser(userId),
    include: deckInclude,
  });

  return deck ? toDeckDTO(deck) : null;
}

/**
 * O deck do usuário, criando um vazio se não existir. **ESCREVE** — só pode
 * ser chamada de um command ou de rota de API, nunca do render de uma page.
 */
export async function getOrCreateDeck(userId: string) {
  const existing = await prisma.deck.findFirst({
    ...deckOfUser(userId),
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.deck.create({ data: { userId }, select: { id: true } });
}

/** Quantos pokémon há no deck do usuário. 0 se ele nem tem deck. Só leitura. */
export async function countDeckCards(userId: string): Promise<number> {
  const deck = await prisma.deck.findFirst({
    ...deckOfUser(userId),
    select: { _count: { select: { deckCards: true } } },
  });

  return deck?._count.deckCards ?? 0;
}

/**
 * Os pokémon do deck, na ordem em que entraram, limitado ao tamanho do time.
 * É o que o battle usa pra montar o snapshot da partida.
 */
export async function readDeckRoster(
  userId: string,
  deckId: string,
  take: number
): Promise<{ pokemonId: number }[]> {
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    include: {
      deckCards: {
        include: { userCard: { select: { pokemonId: true } } },
        orderBy: { addedAt: "asc" },
        take,
      },
    },
  });

  if (!deck) return [];
  return deck.deckCards.map((dc) => ({ pokemonId: dc.userCard.pokemonId }));
}
