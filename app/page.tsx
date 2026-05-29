"use client";

import { useState, useEffect } from "react";
import { useRequestData } from "@/hooks/useRequestData";
import { URL_BASE } from "@/constants/URL_BASE";
import CardComponent from "@/components/CardComponent";
import { PokemonListItem } from "@/hooks/useRequestData";
import Link from "next/link";

const TOTAL_PAGES = 57;

export default function HomePage() {
  const [contador, setContador] = useState<number>(0);
  const [resultado, setResultado] = useState<PokemonListItem[]>([]);
  const [pokemons, , , , , , , isLoading, error] = useRequestData(
    `${URL_BASE}?offset=${contador}&limit=20`
  );

  useEffect(() => {
    const pokemonsPokeDex: { nome: string }[] = JSON.parse(
      localStorage.getItem("lista-pokemons") ?? "[]"
    );
    const filtrados = pokemons.filter(
      ({ name }) => !pokemonsPokeDex.some(({ nome }) => nome === name)
    );
    setResultado(filtrados);
  }, [pokemons]);

  return (
    <div
      className="bg-no-repeat bg-cover h-max pb-12"
      style={{
        backgroundImage: "url('https://wallpaperaccess.com/full/45664.jpg')",
      }}
    >
      <nav className="grid grid-cols-[1fr_2fr_1fr] w-full items-center justify-items-center h-max">
        <Link href="/pokedex">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Pok%C3%A9_Ball_icon.svg/1200px-Pok%C3%A9_Ball_icon.svg.png"
            alt="PokéDex"
            className="w-20 h-20 cursor-pointer"
          />
        </Link>
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/2000px-International_Pok%C3%A9mon_logo.svg.png"
          alt="Pokémon Logo"
          className="w-[300px] h-[70px] p-2.5"
        />
      </nav>

      <div className="grid grid-cols-3 justify-items-center md:grid-cols-5">
        {isLoading && (
          <p className="col-span-3 md:col-span-5 text-white">Carregando...</p>
        )}
        {!isLoading && error && (
          <p className="col-span-3 md:col-span-5 text-white">Ocorreu um erro</p>
        )}
        {!isLoading && resultado.length === 0 && !error && (
          <p className="col-span-3 md:col-span-5 text-white">
            Nenhum Pokémon disponível
          </p>
        )}
        {!isLoading &&
          resultado.map((pokemon, index) => (
            <CardComponent
              key={index}
              nomePokemon={pokemon.name.toUpperCase()}
              urlPokemon={pokemon.url}
            />
          ))}
      </div>

      <div className="flex flex-wrap justify-center mt-4">
        {Array.from({ length: TOTAL_PAGES }, (_, i) => (
          <button
            key={i}
            onClick={() => setContador(i * 20)}
            className={`border-0 m-0.5 rounded text-white cursor-pointer px-2 py-1 text-sm ${
              contador === i * 20
                ? "bg-orange-600"
                : "bg-[#c95b2c95] hover:bg-orange-500"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
