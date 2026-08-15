import "dotenv/config";
import { syncPokedex, syncTypes } from "@/src/modules/pokemon";
import { prisma } from "@/src/lib/prisma";

// ⚠️ O script roda com `tsx --conditions=react-server` (package.json). Sem isso
// o `import "server-only"` de `lib/prisma.ts` e do barrel do módulo estoura na
// hora: a marca de fronteira que protege o bundle do browser é resolvida pela
// condição `react-server`, que o Next define e um `tsx` puro não. Foi o que
// quebrou o seed quando o `server-only` entrou no prisma.ts (commit b1bb978).

// Seed do espelho da PokéAPI (CLAUDE.md consequência #4): popula Pokemon/Move/PokemonMove
// a partir da API, começando por UMA geração pra respeitar a fair use policy
// (não puxar 1025 de uma vez). Reaproveita o MOTOR único `syncPokedex` — a mesma
// função que o cron de refresh usa. Idempotente: re-rodar só atualiza `fetchedAt`.
//
// Rodar: `npm run seed` (ou `npm run seed -- 152 251` pra outra faixa).
//
// Semeia TAMBÉM a matriz de tipos (tabela `Type`, 18 linhas) — era a única coisa
// que a BATALHA ainda buscaria na rede. Com as 18 no espelho, a partida é rede
// zero por construção. `npm run seed -- --types-only` faz SÓ isso, sem re-varrer
// as espécies (é o que rodar num espelho já semeado).
//
// A base de dev pode ser recriada à vontade (decisão do dono: reset liberado) — não há dado a
// preservar. Este seed NÃO mexe em coleção/usuários; só no espelho da API.

// Gen 1 por padrão. Aceita `npm run seed -- <de> <ate>` pra outra faixa.
const GEN1_FROM = 1;
const GEN1_TO = 151;

function parseRange(args: string[]): { from: number; to: number } {
  const [fromArg, toArg] = args;
  const from = Number(fromArg);
  const to = Number(toArg);
  if (Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from) {
    return { from, to };
  }
  return { from: GEN1_FROM, to: GEN1_TO };
}

async function main() {
  const args = process.argv.slice(2);
  const typesOnly = args.includes("--types-only");
  // A faixa lê só os argumentos posicionais — flag não é número de espécie.
  const { from, to } = parseRange(args.filter((a) => !a.startsWith("--")));

  // Sempre primeiro, e sempre os 18: é barato (18 requests) e é o que mantém a
  // matriz atualizada — o espelho não tem cron que passe por ela.
  const types = await syncTypes();
  console.log(
    `Matriz de tipos: ${types.synced} espelhadas` +
      (types.failed.length ? `, FALHARAM: ${types.failed.join(", ")} (re-rode)` : "")
  );

  if (typesOnly) return;

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
