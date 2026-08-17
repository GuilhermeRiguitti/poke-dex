import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/src/modules/auth/auth";
import { readBattleState } from "@/src/modules/battle";
import BattleRoom from "@/src/modules/battle/ui/BattleRoom";

type BattlePageProps = {
  params: Promise<{ id: string }>;
}

export default async function BattlePage({ params }: BattlePageProps) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const result = await readBattleState(id, session.user.id);

  // Não sou participante → 404, não 403: não vazo nem a existência da partida.
  if ("error" in result) notFound();

  return (
    // TELA CHEIA, sem navbar (ver o layout do grupo (arena)): o palco 3D é o
    // CENÁRIO, não um quadro. Sem max-width de propósito — travar a largura
    // deixaria tarja preta em monitor largo.
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <BattleRoom battleId={id} myUserId={session.user.id} initialBattle={result.battle} />
    </div>
  );
}
