import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/modules/auth/auth";
import { readMyTradeOffers } from "@/src/modules/trade";
import TradeBoard from "@/src/modules/trade/ui/TradeBoard";

// Page é SERVIDOR (CLAUDE.md regra 1): lê as ofertas no banco e passa pintadas.
// Sem "use client", sem fetch de primeira pintura, sem estado de "Carregando…".
//
// `readMyTradeOffers` só LÊ — pode ser chamada do render (regra 2). A faxina de
// oferta vencida NÃO acontece aqui: render não escreve. As vencidas são
// filtradas na leitura e recusadas no aceite.
export default async function TradePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { offers } = await readMyTradeOffers(session.user.id);

  return (
    <div className="pt-8">
      <div className="mb-8">
        <h1 className="font-title text-3xl uppercase tracking-wide">Trocas</h1>
        <p className="text-sm font-semibold text-ink-dim">
          Troca é por código: quem oferece gera, quem recebe cola. Nada de nome,
          e-mail ou lista de amigos.
        </p>
      </div>

      <TradeBoard offers={offers} />
    </div>
  );
}
