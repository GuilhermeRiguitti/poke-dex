import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/src/lib/auth";
import { getQueueDeck } from "@/src/modules/battle";
import BattleMatchmaker from "@/src/modules/battle/ui/BattleMatchmaker";

export default async function BattleQueuePage() {
  // O layout de (game) já barra quem não tem sessão; aqui a sessão é lida de
  // novo porque a página precisa do userId — e é isso que garante que ela seja
  // dinâmica por mérito próprio, sem depender do layout pra não ser
  // pré-renderizada no build.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Antes: fetch("/api/deck") num useEffect, com "Carregando seu deck..." e um
  // redirect no 401. Nada disso precisa existir agora que a página é servidor.
  const deck = await getQueueDeck(session.user.id);

  return (
    <BattleMatchmaker deck={deck}>
      <h1 className="mt-5 font-title text-4xl uppercase tracking-wide">
        Arena de <span className="text-flare">Batalha</span>
      </h1>
      <p className="mt-2 max-w-md text-sm font-semibold text-ink-dim">
        Batalhas PvP por turnos contra outros treinadores, com seu deck de até 6 pokémons.
      </p>
    </BattleMatchmaker>
  );
}
