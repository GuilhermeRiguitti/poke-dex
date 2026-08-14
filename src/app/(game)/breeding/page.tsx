import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/modules/auth/auth";
import { prisma } from "@/src/lib/prisma";
import { isSameUtcDay } from "@/src/lib/utcDay";
import { COLLECTION_CARD_SELECT, toCollectionCardDTO } from "@/src/modules/pokedex";
import BreedingPanel from "@/src/modules/pokemon/ui/BreedingPanel";

// Page é SERVIDOR (CLAUDE.md regra 1): busca a coleção e o estado do dia no
// render e passa pintados. Sem "use client", sem fetch de primeira pintura.
//
// A coleção vem INTEIRA (sem paginar) porque aqui ela é uma lista de escolha,
// não uma grade navegável — paginar obrigaria o jogador a caçar o segundo pai
// numa página diferente.
export default async function BreedingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [rows, packState] = await Promise.all([
    prisma.userPokemon.findMany({
      where: { userId: session.user.id },
      orderBy: { capturedAt: "desc" },
      select: COLLECTION_CARD_SELECT,
    }),
    prisma.packState.findUnique({
      where: { userId: session.user.id },
      select: { lastBreedAt: true },
    }),
  ]);

  const usedToday = Boolean(
    packState?.lastBreedAt && isSameUtcDay(packState.lastBreedAt, new Date()),
  );

  return (
    <div className="pt-8">
      <div className="mb-8">
        <h1 className="font-title text-3xl uppercase tracking-wide">Cruzamento</h1>
        <p className="max-w-2xl text-sm font-semibold text-ink-dim">
          Duas cartas suas geram uma terceira quando <strong>uma delas sabe um golpe que a
          espécie da outra aprende por ovo</strong>. O filhote nasce nível 1, da espécie
          que aprende por ovo, já sabendo esse golpe. Um cruzamento por dia.
        </p>
      </div>

      <BreedingPanel cards={rows.map(toCollectionCardDTO)} usedToday={usedToday} />
    </div>
  );
}
