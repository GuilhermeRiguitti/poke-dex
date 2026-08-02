import { prisma } from "@/src/lib/prisma";
import type { BaseStats } from "@/src/modules/progression";

// ─────────────────────────────────────────────────────────────────────────
// A DÍVIDA DO Deck.userId, num lugar só.
//
// Deck.userId NÃO é @unique no schema. Logo, `findFirst` seguido de `create` é
// uma corrida: dois requests concorrentes (duas abas, um duplo-clique) criam
// DOIS decks pro mesmo usuário. A defesa sem migration é o `orderBy: createdAt
// asc`: todo mundo que lê converge no deck MAIS ANTIGO. A cura de verdade é
// migration com @@unique([userId]) + upsert. Ver CLAUDE.md "Dívida conhecida".
// ─────────────────────────────────────────────────────────────────────────
const deckOfUser = (userId: string) =>
  ({ where: { userId }, orderBy: { createdAt: "asc" } }) as const;

/**
 * O deck do usuário, criando um vazio se não existir. **ESCREVE** — só de
 * command ou rota de API, nunca do render de uma page.
 */
export async function getOrCreateDeck(userId: string) {
  const existing = await prisma.deck.findFirst({ ...deckOfUser(userId), select: { id: true } });
  if (existing) return existing;
  return prisma.deck.create({ data: { userId }, select: { id: true } });
}

// ─── Loadout completo pro battle montar o snapshot (lê o espelho local) ─────

/** Uma carta do loadout já resolvida no Move do espelho. */
export interface DeckLoadoutCard {
  order: number;
  move: {
    moveApiId: number;
    name: string;
    type: string;
    power: number | null;
    accuracy: number | null;
    damageClass: string;
    priority: number;
    pp: number;
  };
}

/** Um slot do deck com o UserPokemon (nível + espécie) e suas cartas. */
export interface DeckLoadoutSlot {
  order: number;
  userPokemon: {
    id: string;
    level: number;
    pokemon: {
      pokemonApiId: number;
      name: string;
      types: string[];
      baseStats: BaseStats;
      spriteUrl: string | null;
    };
  };
  cards: DeckLoadoutCard[];
}

/**
 * Os loadouts do deck, na ordem dos slots, limitado ao tamanho do time. É o que
 * o battle usa pra montar o snapshot da partida — já com o pokémon (nível +
 * base stats do espelho) e as cartas (Move do espelho) resolvidos. `types`/
 * `baseStats` são colunas Json; o cast é o contrato do espelho (syncPokedex).
 */
export async function readDeckSlots(
  userId: string,
  deckId: string,
  take: number
): Promise<DeckLoadoutSlot[]> {
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    include: {
      slots: {
        orderBy: { order: "asc" },
        take,
        include: {
          userPokemon: {
            select: {
              id: true,
              level: true,
              pokemon: {
                select: { pokemonApiId: true, name: true, types: true, baseStats: true, spriteUrl: true },
              },
            },
          },
          cards: {
            orderBy: { order: "asc" },
            include: {
              move: {
                select: {
                  moveApiId: true,
                  name: true,
                  type: true,
                  power: true,
                  accuracy: true,
                  damageClass: true,
                  priority: true,
                  pp: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!deck) return [];

  return deck.slots.map((slot) => ({
    order: slot.order,
    userPokemon: {
      id: slot.userPokemon.id,
      level: slot.userPokemon.level,
      pokemon: {
        pokemonApiId: slot.userPokemon.pokemon.pokemonApiId,
        name: slot.userPokemon.pokemon.name,
        types: slot.userPokemon.pokemon.types as string[],
        baseStats: slot.userPokemon.pokemon.baseStats as unknown as BaseStats,
        spriteUrl: slot.userPokemon.pokemon.spriteUrl,
      },
    },
    cards: slot.cards.map((c) => ({
      order: c.order,
      move: {
        moveApiId: c.move.moveApiId,
        name: c.move.name,
        type: c.move.type,
        power: c.move.power,
        accuracy: c.move.accuracy,
        damageClass: c.move.damageClass,
        priority: c.move.priority,
        pp: c.move.pp,
      },
    })),
  }));
}
