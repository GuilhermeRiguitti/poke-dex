import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { clampPage, listPokedexPage } from "@/src/modules/pokedex";
import Pagination from "@/src/modules/pokedex/ui/Pagination";
import PokedexGrid from "@/src/modules/pokedex/ui/PokedexGrid";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = clampPage(pageParam);

  // O layout do grupo (game) também redireciona, mas layout e page renderizam
  // em paralelo no App Router — a page precisa validar a sessão por conta própria.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { pokemons, capturedIds, totalPages } = await listPokedexPage(session.user.id, page);

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-title text-3xl uppercase tracking-wide">
            Poké<span className="text-energy">Dex</span>
          </h1>
          <p className="text-sm font-semibold text-ink-dim">
            Capture pokémons para montar sua coleção e seu deck de batalha.
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
