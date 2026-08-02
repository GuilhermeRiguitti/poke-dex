import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/modules/auth/auth";
import { getDeckBoardQuery } from "@/src/modules/deck";
import DeckSlots from "@/src/modules/deck/ui/DeckSlots";
import { deckBoardView } from "@/src/modules/deck/ui/deckBoardView";
import { collectionHref, getCollectionQuery, parseCollectionFilters } from "@/src/modules/pokedex";
import CollectionFilterBar from "@/src/modules/pokedex/ui/CollectionFilterBar";
import CollectionGrid from "@/src/modules/pokedex/ui/CollectionGrid";
import Pagination from "@/src/modules/pokedex/ui/Pagination";
import { collectionView } from "@/src/modules/pokedex/ui/pokedexView";

type CollectionPageProps = {
   searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CollectionPage({ searchParams }: CollectionPageProps) {
   const filters = parseCollectionFilters(await searchParams);
   const session = await auth.api.getSession({ headers: await headers() });
   if (!session) redirect("/login");

   const [page, board] = await Promise.all([
      getCollectionQuery(session.user.id, filters),
      getDeckBoardQuery(session.user.id),
   ]);

   const view = collectionView(page);
   const deck = deckBoardView(board);

   return (
      <div className="pt-8">
         <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
               <h1 className="font-title text-3xl uppercase tracking-wide">
                  Minha <span className="text-energy">Coleção</span>
               </h1>
               <p className="text-sm font-semibold text-ink-dim">
                  Monte um deck de até {deck.limit} pokémons para batalhar.
               </p>
            </div>
            {view.totalCards > 0 && (
               <p className="font-title text-sm tracking-wider text-ink-dim">
                  <span className="text-ink">{view.totalCards}</span>{" "}
                  {view.totalCards === 1 ? "CARTA" : "CARTAS"}
               </p>
            )}
         </div>

         <DeckSlots deck={deck} />

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

         {view.emptyState === "all_in_deck" && (
            <div className="clip-card border border-dashed border-edge p-10 text-center">
               <p className="mb-2 font-title text-lg uppercase tracking-wide">Time completo</p>
               <p className="text-sm font-semibold text-ink-dim">
                  Todas as suas cartas já estão montadas no deck. Abra um pacote para conseguir mais.
               </p>
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
