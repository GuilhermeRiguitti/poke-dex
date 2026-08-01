import Link from "next/link";
import { paginationView } from "./paginationView";

// Server Component. A paginação é navegação por URL — não precisa de estado nem
// de JS no cliente pra funcionar.
//
// O href vem por PROP. Antes era "/?page=N" cravado aqui, o que jogava o
// usuário do catálogo pra home; e a coleção precisa preservar q/type/rarity/sort
// ao virar de página, o que nenhum href fixo consegue.

const BASE = "clip-btn px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors";

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className={`${BASE} border border-edge text-ink-dim opacity-40`}>{children}</span>;
  }

  return (
    <Link
      href={href}
      className={`${BASE} border border-edge text-ink-dim hover:border-energy/60 hover:text-energy`}
    >
      {children}
    </Link>
  );
}

export default function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  const v = paginationView(page, totalPages);

  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <PageLink href={hrefFor(v.prevPage)} disabled={v.prevDisabled}>
        ← Anterior
      </PageLink>
      <span className="plate bg-panel-2 border border-edge px-4 py-2">
        <span className="plate-inner font-title text-sm tracking-wider">
          {v.label} / {v.totalLabel}
        </span>
      </span>
      <PageLink href={hrefFor(v.nextPage)} disabled={v.nextDisabled}>
        Próxima →
      </PageLink>
    </div>
  );
}
