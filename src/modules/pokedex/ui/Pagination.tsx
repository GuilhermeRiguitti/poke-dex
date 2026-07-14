import Link from "next/link";

// Server Component. A paginação é navegação por URL (?page=N) — não precisa de
// estado nem de JS no cliente pra funcionar.

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base = "clip-btn px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors";

  if (disabled) {
    return <span className={`${base} border border-edge text-ink-dim opacity-40`}>{children}</span>;
  }

  return (
    <Link
      href={`/?page=${page}`}
      className={`${base} border border-edge text-ink-dim hover:border-energy/60 hover:text-energy`}
    >
      {children}
    </Link>
  );
}

export default function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <PageLink page={page - 1} disabled={page <= 1}>
        ← Anterior
      </PageLink>
      <span className="plate bg-panel-2 border border-edge px-4 py-2">
        <span className="plate-inner font-title text-sm tracking-wider">
          {String(page).padStart(2, "0")}
        </span>
      </span>
      <PageLink page={page + 1} disabled={page >= totalPages}>
        Próxima →
      </PageLink>
    </div>
  );
}
