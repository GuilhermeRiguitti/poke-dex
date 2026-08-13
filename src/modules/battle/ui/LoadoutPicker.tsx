"use client";

import { useEffect, useState } from "react";
import { typeColor } from "@/src/lib/typeColors";
import { CARDS_PER_SLOT } from "@/src/modules/deck/domain/rules";
import { moveEffectLabel } from "./battleView";
import type { LoadoutOptionDTO } from "./types";

// A escolha das skills do pokémon que vai ENTRAR em campo.
//
// Isto era o LoadoutBuilder da coleção: montar a barra deixou de ser decisão de
// deck e virou decisão de BATALHA. Você escolhe no momento de pôr o pokémon em
// jogo, sem ver o que o oponente está fazendo — mais uma aposta no turno
// simultâneo.
//
// As opções vêm de GET /api/battle/[id]/loadout?slot=N, que só devolve o MEU
// time: pendurar o learnset no BattleDTO (que leva os dois lados) entregaria o
// repertório possível do meu time ao adversário.

export default function LoadoutPicker({
  battleId,
  slot,
  pokemonName,
  title,
  confirmLabel,
  submitting,
  onConfirm,
  onCancel,
}: {
  battleId: string;
  slot: number;
  pokemonName: string;
  title: string;
  confirmLabel: string;
  submitting: boolean;
  onConfirm: (moveIds: string[]) => void;
  onCancel?: () => void;
}) {
  const [opcoes, setOpcoes] = useState<LoadoutOptionDTO[] | null>(null);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const [erro, setErro] = useState("");

  // Sem reset de estado aqui: quem monta este componente passa `key={slot}`, e
  // o React remonta com o estado inicial quando o slot muda. Zerar por setState
  // dentro do efeito dispara render em cascata (e o lint reclama, com razão).
  useEffect(() => {
    let vivo = true;

    fetch(`/api/battle/${battleId}/loadout?slot=${slot}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falhou"))))
      .then((cartas: LoadoutOptionDTO[]) => {
        if (!vivo) return;
        const livres = cartas.filter((c) => c.unlocked);
        setOpcoes(livres);
        // Já vem com as mais fortes marcadas: a maioria das entradas é no meio
        // da partida, com o relógio correndo — abrir vazio obrigaria a montar do
        // zero toda vez.
        setEscolhidas(
          [...livres]
            .sort((a, b) => (b.power ?? -1) - (a.power ?? -1))
            .slice(0, CARDS_PER_SLOT)
            .map((c) => c.moveId)
        );
      })
      .catch(() => vivo && setErro("Não deu pra carregar as skills"));

    return () => {
      vivo = false;
    };
  }, [battleId, slot]);

  const alternar = (moveId: string) => {
    setEscolhidas((atual) => {
      if (atual.includes(moveId)) return atual.filter((m) => m !== moveId);
      if (atual.length >= CARDS_PER_SLOT) return atual;
      return [...atual, moveId];
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4">
      <div className="clip-card flex max-h-full w-full max-w-lg flex-col border border-edge bg-panel">
        <div className="flex-none border-b border-edge p-4">
          <h2 className="font-title text-lg uppercase tracking-wider">{title}</h2>
          <p className="mt-1 text-sm font-semibold text-ink-dim">
            {pokemonName} · escolha até {CARDS_PER_SLOT} skills ({escolhidas.length}/{CARDS_PER_SLOT})
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {erro && <p className="p-4 text-center text-sm font-semibold text-bad">{erro}</p>}
          {!erro && opcoes === null && (
            <p className="p-4 text-center text-sm font-semibold text-ink-dim">Carregando skills…</p>
          )}
          {opcoes?.length === 0 && (
            <p className="p-4 text-center text-sm font-semibold text-ink-dim">
              Esse pokémon ainda não liberou nenhuma skill.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            {opcoes?.map((carta) => {
              const marcada = escolhidas.includes(carta.moveId);
              const cor = typeColor(carta.type);
              // O que a carta FAZ, na própria linha: sem isso o seletor mostrava
              // "STATUS" e nada mais, e escolher um golpe de efeito era aposta
              // no escuro. É a mesma etiqueta da barra de comando.
              const efeito = moveEffectLabel(carta.effect);
              return (
                <button
                  key={carta.moveId}
                  onClick={() => alternar(carta.moveId)}
                  className={`clip-btn flex items-center gap-2.5 border p-2 text-left transition-colors ${
                    marcada ? "border-energy bg-energy/10" : "border-edge hover:border-ink-dim"
                  }`}
                >
                  <span
                    className="clip-btn flex-none px-2 py-1 font-title text-[10px] uppercase tracking-wider text-bg"
                    style={{ background: cor }}
                  >
                    {carta.type}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-title text-sm uppercase tracking-wide">{carta.name}</span>
                    {efeito && <span className="text-[10px] font-semibold leading-tight text-energy">{efeito}</span>}
                    {!efeito && carta.power == null && (
                      <span className="text-[10px] font-semibold leading-tight text-ink-dim/60">sem efeito no jogo</span>
                    )}
                  </span>
                  <span className="shrink-0 font-title text-xs text-ink-dim">
                    {carta.power != null ? `PWR ${carta.power}` : "STATUS"}
                  </span>
                  <span className={`shrink-0 font-title text-sm ${marcada ? "text-energy" : "text-ink-dim/40"}`}>
                    {marcada ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-none gap-2 border-t border-edge p-3">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={submitting}
              className="clip-btn border border-edge px-4 py-2.5 font-title text-sm uppercase tracking-wider text-ink-dim disabled:opacity-40"
            >
              Voltar
            </button>
          )}
          <button
            onClick={() => onConfirm(escolhidas)}
            disabled={submitting || escolhidas.length === 0}
            className="clip-btn flex-1 bg-flare px-4 py-2.5 font-title text-sm uppercase tracking-wider text-white transition-colors hover:bg-flare-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Enviando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
