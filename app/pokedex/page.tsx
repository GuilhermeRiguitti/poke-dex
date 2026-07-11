"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NormalizedPokemon } from "@/lib/pokeapi";

interface UserCard {
  id: string;
  pokemonId: number;
  addedAt: string;
}

interface BattleStat {
  base_stat: number;
  stat: { name: string };
}

export default function PokedexPage() {
  const router = useRouter();
  const [userCards, setUserCards] = useState<UserCard[]>([]);
  const [details, setDetails] = useState<Record<number, NormalizedPokemon>>({});
  const [listaBatalha1, setListaBatalha1] = useState<BattleStat[]>([]);
  const [listaBatalha2, setListaBatalha2] = useState<BattleStat[]>([]);
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
  }, [router]);

  const pokemonsBatalha = (uc: UserCard) => {
    const stats = details[uc.pokemonId]?.stats ?? [];
    if (listaBatalha1.length === 0) setListaBatalha1(stats);
    else setListaBatalha2(stats);
  };

  const removerPokemon = async (userCardId: string) => {
    await fetch(`/api/cards/${userCardId}`, { method: "DELETE" });
    setUserCards((prev) => prev.filter((c) => c.id !== userCardId));
  };

  return (
    <div
      className="bg-no-repeat bg-cover h-max pb-12"
      style={{
        backgroundImage: "url('https://wallpaperaccess.com/full/45664.jpg')",
      }}
    >
      <nav className="grid grid-cols-[1fr_2fr_1fr] w-full items-center justify-items-center h-max">
        <Link href="/">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Pok%C3%A9_Ball_icon.svg/1200px-Pok%C3%A9_Ball_icon.svg.png"
            alt="Home"
            className="w-20 h-20 cursor-pointer"
          />
        </Link>
        <Link href="/">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/2000px-International_Pok%C3%A9mon_logo.svg.png"
            alt="Pokémon"
            className="w-[300px] h-[70px] p-2.5 cursor-pointer"
          />
        </Link>
      </nav>

      {loading && <p className="text-white text-center mt-8">Carregando...</p>}

      {/* Cards da PokéDex */}
      <div className="grid grid-cols-2 justify-items-center md:grid-cols-5">
        {userCards.map((uc) => {
          const pokemon = details[uc.pokemonId];
          return (
            <div
              key={uc.id}
              className="border border-green-500 w-[164px] h-[230px] flex flex-col justify-end items-center m-[50px] rounded-[10px] shadow-[3px_3px_4px_#77361a]"
              style={{
                backgroundImage: "url('/card.png')",
                backgroundColor: "#1BB06E99",
              }}
            >
              <button
                onClick={() => pokemonsBatalha(uc)}
                className="bg-transparent border-0 cursor-pointer"
              >
                <img
                  src="https://cdn-icons-png.flaticon.com/512/1732/1732452.png"
                  alt="batalha"
                  className="w-[30%] -mb-10 mr-[220px]"
                />
              </button>
              {pokemon && (
                <img
                  src={pokemon.sprites.artwork ?? pokemon.sprites.front_default ?? ""}
                  alt={pokemon.name}
                  className="w-full -mb-[15px]"
                />
              )}
              <p className="text-white font-semibold">
                {(pokemon?.name ?? `#${uc.pokemonId}`).toUpperCase()}
              </p>
              <div className="grid grid-cols-2">
                <button
                  onClick={() => removerPokemon(uc.id)}
                  className="bg-transparent px-1.5 py-1.5 rounded-[15px] mx-1 border-0 text-green-600 cursor-pointer"
                >
                  Remover
                </button>
                <button
                  onClick={() => router.push(`/pokemon/${uc.pokemonId}`)}
                  className="bg-transparent px-1.5 py-1.5 rounded-[15px] mx-1 border-0 text-green-600 cursor-pointer"
                >
                  Detalhes
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Batalha */}
      <div className="flex justify-center mt-[100px] text-xl font-bold text-white">
        Compare Dois Pokémons!
      </div>

      <div className="flex justify-center mt-2 text-lg font-bold text-green-400">
        Oponente 1
      </div>
      <div className="flex justify-center text-white">
        {listaBatalha1.map((s, i) => (
          <p key={i} className="font-bold mx-2">
            {s.stat.name.toUpperCase()}: {s.base_stat} ||
          </p>
        ))}
      </div>

      <div className="flex justify-center mt-2 text-lg font-bold text-green-400">
        Oponente 2
      </div>
      <div className="flex justify-center text-white">
        {listaBatalha2.map((s, i) => (
          <p key={i} className="font-bold mx-2">
            {s.stat.name.toUpperCase()}: {s.base_stat} ||
          </p>
        ))}
      </div>
    </div>
  );
}
