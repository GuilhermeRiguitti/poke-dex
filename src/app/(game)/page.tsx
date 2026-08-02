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

// A coleção é um WORKSPACE de três colunas: filtros | cartas | deck.
//
// Em telas largas (xl) ela ocupa a viewport inteira e cada coluna rola por
// dentro — assim o deck fica sempre à vista enquanto se percorre a coleção, que
// é a única coisa que a tela faz. Pra isso ela precisa furar o container
// `max-w-6xl` do layout de (game): daí o `left-1/2 / -ml-[50vw] / w-screen`, e o
// `-mb-16` que devolve o `pb-16` do <main> (senão sobra uma faixa de scroll).
//
// Abaixo de xl vira empilhamento normal, na ordem deck → filtros → cartas, e a
// página volta a rolar inteira.
//
// Continua Server Component: quem busca é o servidor, e o único cliente é a
// barra de filtros (debounce) + o X da vaga do deck.

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
      <div className="xl:relative xl:left-1/2 xl:-mb-16 xl:ml-[-50vw] xl:w-screen">
         <div className="grid grid-cols-1 xl:h-[calc(100vh-4rem)] xl:grid-cols-[248px_minmax(0,1fr)_336px]">
            <div className="order-2 xl:order-0 xl:contents">
               <CollectionFilterBar filters={filters} />
            </div>

            <section className="order-3 flex flex-col xl:order-0 xl:min-h-0">
               <div className="flex flex-none flex-wrap items-end gap-x-4 gap-y-1 border-b border-edge px-4 py-3.5">
                  <h1 className="font-title text-2xl uppercase leading-none tracking-wide">
                     Minha <span className="text-energy">Coleção</span>
                  </h1>
                  <p className="text-sm font-semibold text-ink-dim">
                     Monte um deck de até {deck.limit} pokémons para batalhar.
                  </p>
                  {view.totalCards > 0 && (
                     <p className="ml-auto font-title text-sm tracking-wider text-ink-dim">
                        <span className="text-gold">{view.totalCards}</span>{" "}
                        {view.totalCards === 1 ? "CARTA" : "CARTAS"}
                     </p>
                  )}
               </div>

               <div className="px-4 pb-8 pt-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
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
            </section>

            <div className="order-1 xl:order-0 xl:contents">
               <DeckSlots deck={deck} />
            </div>
         </div>
      </div>
   );
}
