"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { collectionHref, type CollectionFilters } from "../domain/collectionFilters";
import { collectionFilterView } from "./collectionFilterView";

// O ÚNICO componente cliente desta coluna. Existe por dois motivos que o
// servidor não resolve: o debounce da busca (sem ele, cada tecla vira uma
// navegação, e cada navegação é uma invocação de lambda — CLAUDE.md §5, cota) e
// o `useTransition`, que evita a tela piscar entre uma página e outra.
//
// Ele NÃO busca dado. Ele só troca a URL; quem repinta é o servidor. Por isso a
// page continua Server Component e não há estado de "carregando".
//
// A barra virou COLUNA (a trilha da esquerda do workspace). O conjunto de
// filtros é o MESMO de antes — busca, raridade, tipo e ordenação; o que mudou é
// que o tipo deixou de ser um <select> de 19 opções e virou paleta de botões,
// que cabe na vertical e mostra o filtro ligado sem precisar abrir nada.

const DEBOUNCE_MS = 300;

const SELECT_CLASS =
  "clip-btn w-full cursor-pointer appearance-none border border-edge bg-panel-2 px-3 py-2 pr-8 font-title text-xs uppercase tracking-wider text-ink-dim transition-colors hover:border-energy/50 hover:text-ink";

const GROUP_LABEL = "font-title text-[10px] uppercase tracking-[0.14em] text-ink-dim";

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
    <aside
      className={`flex flex-col gap-4 border-b border-edge bg-panel/60 p-4 transition-opacity xl:min-h-0 xl:overflow-y-auto xl:border-b-0 xl:border-r ${
        pending ? "opacity-70" : ""
      }`}
    >
      <p className={GROUP_LABEL}>Filtros</p>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome..."
        maxLength={50}
        aria-label="Buscar carta por nome"
        className="clip-btn w-full border border-edge bg-panel-2 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-energy"
      />

      <div className="flex flex-col gap-1.5">
        <span className={GROUP_LABEL}>Raridade</span>
        <div className="relative">
          <select
            value={v.selectedRarity}
            onChange={(e) =>
              navegar({ rarity: (e.target.value || null) as CollectionFilters["rarity"] })
            }
            aria-label="Filtrar por raridade"
            className={SELECT_CLASS}
          >
            {v.rarityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Seta />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={GROUP_LABEL}>Tipo</span>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 xl:grid-cols-2">
          {v.typeChips.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => navegar({ type: t.active ? null : t.value || null })}
              aria-pressed={t.active}
              className="clip-btn cursor-pointer border-0 px-1 py-1.5 font-title text-[10px] uppercase leading-none tracking-wider transition-colors"
              style={{
                background: t.active ? t.color : `color-mix(in srgb, ${t.color} 13%, transparent)`,
                color: t.active ? "#0b0f16" : t.color,
                boxShadow: t.active
                  ? "none"
                  : `inset 0 0 0 1px color-mix(in srgb, ${t.color} 30%, transparent)`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={GROUP_LABEL}>Ordenar</span>
        <div className="relative">
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
          <Seta />
        </div>
      </div>

      {v.showClear && (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(v.clearHref))}
          className="clip-btn cursor-pointer border border-edge px-3 py-2 font-title text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:border-flare/60 hover:text-flare"
        >
          Limpar filtros
        </button>
      )}
    </aside>
  );
}

// A setinha do select: `appearance-none` mata a nativa (que vem cinza-sistema e
// destoa do painel), então ela é redesenhada aqui, por cima do campo.
function Seta() {
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -mt-0.5 border-x-4 border-t-[5px] border-x-transparent border-t-energy" />
  );
}
