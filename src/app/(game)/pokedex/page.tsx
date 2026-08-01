import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/modules/auth/auth";
import { collectionHref, getCollectionPage, parseCollectionFilters } from "@/src/modules/pokedex";
import CollectionFilterBar from "@/src/modules/pokedex/ui/CollectionFilterBar";
import CollectionGrid from "@/src/modules/pokedex/ui/CollectionGrid";
import DeckSlots from "@/src/modules/pokedex/ui/DeckSlots";
import Pagination from "@/src/modules/pokedex/ui/Pagination";
import { collectionView } from "@/src/modules/pokedex/ui/pokedexView";

// Server Component. Filtro, busca, ordenação e paginação vivem na URL, e quem
// resolve tudo é o BANCO — nenhuma carta fora da página de 16 sai do Postgres.
// Nenhum fetch de cliente, nenhum estado de "carregando": o HTML já sai pintado.
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseCollectionFilters(await searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const page = await getCollectionPage(session.user.id, filters);
  const view = collectionView(page);

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-title text-3xl uppercase tracking-wide">
            Minha <span className="text-energy">Coleção</span>
          </h1>
          <p className="text-sm font-semibold text-ink-dim">
            Monte um deck de até {view.deckLimit} pokémons para batalhar.
          </p>
        </div>
        {view.totalCards > 0 && (
          <p className="font-title text-sm tracking-wider text-ink-dim">
            <span className="text-ink">{view.totalCards}</span>{" "}
            {view.totalCards === 1 ? "CARTA" : "CARTAS"}
          </p>
        )}
      </div>

      <DeckSlots slots={view.deckSlots} deckCount={view.deckCount} deckLimit={view.deckLimit} />

      <CollectionFilterBar filters={filters} />

      {view.emptyState === "collection" && (
        <div className="clip-card border border-dashed border-edge p-10 text-center">
          <p className="mb-2 font-title text-lg uppercase tracking-wide">Coleção vazia</p>
          <p className="mb-4 text-sm font-semibold text-ink-dim">
            Abra pacotes para começar a colecionar.
          </p>
          <Link
            href="/packs"
            className="clip-btn inline-block bg-flare px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-flare-dark"
          >
            Abrir um pacote
          </Link>
        </div>
      )}

      {view.emptyState === "filter" && (
        <div className="clip-card border border-dashed border-edge p-10 text-center">
          <p className="mb-2 font-title text-lg uppercase tracking-wide">Nenhuma carta encontrada</p>
          <p className="mb-4 text-sm font-semibold text-ink-dim">
            Nenhuma das suas {page.totalInCollection} cartas bate com esses filtros.
          </p>
          <Link
            href={collectionHref(filters, { q: null, type: null, rarity: null })}
            className="clip-btn inline-block border border-edge px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink-dim transition-colors hover:border-energy/60 hover:text-energy"
          >
            Limpar filtros
          </Link>
        </div>
      )}

      {view.emptyState === "none" && (
        <>
          <CollectionGrid cards={view.cards} />
          {view.totalPages > 1 && (
            <Pagination
              page={view.page}
              totalPages={view.totalPages}
              hrefFor={(p) => collectionHref(filters, { page: p })}
            />
          )}
        </>
      )}
    </div>
  );
}
