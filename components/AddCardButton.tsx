"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddCardButton({ pokemonId, saved }: { pokemonId: number; saved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (saved || done) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-ok/15 px-3 py-1.5 text-xs font-bold text-ok">
        ✓ Na coleção
      </span>
    );
  }

  const capture = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pokemonId }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={capture}
      disabled={busy}
      className="rounded-lg bg-poke px-3 py-1.5 text-xs font-bold text-white hover:bg-poke-dark disabled:opacity-50 cursor-pointer border-0 transition-colors"
    >
      {busy ? "..." : "Capturar"}
    </button>
  );
}
