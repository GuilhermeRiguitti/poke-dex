"use client";

import { useState } from "react";
import { useRequestData } from "@/hooks/useRequestData";
import { useRouter } from "next/navigation";

interface CardComponentProps {
  nomePokemon: string;
  urlPokemon: string;
}

export default function CardComponent({ nomePokemon, urlPokemon }: CardComponentProps) {
  const router = useRouter();
  const [, id, name, data, sprites] = useRequestData(urlPokemon);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const salvarPokemon = async () => {
    setSalvando(true);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pokemonId: id }),
      });
      if (res.ok) setSalvo(true);
      else if (res.status === 401) router.push("/login");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="border-2 border-green-500 rounded-[10px] m-0.5 flex flex-col items-center justify-around shadow-[2px_2px_3px_#77361a]"
      style={{
        backgroundImage: "url('/card.png')",
        backgroundColor: "#1BB06E99",
        width: "90px",
        height: "126px",
      }}
    >
      <p className="text-[8px] mt-0 md:text-[12px] font-semibold">{nomePokemon}</p>

      {sprites.front_default && (
        <img
          src={sprites.front_default}
          alt={name}
          className="w-[50%] -mt-3 -mb-2 md:w-[70%]"
        />
      )}

      <div className="grid w-full ml-5 text-left">
        {data.map((status, i) => (
          <p key={i} className="text-[5px] m-0 ml-0.5 md:text-[8px] font-semibold">
            {status.stat.name.toUpperCase()}: {status.base_stat}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-2">
        <button
          onClick={salvarPokemon}
          disabled={salvando || salvo}
          className="bg-transparent px-0 py-1.5 rounded-[15px] mx-1 border-0 text-green-600 cursor-pointer text-[7px] md:text-[13px] disabled:opacity-50"
        >
          {salvo ? "Salvo!" : salvando ? "..." : "Adicionar"}
        </button>
        <button
          onClick={() => router.push(`/pokemon/${id}`)}
          className="bg-transparent px-0 py-1.5 rounded-[15px] mx-1 border-0 text-green-600 cursor-pointer text-[7px] md:text-[13px]"
        >
          Detalhes
        </button>
      </div>
    </div>
  );
}
