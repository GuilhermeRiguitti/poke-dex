"use client";

import { useRequestData } from "@/hooks/useRequestData";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function DetailComponent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [, , name, data, sprites, moves, , isLoading, error] = useRequestData(
    `/api/pokeapi/${params.id}`
  );

  return (
    <div
      className="bg-no-repeat bg-cover pb-12 min-h-screen"
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
        <Link href="/">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/International_Pok%C3%A9mon_logo.svg/2000px-International_Pok%C3%A9mon_logo.svg.png"
            alt="Pokémon"
            className="w-[300px] h-[70px] p-2.5 cursor-pointer"
          />
        </Link>
      </nav>

      {isLoading && (
        <p className="text-white text-center mt-8">Carregando...</p>
      )}
      {!isLoading && error && (
        <p className="text-white text-center mt-8">Ocorreu um erro</p>
      )}
      {!isLoading && name && (
        <div className="flex items-center justify-center w-full">
          <div
            className="grid grid-cols-3 items-center w-[70%] text-white my-[50px] rounded-[9px] shadow-[3px_3px_4px_gray]"
            style={{ backgroundColor: "rgba(0,50,200,0.40)" }}
          >
            <span className="flex flex-col items-center p-4">
              {sprites.front_default && (
                <img
                  src={sprites.front_default}
                  alt={`${name} front`}
                  className="w-1/2 m-2.5 border border-gray-400 rounded-[9px] shadow-[2px_2px_3px_gray]"
                />
              )}
              {sprites.back_default && (
                <img
                  src={sprites.back_default}
                  alt={`${name} back`}
                  className="w-1/2 m-2.5 border border-gray-400 rounded-[9px] shadow-[2px_2px_3px_gray]"
                />
              )}
            </span>

            <span className="p-4">
              <p className="font-bold text-green-400 text-base mb-2">
                POKÉMON: {name.toUpperCase()}
              </p>
              {data.map((status, i) => (
                <p key={i}>
                  {status.stat.name.toUpperCase()}: {status.base_stat}
                </p>
              ))}
            </span>

            <span className="p-4">
              <p className="font-bold text-green-400 text-base mb-2">MOVES</p>
              {moves.slice(0, 4).map((move, i) => (
                <p key={i}>{move.move.name.toUpperCase()}</p>
              ))}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-center mt-4">
        <button
          onClick={() => router.push("/")}
          className="bg-green-700 text-white px-4 py-2 rounded cursor-pointer border-0 hover:bg-green-600"
        >
          Página home
        </button>
        <button
          onClick={() => router.back()}
          className="bg-green-700 text-white px-4 py-2 rounded cursor-pointer border-0 hover:bg-green-600"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}
