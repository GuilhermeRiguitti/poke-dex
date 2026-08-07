import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/modules/auth/auth";
import { DECK_LIMIT, getDeckBoardQuery } from "@/src/modules/deck";
import DeckEditorProvider from "@/src/modules/deck/ui/DeckEditorProvider";
import DeckPanel from "@/src/modules/deck/ui/DeckPanel";
import { collectionHref, getCollectionQuery, parseCollectionFilters } from "@/src/modules/pokedex";
import CollectionDropZone from "@/src/modules/pokedex/ui/CollectionDropZone";
import CollectionFilterBar from "@/src/modules/pokedex/ui/CollectionFilterBar";
import CollectionGrid from "@/src/modules/pokedex/ui/CollectionGrid";
import Pagination from "@/src/modules/pokedex/ui/Pagination";
import { collectionView } from "@/src/modules/pokedex/ui/pokedexView";

// O DeckEditorProvider (cliente) envolve as duas colunas porque montar o time
// atravessa as duas: a carta que se arrasta está na coleção e a vaga que a
// recebe está no painel do deck. Ele recebe as colunas como `children`, que
// continuam vindo do servidor — é o que permite ter o arrasto SEM tornar esta
// page cliente: se ela levasse "use client", getCollectionQuery e
// getDeckBoardQuery (que importam Prisma) iriam parar no bundle do browser.
//
// O deck lido aqui é o GRAVADO. Daqui pra frente ele é só o ponto de partida do
// rascunho — o provider é quem manda no que a tela mostra, até o save.

type CollectionPageProps = {
   searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: CollectionPageProps) {
   const filters = parseCollectionFilters(await searchParams);
   const session = await auth.api.getSession({ headers: await headers() });
   if (!session) redirect("/login");

   const [page, board] = await Promise.all([
      getCollectionQuery(session.user.id, filters),
      getDeckBoardQuery(session.user.id),
   ]);

   const view = collectionView(page);

   return (
      <div className="xl:relative xl:left-1/2 xl:-mb-16 xl:ml-[-50vw] xl:w-screen">
       <DeckEditorProvider board={board}>
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
                     Monte um deck de até {DECK_LIMIT} pokémons para batalhar.
                  </p>
                  {view.totalCards > 0 && (
                     <p className="ml-auto font-title text-sm tracking-wider text-ink-dim">
                        <span className="text-gold">{view.totalCards}</span>{" "}
                        {view.totalCards === 1 ? "CARTA" : "CARTAS"}
                     </p>
                  )}
               </div>

               {/* O painel rolável é o ALVO de "tirar do time": arrastar uma
                   carta da vaga até aqui devolve ela pra coleção. Só uma casca
                   cliente — a grade dentro segue vindo do servidor. */}
               <CollectionDropZone className="px-4 pb-8 pt-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
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

                  {/* "Time completo" saiu daqui: a grade lista TODAS as cartas
                      agora, inclusive as montadas (marcadas com a vaga), então
                      montar a coleção inteira não esvazia mais a listagem. */}

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
               </CollectionDropZone>
            </section>

            <div className="order-1 xl:order-0 xl:contents">
               <DeckPanel />
            </div>
         </div>
       </DeckEditorProvider>
      </div>
   );
}
