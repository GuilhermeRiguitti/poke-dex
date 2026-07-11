"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NormalizedPokemon } from "@/lib/pokeapi";
import TypeBadge from "@/components/TypeBadge";
import { SwordsIcon } from "@/components/icons";

interface UserCard {
  id: string;
  pokemonId: number;
  addedAt: string;
}

interface DeckInfo {
  id: string;
  deckCards: { id: string; userCardId: string }[];
}

const DECK_LIMIT = 6;

export default function CollectionPage() {
  const router = useRouter();
  const [userCards, setUserCards] = useState<UserCard[]>([]);
  const [details, setDetails] = useState<Record<number, NormalizedPokemon>>({});
  const [deck, setDeck] = useState<DeckInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cards")
      .then((res) => {
        if (res.status === 401) { router.push("/login"); return null; }
        return res.json();
      })
      .then((data: UserCard[] | null) => {
        if (!data) return;
        setUserCards(data);
        return Promise.all(
          data.map((uc) =>
            fetch(`/api/pokeapi/${uc.pokemonId}`).then((r) => (r.ok ? r.json() : null))
          )
        ).then((results) => {
          const map: Record<number, NormalizedPokemon> = {};
          results.forEach((pokemon) => {
            if (pokemon) map[pokemon.id] = pokemon;
          });
          setDetails(map);
        });
      })
      .finally(() => setLoading(false));

    fetch("/api/deck")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DeckInfo | null) => { if (data) setDeck(data); });
  }, [router]);

  const deckCardFor = (userCardId: string) =>
    deck?.deckCards.find((dc) => dc.userCardId === userCardId);

  const removerPokemon = async (userCardId: string) => {
    await fetch(`/api/cards/${userCardId}`, { method: "DELETE" });
    setUserCards((prev) => prev.filter((c) => c.id !== userCardId));
    setDeck((prev) =>
      prev ? { ...prev, deckCards: prev.deckCards.filter((dc) => dc.userCardId !== userCardId) } : prev
    );
  };

  const toggleDeck = async (userCardId: string) => {
    if (!deck) return;
    const existing = deckCardFor(userCardId);
    if (existing) {
      await fetch(`/api/deck/${existing.id}`, { method: "DELETE" });
      setDeck({ ...deck, deckCards: deck.deckCards.filter((dc) => dc.id !== existing.id) });
    } else {
      if (deck.deckCards.length >= DECK_LIMIT) return;
      const res = await fetch("/api/deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCardId }),
      });
      if (res.ok) {
        const dc = await res.json();
        setDeck({ ...deck, deckCards: [...deck.deckCards, { id: dc.id, userCardId }] });
      }
    }
  };

  const deckCount = deck?.deckCards.length ?? 0;
  const deckMembers = (deck?.deckCards ?? [])
    .map((dc) => userCards.find((uc) => uc.id === dc.userCardId))
    .filter((uc): uc is UserCard => Boolean(uc));

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold">Minha Coleção</h1>
          <p className="text-sm text-ink-dim">
            Monte um deck de até {DECK_LIMIT} pokémons para batalhar.
          </p>
        </div>
      </div>

      {/* Deck */}
      <section className="mb-8 rounded-2xl border border-edge bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <SwordsIcon size={18} className="text-poke" />
            Deck de batalha
            <span className="text-sm font-normal text-ink-dim">
              {deckCount}/{DECK_LIMIT}
            </span>
          </h2>
          {deckCount > 0 && (
            <Link
              href="/battle"
              className="rounded-lg bg-poke px-4 py-2 text-sm font-bold text-white hover:bg-poke-dark transition-colors"
            >
              Batalhar
            </Link>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: DECK_LIMIT }, (_, i) => {
            const member = deckMembers[i];
            const pokemon = member ? details[member.pokemonId] : undefined;
            return (
              <div
                key={i}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl border ${
                  member ? "border-poke/50 bg-surface-2" : "border-dashed border-edge"
                }`}
              >
                {pokemon ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI */}
                    <img
                      src={pokemon.sprites.front_default ?? pokemon.sprites.artwork ?? ""}
                      alt={pokemon.name}
                      className="h-14 w-14 object-contain"
                    />
                    <span className="text-[10px] font-bold uppercase">{pokemon.name}</span>
                  </>
                ) : member ? (
                  <span className="text-xs text-ink-dim">#{member.pokemonId}</span>
                ) : (
                  <span className="text-xl text-edge">+</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {loading && <p className="text-center text-ink-dim">Carregando coleção...</p>}

      {!loading && userCards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-edge p-10 text-center">
          <p className="mb-2 font-bold">Sua coleção está vazia</p>
          <p className="mb-4 text-sm text-ink-dim">
            Capture pokémons na PokéDex para começar.
          </p>
          <Link
            href="/"
            className="rounded-lg bg-poke px-4 py-2 text-sm font-bold text-white hover:bg-poke-dark transition-colors"
          >
            Ir para a PokéDex
          </Link>
        </div>
      )}

      {/* Coleção */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {userCards.map((uc) => {
          const pokemon = details[uc.pokemonId];
          const inDeck = Boolean(deckCardFor(uc.id));
          return (
            <div
              key={uc.id}
              className={`flex flex-col rounded-2xl border bg-surface p-3 transition-colors ${
                inDeck ? "border-poke/60" : "border-edge hover:border-ink-dim"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-ink-dim">
                  #{String(uc.pokemonId).padStart(4, "0")}
                </span>
                <div className="flex flex-col items-end gap-1">
                  {pokemon?.types.map((t) => (
                    <TypeBadge key={t.type.name} type={t.type.name} small />
                  ))}
                </div>
              </div>

              <Link
                href={`/pokemon/${uc.pokemonId}`}
                className="flex flex-1 flex-col items-center justify-center py-1"
              >
                {pokemon && (
                  // eslint-disable-next-line @next/next/no-img-element -- sprite da PokéAPI
                  <img
                    src={pokemon.sprites.artwork ?? pokemon.sprites.front_default ?? ""}
                    alt={pokemon.name}
                    loading="lazy"
                    className="h-24 w-24 object-contain"
                  />
                )}
                <span className="mt-1 font-bold capitalize">
                  {pokemon?.name ?? `#${uc.pokemonId}`}
                </span>
              </Link>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => toggleDeck(uc.id)}
                  disabled={!deck || (!inDeck && deckCount >= DECK_LIMIT)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-bold cursor-pointer border-0 transition-colors disabled:opacity-40 ${
                    inDeck
                      ? "bg-poke text-white hover:bg-poke-dark"
                      : "bg-surface-2 text-ink-dim hover:text-ink"
                  }`}
                >
                  {inDeck ? "No deck ✓" : "+ Deck"}
                </button>
                <button
                  onClick={() => removerPokemon(uc.id)}
                  className="rounded-lg bg-surface-2 px-2 py-1.5 text-xs font-bold text-bad/80 hover:text-bad cursor-pointer border-0 transition-colors"
                >
                  Soltar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
