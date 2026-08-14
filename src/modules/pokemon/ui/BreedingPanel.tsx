"use client";

// A tela do cruzamento: escolhe dois cards, vê o que sairia, confirma.
// Costura — a regra de texto está no `breedingView`, a de negócio no command.
//
// As cartas vêm JÁ PRONTAS por prop (a page é servidor). O único fetch de
// cliente aqui é o PREVIEW, e ele existe porque depende de uma escolha que só
// acontece depois da primeira pintura — não é o "useEffect que busca os dados da
// primeira pintura" que a regra 1 manda matar.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CollectionCardDTO } from "@/src/modules/pokedex";
import type { BreedingPreviewDTO } from "../queries/getBreedingPreview";
import { breedingPanelView } from "./breedingView";

export default function BreedingPanel({
  cards,
  usedToday,
}: {
  cards: CollectionCardDTO[];
  usedToday: boolean;
}) {
  const router = useRouter();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  // O preview guarda o PAR que o gerou. Assim trocar de carta invalida o
  // resultado antigo por derivação, em vez de por um setState dentro do efeito
  // — que além de proibido pelo lint, pisca a tela com o valor velho por um
  // frame antes de limpar.
  const [preview, setPreview] = useState<{ par: string; dados: BreedingPreviewDTO | null } | null>(
    null,
  );
  const [enviando, setEnviando] = useState(false);
  const [nascido, setNascido] = useState<string | null>(null);

  const par = a && b && a !== b ? `${a}|${b}` : null;
  const previewAtual = preview?.par === par ? preview.dados : null;
  // "Carregando" não é estado — é a AUSÊNCIA de resposta pro par escolhido.
  // Guardar num useState separado obrigaria a sincronizar duas verdades (e a
  // chamar setState dentro do efeito, que o lint proíbe com razão).
  const carregandoPreview = par !== null && preview?.par !== par;

  useEffect(() => {
    if (!par) return;
    let ignorar = false;

    (async () => {
      const [ida, volta] = par.split("|");
      const res = await fetch(`/api/breeding?a=${ida}&b=${volta}`);
      const body = res.ok ? ((await res.json()) as BreedingPreviewDTO) : null;
      if (ignorar) return;
      setPreview({ par, dados: body });
    })();

    return () => {
      ignorar = true;
    };
  }, [par]);

  const view = breedingPanelView({
    parentAId: a,
    parentBId: b,
    preview: previewAtual,
    usedToday,
    loading: carregandoPreview,
  });

  async function cruzar() {
    if (!view.canBreed || enviando) return;
    setEnviando(true);
    const res = await fetch("/api/breeding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentAId: a, parentBId: b }),
    });
    setEnviando(false);
    if (!res.ok) {
      router.refresh(); // pega o `usedToday` novo, se foi esse o caso
      return;
    }
    setNascido(view.childName);
    setA(null);
    setB(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-edge bg-panel-2/50 p-4">
        <p className="text-sm text-ink">{view.message}</p>
        {view.childSpriteUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.childSpriteUrl} alt="" className="mt-2 h-24 w-24 object-contain" />
        )}
        <button
          type="button"
          onClick={cruzar}
          disabled={!view.canBreed || enviando}
          className="mt-3 cursor-pointer bg-flare px-5 py-2 font-semibold text-bg transition hover:bg-flare-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {view.buttonLabel}
        </button>
        {nascido && (
          <p className="mt-3 text-sm text-ok">
            Nasceu um {nascido.replace(/-/g, " ")}! Ele já está na sua coleção.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Escolha titulo="Primeira carta" cards={cards} valor={a} onChange={setA} />
        <Escolha titulo="Segunda carta" cards={cards} valor={b} onChange={setB} />
      </div>
    </div>
  );
}

function Escolha({
  titulo,
  cards,
  valor,
  onChange,
}: {
  titulo: string;
  cards: CollectionCardDTO[];
  valor: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-dim">{titulo}</span>
      <select
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="border border-edge bg-panel-2 px-2 py-2 capitalize text-ink"
      >
        <option value="">—</option>
        {cards.map((c) => (
          <option key={c.userPokemonId} value={c.userPokemonId}>
            {(c.pokemon?.name ?? "?").replace(/-/g, " ")} · Nv {c.level}
          </option>
        ))}
      </select>
    </label>
  );
}
