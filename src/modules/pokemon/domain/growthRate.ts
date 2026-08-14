// AS SEIS CURVAS DE XP da série. PURO: sem Prisma, sem fetch, sem React.
//
// O QUE É UMA "CURVA": a regra que diz quanto XP TOTAL é preciso acumular pra
// estar em cada nível. Na PokéAPI ela se chama `growth_rate`, e são seis. Cada
// espécie tem a sua, e a diferença é grande — pro nível 50, `fast` pede 100.000
// e `slow` pede 156.250. É o que faz o lendário demorar mais pra crescer.
//
// Até 2026-08-14 todo mundo usava `medium-fast` (n³), que é a curva de ~55% das
// espécies. Agora cada espécie usa a dela, vinda do `/pokemon-species` —
// endpoint que o sync JÁ chamava pra descobrir a cadeia de evolução e cujo
// resto do payload era jogado fora.
//
// ⚠️ O TODO dizia que isto "sai quase de graça". Vale pro DADO, não pra
// matemática: `erratic` e `fluctuating` são polinômios POR FAIXA, sem inverso
// analítico. Não existe um `cbrt` pra elas. Por isso `levelFromXp` deixou de ser
// uma conta e virou busca binária sobre uma tabela pré-computada — o que, de
// quebra, ficou mais rápido que a raiz cúbica que estava lá.

export type GrowthRate =
  | "slow"
  | "medium-slow"
  | "medium-fast"
  | "fast"
  | "erratic"
  | "fluctuating";

/**
 * A curva de quem não tem o dado. `medium-fast` é a mais comum da série e a que
 * o jogo inteiro usou até aqui — então é também o valor que NÃO muda o
 * comportamento de nenhuma carta já existente.
 */
export const DEFAULT_GROWTH_RATE: GrowthRate = "medium-fast";

const RATES = new Set<string>([
  "slow",
  "medium-slow",
  "medium-fast",
  "fast",
  "erratic",
  "fluctuating",
]);

/** Lê a String do banco com desconfiança. Desconhecida → o default. */
export function normalizeGrowthRate(raw: unknown): GrowthRate {
  return typeof raw === "string" && RATES.has(raw) ? (raw as GrowthRate) : DEFAULT_GROWTH_RATE;
}

/**
 * XP TOTAL pra ESTAR no nível n, por curva. Fórmulas da série.
 *
 * `erratic` e `fluctuating` mudam de fórmula em faixas de nível — é por isso que
 * elas não têm inversa fechada, e é o motivo de existir a tabela mais abaixo.
 */
function totalXpFor(rate: GrowthRate, n: number): number {
  if (n <= 1) return 1;

  switch (rate) {
    case "fast":
      return Math.floor((4 * n ** 3) / 5);
    case "medium-fast":
      return n ** 3;
    case "slow":
      return Math.floor((5 * n ** 3) / 4);
    case "medium-slow":
      return Math.max(1, Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140));
    case "erratic":
      if (n < 50) return Math.floor((n ** 3 * (100 - n)) / 50);
      if (n < 68) return Math.floor((n ** 3 * (150 - n)) / 100);
      if (n < 98) return Math.floor((n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500);
      return Math.floor((n ** 3 * (160 - n)) / 100);
    case "fluctuating":
      if (n < 15) return Math.floor((n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50);
      if (n < 36) return Math.floor((n ** 3 * (n + 14)) / 50);
      return Math.floor((n ** 3 * (Math.floor(n / 2) + 32)) / 50);
  }
}

/**
 * A tabela de XP acumulado por nível, uma por curva, calculada UMA vez no
 * carregamento do módulo.
 *
 * São 6 × 100 números — trocado em miúdos, nada. O que ela compra é a INVERSA:
 * com a tabela ordenada, "que nível é este XP?" vira busca binária, que funciona
 * igual pras seis curvas, inclusive as que não têm fórmula inversa.
 */
const TABLES = new Map<GrowthRate, number[]>();

/** Precisa bater com MAX_LEVEL de leveling.ts (há teste travando isso). */
const TABLE_MAX_LEVEL = 100;

function tableFor(rate: GrowthRate): number[] {
  let t = TABLES.get(rate);
  if (!t) {
    // índice = nível; a posição 0 não é usada (não existe nível 0).
    t = [0];
    for (let n = 1; n <= TABLE_MAX_LEVEL; n++) t.push(totalXpFor(rate, n));
    TABLES.set(rate, t);
  }
  return t;
}

/** XP total necessário pra ESTAR no nível n, na curva da espécie. */
export function xpForLevelOn(rate: GrowthRate, level: number): number {
  const n = Math.max(1, Math.min(TABLE_MAX_LEVEL, Math.floor(level)));
  return tableFor(rate)[n];
}

/**
 * O nível correspondente a um XP total, na curva da espécie. Inverso de
 * `xpForLevelOn`, por busca binária.
 *
 * Substituiu o `Math.cbrt` porque as curvas por faixa não têm inversa — e a
 * antiga precisava de um ajuste manual pra erro de ponto flutuante
 * ("cbrt(125) = 4.999999"). A busca binária não tem esse problema: ela compara
 * inteiros já calculados.
 */
export function levelFromXpOn(rate: GrowthRate, totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  const t = tableFor(rate);

  let lo = 1;
  let hi = TABLE_MAX_LEVEL;
  let melhor = 1;
  while (lo <= hi) {
    const meio = (lo + hi) >> 1;
    if (t[meio] <= xp) {
      melhor = meio;
      lo = meio + 1;
    } else {
      hi = meio - 1;
    }
  }
  return melhor;
}
