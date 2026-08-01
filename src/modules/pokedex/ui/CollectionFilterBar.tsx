"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { collectionHref, type CollectionFilters } from "../domain/collectionFilters";
import { collectionFilterView } from "./collectionFilterView";

// O ÚNICO componente cliente desta tela. Existe por dois motivos que o servidor
// não resolve: o debounce da busca (sem ele, cada tecla vira uma navegação, e
// cada navegação é uma invocação de lambda — CLAUDE.md §5, cota) e o
// `useTransition`, que evita a tela piscar entre uma página e outra.
//
// Ele NÃO busca dado. Ele só troca a URL; quem repinta é o servidor. Por isso a
// page continua Server Component e não há estado de "carregando".

const DEBOUNCE_MS = 300;

const SELECT_CLASS =
  "clip-btn border border-edge bg-panel-2 px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-dim";

export default function CollectionFilterBar({ filters }: { filters: CollectionFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const v = collectionFilterView(filters);

  const [query, setQuery] = useState(v.query);
  // Guarda o valor que veio do servidor pra distinguir "o usuário digitou" de
  // "a URL mudou por outro caminho" (limpar filtro, voltar no browser).
  const vindoDoServidor = useRef(v.query);

  useEffect(() => {
    if (vindoDoServidor.current !== v.query) {
      vindoDoServidor.current = v.query;
      setQuery(v.query);
    }
  }, [v.query]);

  useEffect(() => {
    if (query === v.query) return;
    const t = setTimeout(() => {
      vindoDoServidor.current = query;
      startTransition(() => router.replace(collectionHref(filters, { q: query || null })));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, v.query, filters, router]);

  const navegar = (patch: Partial<CollectionFilters>) =>
    startTransition(() => router.replace(collectionHref(filters, patch)));

  return (
    <div
      className={`clip-card mb-6 flex flex-wrap items-center gap-3 border border-edge p-4 ${
        pending ? "opacity-70" : ""
      }`}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome..."
        maxLength={50}
        aria-label="Buscar carta por nome"
        className="clip-btn min-w-[12rem] flex-1 border border-edge bg-panel-2 px-3 py-2 text-sm font-semibold text-ink"
      />

      <select
        value={v.selectedRarity}
        onChange={(e) => navegar({ rarity: (e.target.value || null) as CollectionFilters["rarity"] })}
        aria-label="Filtrar por raridade"
        className={SELECT_CLASS}
      >
        {v.rarityOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={v.selectedType}
        onChange={(e) => navegar({ type: e.target.value || null })}
        aria-label="Filtrar por tipo"
        className={SELECT_CLASS}
      >
        {v.typeOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={v.selectedSort}
        onChange={(e) => navegar({ sort: e.target.value as CollectionFilters["sort"] })}
        aria-label="Ordenar"
        className={SELECT_CLASS}
      >
        {v.sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {v.showClear && (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(v.clearHref))}
          className="clip-btn border border-edge px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-dim transition-colors hover:border-flare/60 hover:text-flare"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
