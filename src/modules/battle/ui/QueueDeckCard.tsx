import Link from "next/link";
import type { QueueDeckDTO } from "./types";

// Card do deck + botão de procurar/cancelar. Não tem estado próprio nem fetch:
// recebe tudo por prop e devolve as intenções pra cima. O deck já chega
// preenchido do servidor, então não existe mais estado de "carregando".
export default function QueueDeckCard({
  deck,
  searching,
  error,
  onSearch,
  onCancel,
}: {
  deck: QueueDeckDTO;
  searching: boolean;
  error: string;
  onSearch: () => void;
  onCancel: () => void;
}) {
  const isEmpty = deck.pokemonCount === 0;

  return (
    <div className="clip-card mt-8 w-full max-w-sm border border-edge bg-panel p-6">
      <p className="text-sm font-semibold">
        <span className="text-ink-dim">Deck:</span>{" "}
        <span className="font-title tracking-wide">{deck.name}</span>{" "}
        <span className="text-ink-dim">— {deck.pokemonCount}/6 pokémons</span>
      </p>

      {isEmpty && (
        <p className="mt-3 text-sm font-semibold text-warn">
          Seu deck está vazio. Monte-o na{" "}
          <Link href="/pokedex" className="underline">
            sua coleção
          </Link>{" "}
          antes de batalhar.
        </p>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-bad">{error}</p>}

      {searching ? (
        <>
          <p className="mt-5 font-title uppercase tracking-wider text-flare">
            Procurando oponente...
          </p>
          <button
            onClick={onCancel}
            className="clip-btn mt-4 w-full cursor-pointer border border-edge bg-transparent py-2.5 text-sm font-bold uppercase tracking-wide text-ink-dim transition-colors hover:text-ink"
          >
            Cancelar
          </button>
        </>
      ) : (
        <button
          onClick={onSearch}
          disabled={isEmpty}
          className="clip-btn animate-playable-pulse mt-5 w-full cursor-pointer border-0 bg-flare py-3 font-title text-lg uppercase tracking-wider text-white transition-colors hover:bg-flare-dark disabled:animate-none disabled:opacity-40"
        >
          Procurar oponente
        </button>
      )}
    </div>
  );
}
