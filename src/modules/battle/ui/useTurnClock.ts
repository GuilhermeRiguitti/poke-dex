"use client";

import { useEffect, useRef, useState } from "react";

// O tique do countdown. A única coisa que ele faz é fazer o número do servidor
// ANDAR entre uma resposta e a próxima — quem diz quanto tempo resta é sempre o
// DTO (BattleDTO.turnEndsInMs).
//
// Por que o prazo é remontado com o relógio LOCAL: o servidor manda uma DURAÇÃO
// ("restam 62s"), não um instante. Somar essa duração ao Date.now() do browser
// dá um prazo local correto mesmo com o relógio do usuário torto, porque o erro
// dele entra nos dois lados da conta e se cancela. O desvio que sobra é só a
// latência da resposta (dezenas de ms), e nem acumula: cada resposta reancora.
//
// Nada disso decide partida. Não há worker aqui (CLAUDE.md regra 5): quem
// resolve o turno vencido continua sendo o request (polling/push) e o backstop
// do pg_cron. Este é um relógio de tela.
const TICK_MS = 250;

/**
 * @param turnEndsInMs quanto restava quando a resposta chegou
 * @param running      false quando a partida acabou (não gasta tique à toa)
 *
 * O prazo é ancorado no efeito, não no render: `Date.now()` durante o render é
 * impuro (o mesmo render daria números diferentes). Quem monta este hook deve
 * passar `key={round}` no componente, pra o round novo começar com o valor
 * exato em vez de esperar o primeiro tique corrigir.
 */
export function useTurnClock(turnEndsInMs: number, running: boolean): number {
  const [remaining, setRemaining] = useState(turnEndsInMs);
  const deadline = useRef<number | null>(null);

  useEffect(() => {
    deadline.current = Date.now() + turnEndsInMs;
    if (!running) return;

    const timer = setInterval(() => {
      setRemaining(Math.max(0, (deadline.current ?? 0) - Date.now()));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [turnEndsInMs, running]);

  return remaining;
}
