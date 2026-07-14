"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddCardButton({ pokemonId, saved }: { pokemonId: number; saved: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (saved || done) {
    return (
      <span className="clip-btn inline-flex items-center gap-1 bg-ok/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ok">
        ✓ Capturado
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
      className="clip-btn cursor-pointer border-0 bg-flare px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition-all hover:bg-flare-dark active:scale-95 disabled:opacity-50"
    >
      {busy ? "..." : "Capturar"}
    </button>
  );
}
