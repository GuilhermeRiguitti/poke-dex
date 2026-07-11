import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractIdFromUrl, fetchPokemon } from "@/lib/pokeapi";
import AddCardButton from "@/components/AddCardButton";
import TypeBadge from "@/components/TypeBadge";

const PAGE_SIZE = 20;
// Gen 1-9 "reais"; acima de 1025 a PokéAPI lista formas alternativas
const MAX_POKEMON = 1025;
const TOTAL_PAGES = Math.ceil(MAX_POKEMON / PAGE_SIZE);

interface ListItem {
  name: string;
  url: string;
}

async function fetchPage(page: number): Promise<ListItem[]> {
  const offset = (page - 1) * PAGE_SIZE;
  const limit = Math.min(PAGE_SIZE, MAX_POKEMON - offset);
  const res = await fetch(
    `https://pokeapi.co/api/v2/pokemon?offset=${offset}&limit=${limit}`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.min(Math.max(parseInt(pageParam ?? "1", 10) || 1, 1), TOTAL_PAGES);

  const session = await auth.api.getSession({ headers: await headers() });
  const [list, userCards] = await Promise.all([
    fetchPage(page),
    prisma.userCard.findMany({
      where: { userId: session!.user.id },
      select: { pokemonId: true },
    }),
  ]);
  const savedIds = new Set(userCards.map((c) => c.pokemonId));

  const pokemons = (
    await Promise.all(list.map((item) => fetchPokemon(extractIdFromUrl(item.url))))
  ).filter((p) => p !== null);

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">PokéDex</h1>
          <p className="text-sm text-ink-dim">
            Capture pokémons para montar sua coleção e seu deck de batalha.
          </p>
        </div>
        <p className="text-sm text-ink-dim">
          Página {page} de {TOTAL_PAGES}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {pokemons.map((p) => (
          <div
            key={p.id}
            className="group flex flex-col rounded-2xl border border-edge bg-surface p-3 transition-colors hover:border-ink-dim"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-ink-dim">
                #{String(p.id).padStart(4, "0")}
              </span>
              <div className="flex flex-col items-end gap-1">
                {p.types.map((t) => (
                  <TypeBadge key={t.type.name} type={t.type.name} small />
                ))}
              </div>
            </div>

            <Link
              href={`/pokemon/${p.id}`}
              className="flex flex-1 flex-col items-center justify-center py-1"
            >
              {(p.sprites.artwork ?? p.sprites.front_default) && (
                // eslint-disable-next-line @next/next/no-img-element -- sprites vêm da PokéAPI (host externo dinâmico)
                <img
                  src={p.sprites.artwork ?? p.sprites.front_default ?? ""}
                  alt={p.name}
                  loading="lazy"
                  className="h-24 w-24 object-contain transition-transform group-hover:scale-110"
                />
              )}
              <span className="mt-1 font-bold capitalize">{p.name}</span>
            </Link>

            <div className="mt-2 flex items-center justify-center">
              <AddCardButton pokemonId={p.id} saved={savedIds.has(p.id)} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-3">
        <PageLink page={page - 1} disabled={page <= 1}>
          ← Anterior
        </PageLink>
        <span className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-bold">{page}</span>
        <PageLink page={page + 1} disabled={page >= TOTAL_PAGES}>
          Próxima →
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-edge px-4 py-2 text-sm text-ink-dim opacity-40">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={`/?page=${page}`}
      className="rounded-lg border border-edge px-4 py-2 text-sm text-ink-dim transition-colors hover:border-ink-dim hover:text-ink"
    >
      {children}
    </Link>
  );
}
