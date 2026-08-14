"use client";

// O painel das quests diárias. Recebe tudo pronto por prop (a page é servidor);
// o único fetch aqui é o RESGATE, que é ação do jogador.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { questBoardView } from "./questView";
import type { QuestBoardDTO } from "./types";

export default function QuestPanel({ board }: { board: QuestBoardDTO }) {
  const router = useRouter();
  const [resgatando, setResgatando] = useState<string | null>(null);

  const views = questBoardView(board.quests);

  async function resgatar(questId: string) {
    if (resgatando) return;
    setResgatando(questId);
    await fetch("/api/quests/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questId }),
    });
    setResgatando(null);
    router.refresh();
  }

  return (
    <section className="clip-card border border-edge bg-panel-2 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-title text-lg uppercase tracking-wide">Objetivos do dia</h2>
        <span className="text-xs font-semibold text-ink-dim">
          {board.tutorTokens} {board.tutorTokens === 1 ? "token" : "tokens"} de tutor
        </span>
      </div>

      <ul className="flex flex-col gap-3">
        {views.map((q) => (
          <li key={q.questId} className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">{q.label}</span>
              <span className="mt-1 block h-1.5 w-full bg-panel">
                <span
                  className={`block h-full ${q.state === "doing" ? "bg-energy" : "bg-ok"}`}
                  style={{ width: `${q.percent}%` }}
                />
              </span>
            </span>

            <span className="flex-none text-xs font-semibold text-ink-dim">{q.counter}</span>

            {q.showClaim ? (
              <button
                type="button"
                onClick={() => resgatar(q.questId)}
                disabled={resgatando === q.questId}
                className="flex-none cursor-pointer bg-flare px-3 py-1 text-xs font-semibold text-bg transition hover:bg-flare-dark disabled:opacity-40"
              >
                Resgatar
              </button>
            ) : (
              <span className="flex-none text-xs text-ink-dim">
                {q.state === "claimed" ? "✓" : ""}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-ink-dim">
        Cada objetivo completo dá 1 token de tutor, que ensina um golpe de tutor a
        um pokémon que a espécie aprende assim. Os objetivos viram à meia-noite UTC.
      </p>
    </section>
  );
}
