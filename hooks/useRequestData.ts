"use client";

import axios from "axios";
import { useEffect, useState } from "react";

export interface PokemonStat {
  base_stat: number;
  stat: { name: string };
}

export interface PokemonMove {
  move: { name: string };
}

export interface PokemonType {
  type: { name: string };
}

export interface PokemonSprites {
  front_default: string;
  back_default: string;
}

export interface PokemonListItem {
  name: string;
  url: string;
}

export type UseRequestDataReturn = [
  PokemonListItem[],
  number | string,
  string,
  PokemonStat[],
  PokemonSprites,
  PokemonMove[],
  PokemonType[],
  boolean,
  string
];

export function useRequestData(url: string): UseRequestDataReturn {
  const [pokemons, setPokemons] = useState<PokemonListItem[]>([]);
  const [id, setId] = useState<number | string>("");
  const [name, setName] = useState<string>("");
  const [data, setData] = useState<PokemonStat[]>([]);
  const [sprites, setSprites] = useState<PokemonSprites>({
    front_default: "",
    back_default: "",
  });
  const [moves, setMoves] = useState<PokemonMove[]>([]);
  const [types, setTypes] = useState<PokemonType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const fetchData = (url: string) => {
    setIsLoading(true);
    axios
      .get(url, { headers: { "Content-Type": "application/json" } })
      .then((res) => {
        setPokemons(res.data.results ?? []);
        setId(res.data.id ?? "");
        setName(res.data.name ?? "");
        setData(res.data.stats ?? []);
        setSprites(res.data.sprites ?? { front_default: "", back_default: "" });
        setMoves(res.data.moves ?? []);
        setTypes(res.data.types ?? []);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Erro desconhecido");
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchData(url);
  }, [url]);

  return [pokemons, id, name, data, sprites, moves, types, isLoading, error];
}
