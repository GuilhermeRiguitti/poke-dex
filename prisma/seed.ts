import "dotenv/config";
import { syncPokedex } from "@/src/modules/pokedex";
import { prisma } from "@/src/lib/prisma";

// Seed do espelho da PokéAPI (PLANO_JOGO.md §7): popula Pokemon/Move/PokemonMove
// a partir da API, começando por UMA geração pra respeitar a fair use policy
// (não puxar 1025 de uma vez). Reaproveita o MOTOR único `syncPokedex` — a mesma
// função que o cron de refresh usa. Idempotente: re-rodar só atualiza `fetchedAt`.
//
// Rodar: `npm run seed` (ou `npm run seed -- 152 251` pra outra faixa).
//
// A base de dev pode ser recriada à vontade (PLANO_JOGO.md F3) — não há dado a
// preservar. Este seed NÃO mexe em coleção/usuários; só no espelho da API.

// Gen 1 por padrão. Aceita `npm run seed -- <de> <ate>` pra outra faixa.
const GEN1_FROM = 1;
const GEN1_TO = 151;

function parseRange(): { from: number; to: number } {
  const [fromArg, toArg] = process.argv.slice(2);
  const from = Number(fromArg);
  const to = Number(toArg);
  if (Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from) {
    return { from, to };
  }
  return { from: GEN1_FROM, to: GEN1_TO };
}

async function main() {
  const { from, to } = parseRange();
  const apiIds = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  console.log(`Semeando espelho da PokéAPI: #${from}–#${to} (${apiIds.length} espécies)...`);
  const started = Date.now();

  const summary = await syncPokedex(apiIds);

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Pronto em ${secs}s:`);
  console.log(`  espécies: ${summary.pokemonSynced}`);
  console.log(`  moves:    ${summary.movesSynced}`);
  console.log(`  learnset: ${summary.linksSynced} vínculos`);
  if (summary.failedPokemon.length) {
    console.warn(`  falhas (rede/404), re-rode pra completar: ${summary.failedPokemon.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
