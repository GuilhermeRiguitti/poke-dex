"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toastWarn } from "@/src/layout/toast";
import SkillSheet from "@/src/modules/training/ui/SkillSheet";

// O rodapé do card da coleção: pôr no time.
//
// Virou um POST direto (2026-08-02). Antes abria o LoadoutBuilder pra escolher
// as 6 skills; agora não há o que escolher aqui — a barra é montada na BATALHA,
// no momento em que o pokémon entra em campo. O deck é só o time.
//
// O botão continua existindo mesmo com o arrasto: no celular o gesto vertical é
// rolar a coleção, então arrastar não é o caminho lá.
//
// Tirar do deck não mora aqui: buildCollectionWhere já exclui da coleção quem
// está numa vaga (deckSlots: { none: {} }), então esta carta nunca está "no
// deck" — quem tira é o X dentro do próprio DeckSlots.

export default function CollectionCardActions({
  userPokemonId,
  name,
  level,
}: {
  userPokemonId: string;
  name: string;
  level: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [vendoSkills, setVendoSkills] = useState(false);

  const locked = busy || pending;

  const montar = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/deck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userPokemonId }),
      });

      if (res.ok) {
        // A carta some da coleção assim que entra no deck (o WHERE exclui quem
        // tem vaga) — por isso o refresh aqui não é só "atualizar o deck", é
        // reconsultar a própria listagem paginada.
        startTransition(() => router.refresh());
        return;
      }

      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      toastWarn(
        error === "deck_full"
          ? "O deck já está cheio"
          : error === "invalid_cards"
            ? `${name} ainda não tem nenhum golpe liberado`
            : "Não deu pra pôr no deck"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* DOIS botões iguais, lado a lado. Sem rótulo de propósito: o rodapé da
          carta é estreito e qualquer palavra ali disputa atenção com o nome e os
          stats, que são o que a carta existe pra mostrar.

          ☰ abre o repertório (e é o único lugar onde se ensina TM).
          ✓ põe no time. */}
      <span className="flex items-center gap-1.5">
        <button
          onClick={() => setVendoSkills(true)}
          aria-label={`Ver as skills de ${name}`}
          title="Skills e TMs"
          className={BOTAO}
        >
          ☰
        </button>

        <button
          onClick={montar}
          disabled={locked}
          aria-label={`Pôr ${name} no time`}
          title="Pôr no time"
          className={`${BOTAO} disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {locked ? "·" : "✓"}
        </button>
      </span>

      {vendoSkills && (
        <SkillSheet
          userPokemonId={userPokemonId}
          name={name.replace(/-/g, " ")}
          level={level}
          onClose={() => setVendoSkills(false)}
        />
      )}
    </>
  );
}

/** Os dois botões do rodapé são o MESMO botão — só muda o glifo. */
const BOTAO =
  "clip-btn flex h-7 w-7 flex-none cursor-pointer items-center justify-center border-0 bg-panel-2/70 text-xs font-bold leading-none text-ink-dim/70 transition-colors hover:bg-panel-2 hover:text-ink";
