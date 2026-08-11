// O SORTEIO do pacote. PURO: sem Prisma, sem fetch, sem React.
//
// O que decide a chance de uma carta sair é o BST da espécie (quanto mais
// forte, mais raro). O BST em si e as faixas de raridade são fato da espécie e
// moram no @/src/modules/pokemon — aqui fica só o que é economia de pacote: a
// curva de peso e a roleta.

import { bstOf, DEX_SIZE } from "@/src/modules/pokemon";

/** Nº de cartas por pacote. */
export const PACK_SIZE = 6;

// Teto acima do BST máximo real (720): garante que até o pokémon mais forte
// receba peso > 0 (nada é impossível de sair), e que o peso do mais forte não
// seja ridiculamente menor que o do mais fraco por um efeito de borda.
const BST_CEIL = 800;

// Expoente da curva de raridade. peso = (BST_CEIL - bst) ^ EXPONENT, então o
// que importa é a razão de "headroom" (BST_CEIL - bst) elevada ao expoente.
//   - 1 seria quase linear: Magikarp (BST 200) vs Mewtwo (680) => (600/120)^1
//     = 5x mais raro só.
//   - 2.5 abre a distância pro "muito mais difícil": (600/120)^2.5 ≈ 56x.
// É o botão de tuning do drop rate. Sobe pra deixar os fortes mais raros.
const RARITY_EXPONENT = 2.5;

/**
 * Peso de sorteio de um pokémon: quanto MAIOR o BST, MENOR o peso. Sempre > 0
 * (pra um id válido), então nenhum pokémon é impossível de sair — só raro.
 */
export function weightForBst(bst: number): number {
  const headroom = Math.max(1, BST_CEIL - bst); // >= 1: nunca zera nem fica negativo
  return Math.pow(headroom, RARITY_EXPONENT);
}

/**
 * Sorteia PACK_SIZE pokémon distintos, ponderado pelo peso (BST baixo sai
 * mais). SEM reposição dentro do pacote: as 6 cartas são pokémon diferentes.
 *
 * `rng` é injetado (recebe [0,1)) pra ser testável de forma determinística —
 * em produção é Math.random. `pool` default é a dex inteira (1..1025), mas é
 * parâmetro pra o teste conseguir sortear de um conjunto pequeno e cravar o
 * resultado.
 *
 * Algoritmo: roleta ponderada sobre os pesos, removendo o escolhido a cada
 * rodada (roulette wheel sem reposição). O(PACK_SIZE × pool) — barato.
 */
export function drawPack(
  rng: () => number,
  count = PACK_SIZE,
  pool: number[] = defaultPool()
): number[] {
  const ids = [...pool];
  const weights = ids.map((id) => weightForBst(bstOf(id)));
  const picked: number[] = [];

  const n = Math.min(count, ids.length);
  for (let k = 0; k < n; k++) {
    const total = weights.reduce((a, w) => a + w, 0);
    let r = rng() * total;
    let idx = 0;
    // Anda pela roleta até o ponteiro r cair dentro de uma fatia. O último
    // índice é o fallback pra imprecisão de ponto flutuante (r ~= total).
    while (idx < weights.length - 1 && r >= weights[idx]) {
      r -= weights[idx];
      idx++;
    }
    picked.push(ids[idx]);
    ids.splice(idx, 1);
    weights.splice(idx, 1);
  }

  return picked;
}

function defaultPool(): number[] {
  return Array.from({ length: DEX_SIZE }, (_, i) => i + 1);
}
