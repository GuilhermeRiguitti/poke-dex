// Gera src/modules/packs/domain/rarity.generated.ts — o índice de BST (base
// stat total) de cada pokémon da dex, que é o peso de raridade do sorteio.
//
// POR QUE É UM SCRIPT OFFLINE, E NÃO UM CRON:
// base stats de uma geração já lançada são IMUTÁVEIS. Pikachu é 320 hoje, foi
// 320 no lançamento, será 320 pra sempre. Um cron diário re-buscaria 1025
// recursos da PokéAPI pra recalcular exatamente os mesmos números — desperdício
// e afronta à fair use policy da PokéAPI. Rode isto à mão só quando sair uma
// geração nova (evento ~anual):
//
//   node scripts/generate-rarity.mjs
//
// O arquivo gerado é só números (~1025 ints), `server-only` de fato porque
// mora em domain/ e nada de UI o importa — some do bundle do cliente.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const MAX_POKEMON = 1025; // igual ao pokedex/domain/pagination.ts
const BATCH = 25; // concorrência modesta — educado com a PokéAPI

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "modules", "packs", "domain", "rarity.generated.ts");

/** BST = soma dos 6 base stats. É o mesmo número que a engine de batalha usa. */
async function fetchBst(id) {
  const res = await fetch(`${POKEAPI_BASE}/pokemon/${id}`);
  if (!res.ok) throw new Error(`pokemon ${id}: HTTP ${res.status}`);
  const data = await res.json();
  return data.stats.reduce((sum, s) => sum + s.base_stat, 0);
}

async function main() {
  const bstById = new Array(MAX_POKEMON).fill(0);

  for (let start = 1; start <= MAX_POKEMON; start += BATCH) {
    const ids = [];
    for (let id = start; id < start + BATCH && id <= MAX_POKEMON; id++) ids.push(id);
    const bsts = await Promise.all(ids.map(fetchBst));
    ids.forEach((id, i) => (bstById[id - 1] = bsts[i]));
    console.log(`  ${Math.min(start + BATCH - 1, MAX_POKEMON)}/${MAX_POKEMON}`);
  }

  const missing = bstById.findIndex((v) => v === 0);
  if (missing !== -1) throw new Error(`BST faltando para o pokémon ${missing + 1}`);

  const rows = [];
  for (let i = 0; i < bstById.length; i += 20) {
    rows.push("  " + bstById.slice(i, i + 20).join(", ") + ",");
  }

  const body = `// GERADO por scripts/generate-rarity.mjs — NÃO edite à mão.
//
// BST (base stat total) de cada pokémon da dex. Índice = pokemonId - 1.
// É o peso de raridade do sorteio de pacotes (packs/domain/rarity.ts): quanto
// MAIOR o BST, MENOR a chance da carta sair. Dado imutável de geração já
// lançada — ver o script gerador pra por que não é um cron.

export const BST_BY_ID: readonly number[] = [
${rows.join("\n")}
];
`;

  await writeFile(OUT, body, "utf8");
  console.log(`\nOK — ${bstById.length} BSTs escritos em ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
