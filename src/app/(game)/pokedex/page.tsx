import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { getCollection } from "@/src/modules/pokedex";
import CollectionGrid from "@/src/modules/pokedex/ui/CollectionGrid";
import DeckSlots from "@/src/modules/pokedex/ui/DeckSlots";
import { collectionView } from "@/src/modules/pokedex/ui/pokedexView";

// Esta página era "use client" inteira. Ela fazia, no browser:
//   fetch("/api/cards") -> e então UM fetch("/api/pokeapi/{id}") POR pokémon da
//   coleção, + fetch("/api/deck")
// ou seja, 2 + N requisições, todas depois do JS carregar, com um
// "Carregando coleção..." no meio. Agora é servidor: 3 queries no banco, nenhum
// fetch de cliente, nenhum estado de loading, e o HTML já sai pintado.
export default async function CollectionPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const collection = await getCollection(session.user.id);
  const { cards, deckSlots, deckCount, deckLimit, isEmpty } = collectionView(collection);

  return (
    <div className="pt-8">
      <div className="mb-6">
        <h1 className="font-title text-3xl uppercase tracking-wide">
          Minha <span className="text-energy">Coleção</span>
        </h1>
        <p className="text-sm font-semibold text-ink-dim">
          Monte um deck de até {deckLimit} pokémons para batalhar.
        </p>
      </div>

      <DeckSlots slots={deckSlots} deckCount={deckCount} deckLimit={deckLimit} />

      {isEmpty ? (
        <div className="clip-card border border-dashed border-edge p-10 text-center">
          <p className="mb-2 font-title text-lg uppercase tracking-wide">Coleção vazia</p>
          <p className="mb-4 text-sm font-semibold text-ink-dim">
            Capture pokémons na PokéDex para começar.
          </p>
          <Link
            href="/"
            className="clip-btn inline-block bg-flare px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-flare-dark"
          >
            Ir para a PokéDex
          </Link>
        </div>
      ) : (
        <CollectionGrid cards={cards} />
      )}
    </div>
  );
}
