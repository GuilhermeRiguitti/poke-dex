"use client";

import { useState } from "react";
import type { DeckCardDTO } from "@/src/modules/deck/ui/types";
import { useDeckEditor } from "@/src/modules/deck/ui/DeckEditorProvider";
import SkillSheet from "@/src/modules/pokemon/ui/SkillSheet";
import OfferTradeDialog from "@/src/modules/trade/ui/OfferTradeDialog";

// O rodapé do card da coleção: ver as skills, e pôr/tirar do time.
//
// Deixou de ser um POST (2026-08-06): agora mexe no RASCUNHO do deck, que vive
// no cliente. Nada vai pro banco aqui — quem grava é o botão de salvar do
// painel do deck.
//
// O botão continua existindo mesmo com o arrasto: no celular o gesto vertical é
// rolar a coleção, então arrastar não é o caminho lá. Ele põe na PRIMEIRA VAGA
// LIVRE — sem mira não há como escolher a posição, e depois o jogador
// reposiciona arrastando (ou no desktop já solta na vaga que quer).
//
// A carta que já está no time mostra ✕ no lugar do ✓: a coleção lista tudo
// agora (inclusive quem está montado), então tirar do time também pode acontecer
// daqui — é o gesto que a carta marcada convida.

export default function CollectionCardActions({
  card,
  name,
  level,
}: {
  card: DeckCardDTO;
  name: string;
  level: number;
}) {
  const editor = useDeckEditor();
  const [vendoSkills, setVendoSkills] = useState(false);
  const [oferecendo, setOferecendo] = useState(false);

  const vaga = editor?.vagaDe(card.userPokemonId) ?? null;
  const noTime = vaga !== null;
  const podeMexer = !!editor?.editing && !editor?.salvando;

  return (
    <>
      {/* DOIS botões iguais, lado a lado. Sem rótulo de propósito: o rodapé da
          carta é estreito e qualquer palavra ali disputa atenção com o nome e os
          stats, que são o que a carta existe pra mostrar.

          ☰ abre o repertório (e é o único lugar onde se ensina TM).
          ✓ põe no time · ✕ tira. */}
      <span className="flex items-center gap-1.5">
        <button
          onClick={() => setVendoSkills(true)}
          aria-label={`Ver as skills de ${name}`}
          title="Skills e TMs"
          className={BOTAO}
        >
          ☰
        </button>

        {/* ⇄ oferece a carta pra troca. Fica escondido enquanto ela está no
            time: o servidor recusaria com `in_deck`, e botão que só serve pra
            dar erro é pior que botão ausente. */}
        {!noTime && (
          <button
            onClick={() => setOferecendo(true)}
            aria-label={`Oferecer ${name} para troca`}
            title="Oferecer para troca"
            className={BOTAO}
          >
            ⇄
          </button>
        )}

        {editor && (
          <button
            onClick={() => (noTime ? editor.tirarDaVaga(vaga) : editor.porNoTime(card))}
            disabled={!podeMexer}
            aria-label={noTime ? `Tirar ${name} do time` : `Pôr ${name} no time`}
            title={
              !podeMexer
                ? "Entre em «editar deck» para mexer no time"
                : noTime
                  ? `Na vaga ${vaga + 1} — tirar do time`
                  : "Pôr no time"
            }
            className={`${BOTAO} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {noTime ? "✕" : "✓"}
          </button>
        )}
      </span>

      {vendoSkills && (
        <SkillSheet
          userPokemonId={card.userPokemonId}
          name={name.replace(/-/g, " ")}
          level={level}
          onClose={() => setVendoSkills(false)}
        />
      )}

      {oferecendo && (
        <OfferTradeDialog
          userPokemonId={card.userPokemonId}
          name={name}
          onClose={() => setOferecendo(false)}
        />
      )}
    </>
  );
}

/** Os dois botões do rodapé são o MESMO botão — só muda o glifo. */
const BOTAO =
  "clip-btn flex h-7 w-7 flex-none cursor-pointer items-center justify-center border-0 bg-panel-2/70 text-xs font-bold leading-none text-ink-dim/70 transition-colors hover:bg-panel-2 hover:text-ink";
