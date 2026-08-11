"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { typeColor } from "@/src/lib/typeColors";
import type { LearnsetMoveDTO } from "@/src/modules/pokemon/ui/types";
import type { TeachTmResponseDTO } from "./types";

// O repertório de UM pokémon da coleção, e o único lugar onde se ENSINA TM.
//
// Existe porque a escolha da barra de golpes mudou de lugar: ela virou decisão
// de batalha (você monta ao pôr o pokémon em campo). Mas a batalha só oferece o
// que JÁ está liberado — sem esta tela não haveria onde ver o que falta nem onde
// gastar um token de TM. É a metade "gerenciar" que o LoadoutBuilder fazia junto
// com a montagem, agora separada dela.
//
// Três situações por carta, e a tela precisa deixar as três óbvias:
//  - já sabe        → entra na batalha
//  - aprende no nv X → nada a fazer além de subir de nível
//  - TM             → dá pra ensinar agora, gastando 1 token

interface Resposta {
  moves: LearnsetMoveDTO[];
  tmTokens: number;
}

export default function SkillSheet({
  userPokemonId,
  name,
  level,
  onClose,
}: {
  userPokemonId: string;
  name: string;
  level: number;
  onClose: () => void;
}) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [ensinando, setEnsinando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch(`/api/training/skills/${userPokemonId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falhou"))))
      .then((d: Resposta) => vivo && setDados(d))
      .catch(() => vivo && setErro("Não deu pra carregar as skills"));
    return () => {
      vivo = false;
    };
  }, [userPokemonId]);

  // Trava o scroll do fundo enquanto o painel está aberto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  /**
   * Ensina uma TM gastando 1 token. A regra é do SERVIDOR (`applyTM`, com claim
   * otimista no saldo); aqui só refletimos a resposta — a carta destravada e o
   * saldo novo — sem refazer o fetch inteiro.
   */
  const ensinar = async (moveId: string) => {
    setEnsinando(moveId);
    setErro("");
    try {
      const res = await fetch("/api/training/tm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPokemonId, moveId }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<TeachTmResponseDTO> & { error?: string };

      if (!res.ok) {
        setErro(
          data.error === "no_tokens"
            ? "Você não tem tokens de TM"
            : data.error === "already_known"
              ? "Ele já sabe essa"
              : "Não deu pra ensinar essa skill"
        );
        return;
      }

      setDados((d) =>
        d == null
          ? d
          : {
              tmTokens: data.tmTokens ?? d.tmTokens,
              moves: d.moves.map((m) => (m.moveId === moveId ? { ...m, unlocked: true } : m)),
            }
      );
    } finally {
      setEnsinando(null);
    }
  };

  const sabe = dados?.moves.filter((m) => m.unlocked) ?? [];
  const porTm = dados?.moves.filter((m) => !m.unlocked && m.teachableViaTm) ?? [];
  const porNivel = dados?.moves.filter((m) => !m.unlocked && !m.teachableViaTm) ?? [];

  // PORTAL PRO BODY, e não um `fixed` no lugar onde o componente vive.
  //
  // Este painel é aberto de dentro da carta da coleção, e a carta tem
  // `transform` (o tilt 3D do HoloCard). Ancestral com `transform` vira bloco
  // contentor pra `position: fixed` — sem o portal, o `inset-0` mede a CARTA em
  // vez da viewport e o painel fica preso dentro dela, com a arte por cima. É o
  // mesmo problema que o `backdrop-blur` do header causou no drawer do NavBar.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4" onClick={onClose}>
      <div
        className="clip-card flex max-h-full w-full max-w-lg flex-col border border-edge bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-none items-center gap-3 border-b border-edge p-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-title text-lg uppercase tracking-wider">{name}</h2>
            <p className="text-sm font-semibold text-ink-dim">
              Nível {level} · {sabe.length} skills liberadas
            </p>
          </div>
          <span
            className="clip-btn flex-none bg-panel-2 px-3 py-1.5 font-title text-sm tracking-wide text-ink-dim"
            title="Tokens de TM — ganhos no check-in diário"
          >
            🔧 {dados?.tmTokens ?? 0} TM
          </span>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center border-0 bg-panel-2 text-xs font-bold text-ink-dim transition-colors hover:bg-bad hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {erro && <p className="mb-2 text-center text-sm font-semibold text-bad">{erro}</p>}
          {!dados && !erro && (
            <p className="p-4 text-center text-sm font-semibold text-ink-dim">Carregando…</p>
          )}

          {dados && (
            <div className="flex flex-col gap-4">
              <Secao titulo="Já sabe" vazio="Nenhuma ainda — suba de nível.">
                {sabe.map((m) => (
                  <Linha key={m.moveId} move={m}>
                    <span className="font-title text-xs text-ok">✓ em campo</span>
                  </Linha>
                ))}
              </Secao>

              <Secao titulo="Ensinar por TM" vazio="Nenhuma TM disponível pra esta espécie.">
                {porTm.map((m) => (
                  <Linha key={m.moveId} move={m}>
                    <button
                      onClick={() => ensinar(m.moveId)}
                      disabled={ensinando !== null || (dados.tmTokens ?? 0) < 1}
                      className="clip-btn flex-none bg-flare px-2.5 py-1 font-title text-[10px] uppercase tracking-wider text-white transition-colors hover:bg-flare-dark disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {ensinando === m.moveId ? "..." : "Ensinar (1 TM)"}
                    </button>
                  </Linha>
                ))}
              </Secao>

              <Secao titulo="Aprende subindo de nível" vazio="Não há mais nada por nível.">
                {porNivel.map((m) => (
                  <Linha key={m.moveId} move={m}>
                    <span className="font-title text-xs text-ink-dim">nv. {m.levelLearnedAt}</span>
                  </Linha>
                ))}
              </Secao>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Secao({
  titulo,
  vazio,
  children,
}: {
  titulo: string;
  vazio: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 font-title text-[11px] uppercase tracking-widest text-ink-dim">
        {titulo}
      </h3>
      {children.length === 0 ? (
        <p className="px-1 py-2 text-xs font-semibold text-ink-dim/60">{vazio}</p>
      ) : (
        <div className="flex flex-col gap-1.5">{children}</div>
      )}
    </section>
  );
}

function Linha({ move, children }: { move: LearnsetMoveDTO; children: React.ReactNode }) {
  return (
    <div
      className={`clip-btn flex items-center gap-2.5 border border-edge p-2 ${
        move.unlocked ? "" : "opacity-70"
      }`}
    >
      <span
        className="clip-btn flex-none px-2 py-1 font-title text-[10px] uppercase tracking-wider text-bg"
        style={{ background: typeColor(move.type) }}
      >
        {move.type}
      </span>
      <span className="min-w-0 flex-1 truncate font-title text-sm uppercase tracking-wide">
        {move.name.replace(/-/g, " ")}
      </span>
      <span className="flex-none font-title text-xs text-ink-dim">
        {move.power != null ? `PWR ${move.power}` : "STATUS"}
      </span>
      {children}
    </div>
  );
}
