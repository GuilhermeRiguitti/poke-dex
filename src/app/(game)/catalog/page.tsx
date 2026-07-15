import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { clampPage, listPokedexPage } from "@/src/modules/pokedex";
import Pagination from "@/src/modules/pokedex/ui/Pagination";
import PokedexGrid from "@/src/modules/pokedex/ui/PokedexGrid";

// O CATÁLOGO: os 1025 pokémon, view-only, pra consultar informação. Era o
// conteúdo da home; virou rota própria quando a home passou a ser o dashboard.
// Não captura nada — obter pokémon é só pelo pacote (rota /packs).
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = clampPage(pageParam);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { pokemons, capturedIds, totalPages } = await listPokedexPage(session.user.id, page);

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-title text-3xl uppercase tracking-wide">
            Cat<span className="text-energy">álogo</span>
          </h1>
          <p className="text-sm font-semibold text-ink-dim">
            Todos os pokémon da dex. Abra pacotes para adicioná-los à sua coleção.
          </p>
        </div>
        <p className="font-title text-sm tracking-wider text-ink-dim">
          PÁGINA <span className="text-ink">{String(page).padStart(2, "0")}</span> / {totalPages}
        </p>
      </div>

      <PokedexGrid pokemons={pokemons} capturedIds={capturedIds} />
      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
