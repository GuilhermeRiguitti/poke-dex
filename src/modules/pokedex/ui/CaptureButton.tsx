"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Uma das DUAS fronteiras "use client" que sobraram na PokéDex. Ela existe
// porque tem evento (o clique) — e não porque a tela precisa buscar dados.
//
// Era src/components/AddCardButton.tsx; veio pra cá porque só a PokéDex usa
// (CLAUDE.md: componente que serve um módulo só mora no ui/ dele).

export default function CaptureButton({
  pokemonId,
  captured,
}: {
  pokemonId: number;
  captured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  if (captured) {
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
      // Sem estado local de "capturei": o servidor é a fonte da verdade, e o
      // refresh re-renderiza a page (que é servidor) com a coleção nova. É por
      // isso que este componente não guarda nada além de "estou ocupado".
      if (res.ok) startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center">
      <button
        onClick={capture}
        disabled={busy || pending}
        className="clip-btn cursor-pointer border-0 bg-flare px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition-all hover:bg-flare-dark active:scale-95 disabled:opacity-50"
      >
        {busy || pending ? "..." : "Capturar"}
      </button>
    </div>
  );
}
