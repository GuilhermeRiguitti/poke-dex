import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/src/lib/auth";
import { readBattleState } from "@/src/modules/battle";
import BattleRoom from "@/src/modules/battle/ui/BattleRoom";
import BattleRoomShell from "@/src/modules/battle/ui/BattleRoomShell";

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // Leitura PURA, de propósito: o render não resolve turno e não toca a rede.
  // Resolver aqui significaria pendurar a página numa possível chamada à
  // PokéAPI (cache miss da matriz de tipos) — PokéAPI lenta = página de erro
  // em vez da batalha. Quem resolve o turno é o polling de /status, a cada 2s,
  // com a mesa já desenhada. Ver readBattleState.
  //
  // Efeito colateral bom: sem escrita no render, a página é inofensiva mesmo
  // se um dia for pré-renderizada ou prefetchada.
  const result = await readBattleState(id, session.user.id);

  // Não sou participante → 404, não 403: não vazo nem a existência da partida.
  if ("error" in result) notFound();

  return (
    <BattleRoomShell>
      <BattleRoom battleId={id} myUserId={session.user.id} initialBattle={result.battle} />
    </BattleRoomShell>
  );
}
