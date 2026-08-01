# Coleção filtrável + progressão com fonte única — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a coleção navegável — filtro por raridade e tipo, busca por nome, ordenação por nível e paginação de 16 — com tudo resolvido no Postgres, e arrumar a progressão pra ter uma fonte de verdade só.

**Architecture:** Duas fases. A Fase 1 leva "fortitude" e "raridade" pro banco como colunas imutáveis da espécie (`Pokemon.bst`, `Pokemon.rarity`), consolida a escrita do par `(xp, level)` em helpers puros e conserta a evolução pra ser retroativa. A Fase 2 troca a query que carrega a coleção inteira por uma paginada com `WHERE`/`ORDER BY`/`LIMIT` de verdade, e põe os controles na URL pra a page continuar Server Component.

**Tech Stack:** Next.js 16 (App Router, Server Components), Prisma 6 + Postgres (Supabase), Vitest, Tailwind.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-01-collection-filters-design.md`. Em caso de conflito, o spec manda.
- **Trabalhe numa branch**, nunca direto na `main`. Sugerida: `collection-filters`.
- **Migration só por arquivo versionado.** Proibido `mcp__supabase__apply_migration`, DDL via MCP, SQL Editor do dashboard, `psql` no prod, `prisma db push`, ou `prisma migrate dev` apontado pro prod. O MCP do Supabase deste ambiente aponta pro **PROD** e é só leitura.
- **Dev roda contra o stack local do Supabase CLI** (`127.0.0.1:54322`). Confira `DATABASE_URL`/`DIRECT_URL` no `.env` antes de qualquer comando de migration.
- **Page nunca leva `"use client"`.** O `"use client"` desce até o componente que tem estado/evento.
- **Query que escreve ou faz I/O de rede não pode ser chamada no render de page.** Tudo que este plano adiciona em `queries/` é só leitura.
- **Toda saída pro cliente passa por DTO** com whitelist explícita, campo a campo. Linha de Prisma nunca vai crua pro browser.
- **`ui/` não importa Prisma, `lib/auth`, `commands/` nem `queries/`.** Só `ui/` e tipos de `domain/`.
- **Pages importam do `index.ts` do módulo**, exceto componentes, que vêm por caminho direto (`@/src/modules/pokedex/ui/X`).
- **Nenhuma tabela nova neste plano** — então nenhum `ENABLE ROW LEVEL SECURITY` a acrescentar. `ADD COLUMN` não mexe em RLS.
- **Teste que passa não prova nada se não for capaz de falhar.** Onde o plano manda quebrar o código de propósito, faça e confirme que o teste acusa.
- **Verificação completa** (roda antes de cada commit de tarefa): `npx tsc --noEmit` · `npx vitest run` · `npx eslint`. O `npx next build` roda na Tarefa 11.
- **Testes espelham `src/` sob `tests/`.** O Vitest resolve `@/` pelo alias do `vitest.config.ts`.
- **Comentários e mensagens em português**, no tom do código existente: explicam **por quê**, não o quê.

---

# FASE 1 — Integridade da progressão

### Task 1: Helpers puros `sumBaseStats`, `progressionFromXp`, `progressionFromLevel`

O spec falava num `progressionFields(xp)` só. São **dois**: `openPack` vai de nível pra XP (nascimento), `awardBattleXp` vai de XP pra nível. Os dois sentidos precisam produzir o par consistente.

**Files:**
- Modify: `src/modules/progression/domain/leveling.ts` (acrescentar ao fim)
- Modify: `src/modules/progression/index.ts:21` (exportar os três)
- Test: `tests/modules/progression/domain/leveling.test.ts` (acrescentar describes)

**Interfaces:**
- Consumes: `BaseStats`, `levelFromXp`, `xpForLevel`, `clampLevel`, `MIN_LEVEL`, `MAX_LEVEL` — já existem no arquivo.
- Produces:
  - `sumBaseStats(base: BaseStats): number`
  - `progressionFromXp(totalXp: number): { xp: number; level: number }`
  - `progressionFromLevel(level: number): { xp: number; level: number }`

- [ ] **Step 1: Escreva os testes que falham**

Acrescente ao fim de `tests/modules/progression/domain/leveling.test.ts`:

```ts
import {
  sumBaseStats,
  progressionFromXp,
  progressionFromLevel,
} from "@/src/modules/progression/domain/leveling";

describe("sumBaseStats", () => {
  // Os números conferidos contra a PokéAPI. Este teste é o que prova que a
  // coluna Pokemon.bst (somada no syncPokedex) e a tabela gerada BST_BY_ID
  // (usada pelo sorteio de pacotes) não divergiram.
  it("bate com o BST conhecido das espécies de referência", () => {
    // Charmander #4
    expect(sumBaseStats({ hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 })).toBe(309);
    // Charizard #6
    expect(sumBaseStats({ hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 })).toBe(534);
    // Magikarp #129 — o piso da dex
    expect(sumBaseStats({ hp: 20, atk: 10, def: 55, spa: 15, spd: 20, spe: 80 })).toBe(200);
    // Arceus #493 — o teto
    expect(sumBaseStats({ hp: 120, atk: 120, def: 120, spa: 120, spd: 120, spe: 120 })).toBe(720);
  });

  it("bate com o bstOf da tabela gerada nas mesmas espécies", async () => {
    const { bstOf } = await import("@/src/modules/packs/domain/rarity");
    expect(bstOf(4)).toBe(309);
    expect(bstOf(6)).toBe(534);
    expect(bstOf(129)).toBe(200);
    expect(bstOf(493)).toBe(720);
  });
});

describe("progressionFromXp", () => {
  it("devolve o par (xp, level) que casa", () => {
    expect(progressionFromXp(1000)).toEqual({ xp: 1000, level: 10 });
  });

  it("nunca devolve xp negativo nem fracionário", () => {
    expect(progressionFromXp(-50)).toEqual({ xp: 0, level: MIN_LEVEL });
    expect(progressionFromXp(1000.9)).toEqual({ xp: 1000, level: 10 });
  });

  it("não estoura no teto de nível", () => {
    const acima = xpForLevel(MAX_LEVEL) + 999_999;
    expect(progressionFromXp(acima).level).toBe(MAX_LEVEL);
  });

  it("aguenta entrada inválida sem lançar", () => {
    expect(progressionFromXp(Number.NaN)).toEqual({ xp: 0, level: MIN_LEVEL });
  });
});

describe("progressionFromLevel", () => {
  it("devolve o XP exato de entrada no nível", () => {
    expect(progressionFromLevel(16)).toEqual({ xp: 4096, level: 16 });
  });

  it("recorta o nível na faixa válida", () => {
    expect(progressionFromLevel(0).level).toBe(MIN_LEVEL);
    expect(progressionFromLevel(999).level).toBe(MAX_LEVEL);
  });

  // A propriedade que importa: ida e volta fecham. É o que garante que uma
  // carta nascida no nível N não "perde" o nível na primeira leitura.
  it("fecha o ciclo com progressionFromXp em toda a faixa", () => {
    for (let nivel = MIN_LEVEL; nivel <= MAX_LEVEL; nivel++) {
      const nascimento = progressionFromLevel(nivel);
      expect(progressionFromXp(nascimento.xp).level).toBe(nivel);
    }
  });
});
```

Se `MIN_LEVEL`, `MAX_LEVEL` ou `xpForLevel` ainda não estiverem importados no topo do arquivo de teste, acrescente-os ao import existente de `@/src/modules/progression/domain/leveling`.

- [ ] **Step 2: Rode e confirme que falha**

```
npx vitest run tests/modules/progression/domain/leveling.test.ts
```

Esperado: FAIL — `sumBaseStats is not a function` (e as outras duas).

- [ ] **Step 3: Implemente**

Ao fim de `src/modules/progression/domain/leveling.ts`:

```ts
// ─── o par (xp, level) escrito por construção ──────────────────────────────
//
// `level` é função de `xp` (levelFromXp), mas as DUAS são coluna do
// UserPokemon: o banco precisa ORDENAR por nível, e não dá pra ordenar por uma
// conta feita em JS depois da query. Materializar é a escolha certa; o preço é
// que quem escreve uma tem que escrever a outra.
//
// Até aqui isso era garantido por convenção e comentário nos dois escritores
// (openPack e awardBattleXp). Com estes helpers passa a ser por construção: o
// caller monta o `data` com o objeto inteiro e não consegue produzir o par
// inválido. São dois porque os dois escritores andam em sentidos opostos —
// nascimento sabe o NÍVEL, batalha sabe o XP.

/** Soma dos 6 base stats: a "fortitude" da espécie, que define a raridade. */
export function sumBaseStats(base: BaseStats): number {
  return base.hp + base.atk + base.def + base.spa + base.spd + base.spe;
}

/** Par consistente a partir do XP TOTAL acumulado. Nunca lança. */
export function progressionFromXp(totalXp: number): { xp: number; level: number } {
  const xp = Number.isFinite(totalXp) ? Math.max(0, Math.floor(totalXp)) : 0;
  return { xp, level: levelFromXp(xp) };
}

/** Par consistente a partir de um nível de nascimento. Nunca lança. */
export function progressionFromLevel(level: number): { xp: number; level: number } {
  const clamped = clampLevel(level);
  return { xp: xpForLevel(clamped), level: clamped };
}
```

- [ ] **Step 4: Rode e confirme que passa**

```
npx vitest run tests/modules/progression/domain/leveling.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Prove que o teste é capaz de falhar**

Troque `base.spe` por `0` no `sumBaseStats`, rode de novo, confirme FAIL nos dois primeiros testes, e desfaça.

- [ ] **Step 6: Exporte no barrel**

Em `src/modules/progression/index.ts`, acrescente à lista do export de `./domain/leveling` (linha ~20):

```ts
  sumBaseStats,
  progressionFromXp,
  progressionFromLevel,
```

- [ ] **Step 7: Verifique e commite**

```bash
npx tsc --noEmit && npx vitest run && npx eslint
git add src/modules/progression tests/modules/progression
git commit -m "feat(progression): helpers puros de BST e do par (xp, level)"
```

---

### Task 2: Migration — `Pokemon.bst` e `Pokemon.rarity`

**Files:**
- Modify: `prisma/schema.prisma` (model `Pokemon`, linhas ~148-166)
- Create: `prisma/migrations/<timestamp>_pokemon_bst_rarity/migration.sql`

**Interfaces:**
- Produces: colunas `Pokemon.bst: Int` e `Pokemon.rarity: String` no Prisma Client, e índice em `rarity`. As Tarefas 3, 7 e 8 dependem delas.

- [ ] **Step 1: Garanta o stack local de pé e em dia**

```bash
npx supabase status   # se não estiver de pé: npx supabase start
npx prisma migrate deploy
```

O banco tem que estar em `127.0.0.1:54322`. Se o `.env` apontar pro Supabase remoto, **pare** — corrija antes.

- [ ] **Step 2: Edite o `schema.prisma`**

No model `Pokemon`, depois de `baseExperience`:

```prisma
  // FORTITUDE E RARIDADE — fatos imutáveis da ESPÉCIE, congelados na importação
  // (syncPokedex). Ficam aqui e não no UserPokemon de propósito: a evolução
  // troca UserPokemon.pokemonId, então a carta muda de raridade sozinha ao
  // evoluir (Charmander 309 common -> Charizard 534 rare). Cravado no
  // UserPokemon, o valor velho ficaria pra trás pra sempre.
  //
  // Por que coluna e não conta na leitura: a coleção FILTRA por raridade, e não
  // dá pra pôr num WHERE aquilo que só existe em JS. Subir de nível não mexe
  // nisso — BST é da espécie, não do nível.
  bst    Int    @default(0)        // soma dos 6 baseStats (sumBaseStats)
  rarity String @default("common") // rarityTier(bst) — common|uncommon|rare|legendary
```

E no fim do model, junto do `@@index` existente:

```prisma
  // Só `rarity` é indexado: é o único dos dois que entra em WHERE. `bst` é lido
  // pela linha que o join já trouxe — indexar seria peso de escrita sem leitura
  // que aproveite. Se entrar "ordenar por força", o índice entra junto.
  @@index([rarity])
```

- [ ] **Step 3: Gere a migration SEM aplicar**

```bash
npx prisma migrate dev --create-only --name=pokemon_bst_rarity
```

O `--create-only` é obrigatório: o arquivo precisa levar o backfill junto com o `ALTER TABLE`. Sem ele a migration já nasce aplicada, e editar depois quebra o checksum.

- [ ] **Step 4: Acrescente o backfill ao `migration.sql` gerado**

Abra `prisma/migrations/<timestamp>_pokemon_bst_rarity/migration.sql` e acrescente **depois** do `ALTER TABLE`:

```sql
-- Backfill das espécies que já estão no espelho. Soma o Json `baseStats` que já
-- está na linha (chaves de BaseStats: hp, atk, def, spa, spd, spe).
UPDATE "Pokemon" SET "bst" =
    COALESCE(("baseStats"->>'hp')::int, 0)
  + COALESCE(("baseStats"->>'atk')::int, 0)
  + COALESCE(("baseStats"->>'def')::int, 0)
  + COALESCE(("baseStats"->>'spa')::int, 0)
  + COALESCE(("baseStats"->>'spd')::int, 0)
  + COALESCE(("baseStats"->>'spe')::int, 0);

-- Os cortes são os mesmos do rarityTier (packs/domain/rarity.ts). Duplicar a
-- regra em SQL só vale AQUI: a migration é imutável e retrata o estado deste
-- dia. Daqui em diante quem decide é o TypeScript, no syncPokedex.
UPDATE "Pokemon" SET "rarity" = CASE
  WHEN "bst" < 350  THEN 'common'
  WHEN "bst" < 480  THEN 'uncommon'
  WHEN "bst" < 580  THEN 'rare'
  ELSE 'legendary'
END;
```

- [ ] **Step 5: Aplique no local**

```bash
npx prisma migrate dev
```

- [ ] **Step 6: Confirme o backfill no banco LOCAL**

```bash
npx prisma studio
```

Ou, mais rápido, um script de conferência:

```bash
npx tsx -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();const r=await p.pokemon.findMany({where:{pokemonApiId:{in:[4,6,129]}},select:{pokemonApiId:true,bst:true,rarity:true}});console.log(r);const z=await p.pokemon.count({where:{bst:0}});console.log('com bst=0:',z);await p.\$disconnect()"
```

Esperado: `{4, 309, common}`, `{6, 534, rare}`, `{129, 200, common}`, e **`com bst=0: 0`**. Se aparecer alguma linha com `bst=0`, o `baseStats` daquela espécie está com chave diferente — investigue antes de seguir.

- [ ] **Step 7: Commite schema e migration JUNTOS**

```bash
npx tsc --noEmit && npx vitest run && npx eslint
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): Pokemon.bst e Pokemon.rarity com backfill"
```

---

### Task 3: `syncPokedex` grava `bst`/`rarity`, e a fronteira do `bstOf`

**Files:**
- Modify: `src/modules/pokedex/commands/syncPokedex.ts:135-150` (o objeto `data` do upsert)
- Modify: `src/modules/packs/domain/rarity.ts:1-10` (cabeçalho — documentar a fronteira)

**Interfaces:**
- Consumes: `sumBaseStats` (Task 1), colunas `bst`/`rarity` (Task 2).
- Produces: toda linha `Pokemon` criada ou atualizada daqui em diante nasce com `bst` e `rarity` corretos.

- [ ] **Step 1: Grave as colunas no upsert**

Em `src/modules/pokedex/commands/syncPokedex.ts`, o bloco que monta `data` (hoje na linha ~138) vira:

```ts
    // `baseStats` sai numa const porque agora ele é usado DUAS vezes: vai pra
    // coluna Json e alimenta o bst. Somar o que este sync acabou de buscar (e
    // não ler o BST_BY_ID) é deliberado — a linha fica consistente consigo
    // mesma, e uma espécie que a tabela gerada não conhece ainda recebe o
    // valor certo.
    const baseStats = toBaseStats(p);
    const bst = sumBaseStats(baseStats);

    const data = {
      name: p.name,
      types: toTypeNames(p) as Prisma.InputJsonValue,
      baseStats: baseStats as unknown as Prisma.InputJsonObject,
      baseExperience: p.baseExperience,
      spriteUrl: p.sprites.artwork ?? p.sprites.front_default,
      evolvesToApiId: evolution?.toApiId ?? null,
      evolvesToLevel: evolution?.minLevel ?? null,
      bst,
      rarity: rarityTier(bst),
    };
```

E os imports no topo do arquivo:

```ts
import { sumBaseStats } from "@/src/modules/progression";
import { rarityTier } from "@/src/modules/packs/domain/rarity";
```

`rarityTier` vem de `domain/` direto (e não do barrel do packs) porque o barrel é API de servidor e arrasta queries/commands — o mesmo motivo pelo qual `ui/pokedexView.ts` já importa assim.

- [ ] **Step 2: Documente a fronteira no `rarity.ts`**

No cabeçalho de `src/modules/packs/domain/rarity.ts`, depois do parágrafo existente sobre o BST:

```ts
// ─── FRONTEIRA (leia antes de usar `bstOf`) ────────────────────────────────
//
// A partir da migration `pokemon_bst_rarity`, o BST e a raridade também vivem
// no banco, como coluna de `Pokemon`. Os dois coexistem, e cada um tem seu
// lugar:
//
//   • `bstOf(apiId)` / BST_BY_ID  — é do SORTEIO. `drawPack` pondera as 1025
//     espécies da dex, e a maioria NÃO tem linha em `Pokemon`; não há coluna
//     pra ler. Não use em nada que já tenha a linha na mão.
//
//   • `pokemon.bst` / `pokemon.rarity` — é de quem TEM a linha (coleção, deck,
//     carta). Ler a coluna é o que garante que a raridade desenhada na carta é
//     a MESMA que o filtro do banco usou pra achar ela.
//
// `rarityTier(bst)` continua sendo a única definição dos cortes — só que agora
// roda na IMPORTAÇÃO (syncPokedex), não na leitura.
```

- [ ] **Step 3: Verifique que o sync escreve certo**

Rode o sync de umas poucas espécies contra o banco local:

```bash
npx tsx -e "import{syncPokedex}from'./src/modules/pokedex/commands/syncPokedex';console.log(await syncPokedex([4,6,129,493]))"
npx tsx -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();console.log(await p.pokemon.findMany({where:{pokemonApiId:{in:[4,6,129,493]}},select:{pokemonApiId:true,bst:true,rarity:true}}));await p.\$disconnect()"
```

Esperado: `4→309 common`, `6→534 rare`, `129→200 common`, `493→720 legendary`.

- [ ] **Step 4: Verifique e commite**

```bash
npx tsc --noEmit && npx vitest run && npx eslint
git add src/modules/pokedex/commands/syncPokedex.ts src/modules/packs/domain/rarity.ts
git commit -m "feat(pokedex): syncPokedex grava bst e rarity na importação"
```

---

### Task 4: Os dois escritores passam a usar os helpers

**Files:**
- Modify: `src/modules/packs/commands/openPack.ts:149-159`
- Modify: `src/modules/battle/commands/awardBattleXp.ts:102-106`
- Test: `tests/modules/packs/commands/openPack.test.ts` (já existe — deve continuar passando)

**Interfaces:**
- Consumes: `progressionFromLevel`, `progressionFromXp` (Task 1).

- [ ] **Step 1: `openPack` monta o par pelo helper**

Em `src/modules/packs/commands/openPack.ts`, o `createMany` (linha ~149):

```ts
      // Nível de NASCIMENTO: forma evoluída nasce no nível em que seria
      // alcançada (Charizard não sai nível 1); forma-base sai em STARTING_LEVEL.
      // `progressionFromLevel` devolve o par (xp, level) casado — escrever um
      // sem o outro criaria o único estado inválido possível aqui.
      await tx.userPokemon.createMany({
        data: drawnIds.map((apiId) => ({
          userId,
          pokemonId: byApiId.get(apiId)!.id,
          ...progressionFromLevel(birthLevels.get(apiId)!),
        })),
      });
```

Troque o import de `xpForLevel` por `progressionFromLevel` (se `xpForLevel` não for mais usado no arquivo, remova-o do import).

- [ ] **Step 2: `awardBattleXp` idem**

Em `src/modules/battle/commands/awardBattleXp.ts` (linha ~102):

```ts
    const progress = applyXp(row.xp, award.gainedXp);
    await tx.userPokemon.update({
      where: { id: row.id },
      // `progressionFromXp` reafirma o par por construção. `applyXp` já devolve
      // os dois casados; passar pelo helper é o que impede um escritor futuro
      // de gravar só um dos campos.
      data: progressionFromXp(progress.xp),
    });
```

Acrescente `progressionFromXp` ao import de `@/src/modules/progression`.

- [ ] **Step 3: Rode a suíte inteira**

```
npx vitest run
```

Esperado: PASS. O teste de `openPack` já cobre o nível de nascimento — se ele quebrar, o helper está errado, não o teste.

- [ ] **Step 4: Verifique e commite**

```bash
npx tsc --noEmit && npx vitest run && npx eslint
git add src/modules/packs/commands/openPack.ts src/modules/battle/commands/awardBattleXp.ts
git commit -m "refactor(progression): par (xp, level) escrito só pelos helpers"
```

---

### Task 5: Evolução retroativa (bug)

Hoje `maybeEvolve` só roda quando `progress.gained > 0`, e desiste calado se a espécie-alvo não está no espelho. Se o Charmander cruza o nível 16 numa batalha em que o Charizard ainda não foi semeado, ele nunca mais evolui — no `MAX_LEVEL`, `gained` é sempre 0 e trava de vez. O `refreshPokedex` não salva: ele só re-sincroniza espécies que já existem.

**Files:**
- Modify: `src/modules/battle/commands/awardBattleXp.ts:107-113`
- Create: `tests/modules/battle/commands/awardBattleXp.test.ts`

**Interfaces:**
- Consumes: `awardBattleXp(tx, context)`, `evolutionTargetFor` (já existem).

- [ ] **Step 1: Escreva o teste que falha**

Crie `tests/modules/battle/commands/awardBattleXp.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// O bug que este arquivo tranca: a evolução era checada SÓ quando a batalha
// fazia subir de nível. Um pokémon que cruzou o gatilho numa hora em que a
// espécie-alvo ainda não estava no espelho ficava preso na forma antiga PRA
// SEMPRE — no nível 100 nunca mais ganha nível, então a checagem nunca voltava.
// Aqui não há worker pra reparar depois (CLAUDE.md §5), então a checagem tem
// que ser RETROATIVA: roda em toda aplicação de XP, igual ao timeout de turno.

const tx = {
  userPokemon: { findMany: vi.fn(), update: vi.fn() },
  pokemon: { findUnique: vi.fn() },
  deckSlot: { findMany: vi.fn() },
  pokemonMove: { findMany: vi.fn() },
  userPokemonMove: { findMany: vi.fn() },
  deckSlotCard: { deleteMany: vi.fn(), createMany: vi.fn() },
};

vi.mock("@/src/lib/prisma", () => ({ prisma: { pokemon: { findMany: vi.fn() } } }));

const { awardBattleXp } = await import("@/src/modules/battle/commands/awardBattleXp");

// Charmander já no nível 20 (gatilho da evolução é 16) — ou seja, ele JÁ
// deveria ter evoluído. Ganha XP de migalha, que não sobe nível.
const CHARMANDER_LV20 = {
  id: "up-1",
  xp: 8000, // levelFromXp(8000) = 20
  pokemon: { evolvesToApiId: 5, evolvesToLevel: 16 },
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.userPokemon.findMany.mockResolvedValue([CHARMANDER_LV20]);
  tx.userPokemon.update.mockResolvedValue({});
  tx.pokemon.findUnique.mockResolvedValue({
    id: "species-charmeleon",
    evolvesToApiId: 6,
    evolvesToLevel: 36, // longe: a cadeia para aqui
  });
  tx.deckSlot.findMany.mockResolvedValue([]);
});

const contexto = (gainedXp: number) => ({
  winner: { userPokemonId: "up-1", gainedXp },
  loser: null,
});

describe("awardBattleXp — evolução retroativa", () => {
  it("evolui quem já passou do gatilho MESMO sem subir de nível nesta batalha", async () => {
    // 1 de XP: levelFromXp(8001) continua 20. gained === 0.
    await awardBattleXp(tx as never, contexto(1));

    expect(tx.pokemon.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pokemonApiId: 5 } })
    );
    expect(tx.userPokemon.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pokemonId: "species-charmeleon" } })
    );
  });

  it("não vai ao banco quando o nível ainda não bate o gatilho", async () => {
    tx.userPokemon.findMany.mockResolvedValue([
      { id: "up-1", xp: 1000, pokemon: { evolvesToApiId: 5, evolvesToLevel: 16 } }, // nível 10
    ]);

    await awardBattleXp(tx as never, contexto(1));

    // `evolutionTargetFor` é puro e corta antes: custo zero no caso saudável.
    expect(tx.pokemon.findUnique).not.toHaveBeenCalled();
  });

  it("não escreve evolução quando a espécie-alvo está fora do espelho", async () => {
    tx.pokemon.findUnique.mockResolvedValue(null);

    await awardBattleXp(tx as never, contexto(1));

    // O XP é gravado; a evolução, não. E nada lança.
    const updates = tx.userPokemon.update.mock.calls.map((c) => c[0].data);
    expect(updates.some((d: Record<string, unknown>) => "pokemonId" in d)).toBe(false);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
npx vitest run tests/modules/battle/commands/awardBattleXp.test.ts
```

Esperado: FAIL no primeiro teste — `tx.pokemon.findUnique` não foi chamado, porque a guarda `if (progress.gained > 0)` cortou.

- [ ] **Step 3: Tire a guarda**

Em `src/modules/battle/commands/awardBattleXp.ts`, o bloco da linha ~107:

```ts
    // Evolução RETROATIVA: checa em toda aplicação de XP, não só quando subiu
    // de nível. Aqui não existe worker pra consertar estado depois (CLAUDE.md
    // §5), então o estado tem que se curar quando alguém chega — mesmo padrão
    // do timeout de turno. Sem isto, um pokémon que cruzou o gatilho enquanto a
    // espécie-alvo não estava no espelho ficava preso na forma antiga pra
    // sempre (no MAX_LEVEL nunca mais há nível ganho, então a checagem nunca
    // voltava).
    //
    // Custo ZERO no caso saudável: `evolutionTargetFor` é puro e devolve null
    // sem tocar no banco quando o nível não bate o gatilho da espécie atual —
    // e quem já evoluiu aponta pro estágio seguinte, cujo nível é mais alto.
    // A ida ao banco só acontece no caso que estava quebrado.
    //
    // NÃO toca no snapshot da partida (BattlePokemon é congelado): a evolução
    // vale da PRÓXIMA batalha, que reconstrói do UserPokemon.
    await maybeEvolve(tx, row.id, row.pokemon, progress.level);
```

- [ ] **Step 4: Rode e confirme que passa**

```
npx vitest run tests/modules/battle/commands/awardBattleXp.test.ts
npx vitest run
```

Esperado: PASS nos dois.

- [ ] **Step 5: Prove que o teste é capaz de falhar**

Reponha o `if (progress.gained > 0) { ... }` em volta da chamada, rode, confirme FAIL no primeiro teste, e tire de novo.

- [ ] **Step 6: Verifique e commite**

```bash
npx tsc --noEmit && npx vitest run && npx eslint
git add src/modules/battle/commands/awardBattleXp.ts tests/modules/battle/commands/awardBattleXp.test.ts
git commit -m "fix(battle): evolução retroativa — não depende de subir de nível na hora"
```

---

# FASE 2 — A tela da coleção

### Task 6: Domain dos filtros

**Files:**
- Create: `src/modules/pokedex/domain/collectionFilters.ts`
- Test: `tests/modules/pokedex/domain/collectionFilters.test.ts`

**Interfaces:**
- Produces:
  - `COLLECTION_PAGE_SIZE = 16`
  - `POKEMON_TYPES: readonly string[]` (18, ordenados)
  - `RARITY_TIERS: readonly RarityTier[]`
  - `type CollectionSort = "captured" | "level_desc" | "level_asc"`
  - `interface CollectionFilters { q: string | null; type: string | null; rarity: RarityTier | null; sort: CollectionSort; page: number }`
  - `parseCollectionFilters(raw: Record<string, string | undefined>): CollectionFilters`
  - `hasActiveFilter(f: CollectionFilters): boolean`
  - `collectionHref(f: CollectionFilters, patch: Partial<CollectionFilters>): string`

- [ ] **Step 1: Escreva o teste que falha**

Crie `tests/modules/pokedex/domain/collectionFilters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  COLLECTION_PAGE_SIZE,
  collectionHref,
  hasActiveFilter,
  parseCollectionFilters,
} from "@/src/modules/pokedex/domain/collectionFilters";

// Entrada de URL é entrada de USUÁRIO, e isto roda no render de uma page: um
// throw aqui vira tela de erro em vez de listagem. Nada pode lançar; valor
// inválido vira null ou o default. (Mesma razão do clampPage.)

describe("parseCollectionFilters", () => {
  it("sem parâmetro nenhum, devolve o default", () => {
    expect(parseCollectionFilters({})).toEqual({
      q: null,
      type: null,
      rarity: null,
      sort: "captured",
      page: 1,
    });
  });

  it("aceita os valores válidos", () => {
    expect(
      parseCollectionFilters({ q: "char", type: "fire", rarity: "rare", sort: "level_desc", page: "3" })
    ).toEqual({ q: "char", type: "fire", rarity: "rare", sort: "level_desc", page: 3 });
  });

  it.each([
    ["page não numérica", { page: "abc" }, 1],
    ["page negativa", { page: "-3" }, 1],
    ["page zero", { page: "0" }, 1],
    ["page fracionária", { page: "2.9" }, 2],
  ])("recorta a página: %s", (_nome, raw, esperado) => {
    expect(parseCollectionFilters(raw).page).toBe(esperado);
  });

  it("descarta tipo e raridade que não existem", () => {
    const f = parseCollectionFilters({ type: "<script>", rarity: "ultra" });
    expect(f.type).toBeNull();
    expect(f.rarity).toBeNull();
  });

  it("descarta ordenação desconhecida", () => {
    expect(parseCollectionFilters({ sort: "bogus" }).sort).toBe("captured");
  });

  it("trima a busca e trata vazia como ausente", () => {
    expect(parseCollectionFilters({ q: "   " }).q).toBeNull();
    expect(parseCollectionFilters({ q: "  pika  " }).q).toBe("pika");
  });

  it("TRUNCA a busca longa em vez de rejeitar", () => {
    // Rejeitar faria a tela piscar vazia por causa de um paste acidental.
    const f = parseCollectionFilters({ q: "a".repeat(500) });
    expect(f.q).toHaveLength(50);
  });
});

describe("hasActiveFilter", () => {
  it("página e ordenação não contam como filtro", () => {
    const f = parseCollectionFilters({ page: "4", sort: "level_desc" });
    expect(hasActiveFilter(f)).toBe(false);
  });

  it("busca, tipo ou raridade contam", () => {
    expect(hasActiveFilter(parseCollectionFilters({ q: "pika" }))).toBe(true);
    expect(hasActiveFilter(parseCollectionFilters({ type: "fire" }))).toBe(true);
    expect(hasActiveFilter(parseCollectionFilters({ rarity: "rare" }))).toBe(true);
  });
});

describe("collectionHref", () => {
  it("preserva o que não foi trocado", () => {
    const f = parseCollectionFilters({ q: "char", type: "fire", page: "2" });
    expect(collectionHref(f, { page: 3 })).toBe("/pokedex?q=char&type=fire&page=3");
  });

  it("omite o que está no default (URL limpa)", () => {
    expect(collectionHref(parseCollectionFilters({}), {})).toBe("/pokedex");
  });

  // O comportamento que evita a página fantasma: trocar um FILTRO tem que
  // voltar pra página 1, senão o jogador cai numa página que não existe mais.
  it("trocar filtro zera a página", () => {
    const f = parseCollectionFilters({ page: "5", q: "char" });
    expect(collectionHref(f, { rarity: "rare" })).toBe("/pokedex?q=char&rarity=rare");
  });

  it("trocar só a página NÃO zera a página", () => {
    const f = parseCollectionFilters({ page: "5" });
    expect(collectionHref(f, { page: 6 })).toBe("/pokedex?page=6");
  });
});

describe("COLLECTION_PAGE_SIZE", () => {
  it("é 16", () => {
    expect(COLLECTION_PAGE_SIZE).toBe(16);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
npx vitest run tests/modules/pokedex/domain/collectionFilters.test.ts
```

Esperado: FAIL — o módulo não existe.

- [ ] **Step 3: Implemente**

Crie `src/modules/pokedex/domain/collectionFilters.ts`:

```ts
// Filtros da coleção. PURO: sem Prisma, sem fetch, sem React.
//
// Tudo aqui existe pra uma coisa: transformar a query string (entrada de
// usuário, pode ser qualquer lixo) num objeto TIPADO que a query e a UI possam
// usar sem checar de novo. NADA LANÇA — isto roda no render de uma page, e um
// throw viraria tela de erro no lugar da coleção (mesma razão do clampPage).

import { TYPE_COLORS } from "@/src/lib/typeColors";
import type { RarityTier } from "@/src/modules/packs/domain/rarity";

/** Cartas por página. 16 = 4 fileiras de 4 no grid mais largo. */
export const COLLECTION_PAGE_SIZE = 16;

/** Teto da busca. Trunca (não rejeita): paste acidental não pode zerar a tela. */
const MAX_QUERY_LENGTH = 50;

/** Os 18 tipos elementais, na ordem do seletor. Fonte: as chaves de typeColors. */
export const POKEMON_TYPES: readonly string[] = Object.keys(TYPE_COLORS);

/** As faixas de raridade, da mais comum pra mais rara. */
export const RARITY_TIERS: readonly RarityTier[] = ["common", "uncommon", "rare", "legendary"];

export type CollectionSort = "captured" | "level_desc" | "level_asc";

const SORTS: readonly CollectionSort[] = ["captured", "level_desc", "level_asc"];

export interface CollectionFilters {
  /** busca por nome, já trimada e truncada; null quando vazia */
  q: string | null;
  /** tipo elemental válido; null quando ausente ou desconhecido */
  type: string | null;
  /** faixa de raridade válida; null quando ausente ou desconhecida */
  rarity: RarityTier | null;
  sort: CollectionSort;
  /** sempre >= 1. O teto depende do total, que só a query sabe. */
  page: number;
}

const DEFAULTS: CollectionFilters = {
  q: null,
  type: null,
  rarity: null,
  sort: "captured",
  page: 1,
};

export function parseCollectionFilters(
  raw: Record<string, string | undefined>
): CollectionFilters {
  const q = (raw.q ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const page = parsePage(raw.page);

  return {
    q: q.length > 0 ? q : null,
    type: POKEMON_TYPES.includes(raw.type ?? "") ? raw.type! : null,
    rarity: RARITY_TIERS.includes(raw.rarity as RarityTier) ? (raw.rarity as RarityTier) : null,
    sort: SORTS.includes(raw.sort as CollectionSort) ? (raw.sort as CollectionSort) : "captured",
    page,
  };
}

// Só piso: o teto depende do total de linhas, que a page só descobre depois da
// query. Página além do fim volta vazia e a tela mostra o estado de "nada
// encontrado" — mais barato que uma segunda consulta só pra recortar.
function parsePage(raw: string | undefined): number {
  const parsed = parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

/** Há filtro estreitando a lista? Página e ordenação NÃO contam. */
export function hasActiveFilter(f: CollectionFilters): boolean {
  return f.q !== null || f.type !== null || f.rarity !== null;
}

/**
 * O href da coleção com `patch` aplicado por cima dos filtros atuais.
 *
 * Trocar QUALQUER filtro volta pra página 1 — sem isso o jogador que estava na
 * página 5 e filtra "lendário" cai numa página que não existe mais e vê a tela
 * vazia. Trocar só a página, claro, preserva a página.
 *
 * Parâmetro no default é OMITIDO: a URL fica limpa e compartilhável.
 */
export function collectionHref(
  f: CollectionFilters,
  patch: Partial<CollectionFilters>
): string {
  const mexeuEmFiltro = "q" in patch || "type" in patch || "rarity" in patch;
  const next: CollectionFilters = {
    ...f,
    ...patch,
    page: "page" in patch ? patch.page! : mexeuEmFiltro ? 1 : f.page,
  };

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.type) params.set("type", next.type);
  if (next.rarity) params.set("rarity", next.rarity);
  if (next.sort !== DEFAULTS.sort) params.set("sort", next.sort);
  if (next.page !== DEFAULTS.page) params.set("page", String(next.page));

  const qs = params.toString();
  return qs ? `/pokedex?${qs}` : "/pokedex";
}
```

- [ ] **Step 4: Rode e confirme que passa**

```
npx vitest run tests/modules/pokedex/domain/collectionFilters.test.ts
```

Esperado: PASS. Se o teste de `collectionHref` falhar pela **ordem** dos parâmetros, ajuste a ordem esperada no teste — o que importa é o conteúdo, e a ordem de inserção no `URLSearchParams` é determinística.

- [ ] **Step 5: Confirme que `POKEMON_TYPES` tem 18**

```bash
npx tsx -e "import{POKEMON_TYPES}from'./src/modules/pokedex/domain/collectionFilters';console.log(POKEMON_TYPES.length,POKEMON_TYPES)"
```

Esperado: 18. Se `TYPE_COLORS` tiver chave a mais (tipo `unknown`/`default`), acrescente uma constante explícita com os 18 no lugar do `Object.keys` e ajuste o comentário.

- [ ] **Step 6: Verifique e commite**

```bash
npx tsc --noEmit && npx vitest run && npx eslint
git add src/modules/pokedex/domain/collectionFilters.ts tests/modules/pokedex/domain/collectionFilters.test.ts
git commit -m "feat(pokedex): domain puro dos filtros da coleção"
```

---

### Task 7: `where` e `orderBy` puros

Separados da query pra serem testáveis sem banco. O `ORDER BY` terminar em `id` é o coração da tarefa.

**Files:**
- Create: `src/modules/pokedex/queries/collectionWhere.ts`
- Test: `tests/modules/pokedex/queries/collectionWhere.test.ts`

**Interfaces:**
- Consumes: `CollectionFilters`, `CollectionSort` (Task 6).
- Produces:
  - `buildCollectionWhere(userId: string, f: CollectionFilters): Prisma.UserPokemonWhereInput`
  - `orderByFor(sort: CollectionSort): Prisma.UserPokemonOrderByWithRelationInput[]`

- [ ] **Step 1: Escreva o teste que falha**

Crie `tests/modules/pokedex/queries/collectionWhere.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCollectionWhere, orderByFor } from "@/src/modules/pokedex/queries/collectionWhere";
import { parseCollectionFilters } from "@/src/modules/pokedex/domain/collectionFilters";

describe("buildCollectionWhere", () => {
  it("sem filtro, recorta só pelo dono", () => {
    const where = buildCollectionWhere("u1", parseCollectionFilters({}));
    expect(where).toEqual({ userId: "u1", pokemon: {} });
  });

  it("busca por nome é insensível a maiúscula", () => {
    const where = buildCollectionWhere("u1", parseCollectionFilters({ q: "Char" }));
    expect(where.pokemon).toEqual({ name: { contains: "Char", mode: "insensitive" } });
  });

  it("tipo elemental usa array_contains na coluna Json", () => {
    const where = buildCollectionWhere("u1", parseCollectionFilters({ type: "fire" }));
    expect(where.pokemon).toEqual({ types: { array_contains: ["fire"] } });
  });

  it("raridade é igualdade na coluna", () => {
    const where = buildCollectionWhere("u1", parseCollectionFilters({ rarity: "legendary" }));
    expect(where.pokemon).toEqual({ rarity: "legendary" });
  });

  it("os três filtros combinam", () => {
    const where = buildCollectionWhere(
      "u1",
      parseCollectionFilters({ q: "dra", type: "dragon", rarity: "rare" })
    );
    expect(where.pokemon).toEqual({
      name: { contains: "dra", mode: "insensitive" },
      types: { array_contains: ["dragon"] },
      rarity: "rare",
    });
  });
});

describe("orderByFor", () => {
  // O openPack cria as 6 cartas num createMany dentro de uma transação, e o
  // now() do Postgres é o MESMO pra todas: as 6 têm capturedAt idêntico. Nível
  // empata ainda mais. Em ordenação empatada o Postgres não garante a mesma
  // ordem entre duas queries — com LIMIT/OFFSET isso faz uma carta aparecer em
  // duas páginas e outra sumir das duas. `id` é cuid e único: é o desempate.
  it.each(["captured", "level_desc", "level_asc"] as const)(
    "termina em id — %s",
    (sort) => {
      const ordem = orderByFor(sort);
      expect(ordem[ordem.length - 1]).toEqual({ id: "asc" });
    }
  );

  it("captured ordena por data de captura primeiro", () => {
    expect(orderByFor("captured")).toEqual([{ capturedAt: "asc" }, { id: "asc" }]);
  });

  it("level_desc põe o nível na frente", () => {
    expect(orderByFor("level_desc")).toEqual([
      { level: "desc" },
      { capturedAt: "asc" },
      { id: "asc" },
    ]);
  });

  it("level_asc idem, invertido", () => {
    expect(orderByFor("level_asc")).toEqual([
      { level: "asc" },
      { capturedAt: "asc" },
      { id: "asc" },
    ]);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
npx vitest run tests/modules/pokedex/queries/collectionWhere.test.ts
```

Esperado: FAIL — o módulo não existe.

- [ ] **Step 3: Implemente**

Crie `src/modules/pokedex/queries/collectionWhere.ts`:

```ts
// O WHERE e o ORDER BY da coleção, separados da query pra serem PUROS e
// testáveis sem banco. Só tipos do Prisma entram aqui — nenhum acesso.

import type { Prisma } from "@prisma/client";
import type { CollectionFilters, CollectionSort } from "../domain/collectionFilters";

/**
 * O recorte da coleção. Os filtros vivem na espécie (`Pokemon`), o dono vive no
 * `UserPokemon` — o Prisma junta as duas tabelas.
 *
 * `types` é coluna Json (`string[]`): `array_contains` vira o operador `@>` do
 * jsonb, e `'["fire","flying"]' @> '["fire"]'` é true. Por isso o valor vai
 * dentro de um array, não solto.
 */
export function buildCollectionWhere(
  userId: string,
  f: CollectionFilters
): Prisma.UserPokemonWhereInput {
  return {
    userId,
    pokemon: {
      ...(f.q ? { name: { contains: f.q, mode: "insensitive" as const } } : {}),
      ...(f.type ? { types: { array_contains: [f.type] } } : {}),
      ...(f.rarity ? { rarity: f.rarity } : {}),
    },
  };
}

/**
 * A ordem, SEMPRE terminando em `id`.
 *
 * O `openPack` cria as 6 cartas de um pacote num `createMany` dentro de uma
 * transação, e o `now()` do Postgres é o mesmo pra todas — as 6 nascem com
 * `capturedAt` IDÊNTICO. Nível empata mais ainda (todo mundo começa igual).
 *
 * Enquanto a coleção vinha inteira numa query só, empate não fazia diferença.
 * Com LIMIT/OFFSET faz: em ordenação empatada o Postgres não garante a mesma
 * ordem entre duas consultas, então a mesma carta pode sair na página 1 E na 2,
 * e outra sumir das duas. `id` é cuid, único — é o desempate final, e vale
 * inclusive pra ordenação padrão.
 */
export function orderByFor(sort: CollectionSort): Prisma.UserPokemonOrderByWithRelationInput[] {
  const head: Prisma.UserPokemonOrderByWithRelationInput[] =
    sort === "level_desc" ? [{ level: "desc" }] : sort === "level_asc" ? [{ level: "asc" }] : [];

  return [...head, { capturedAt: "asc" }, { id: "asc" }];
}
```

- [ ] **Step 4: Rode e confirme que passa**

```
npx vitest run tests/modules/pokedex/queries/collectionWhere.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Prove que o teste do desempate é capaz de falhar**

Tire o `{ id: "asc" }` do `return`, rode, confirme FAIL nos quatro testes de `orderByFor`, e reponha.

- [ ] **Step 6: Confirme o `array_contains` CONTRA O BANCO LOCAL**

Este é o único ponto do plano que depende de comportamento do Postgres que não dá pra provar com teste unitário. Confirme antes de seguir:

```bash
npx tsx -e "import{PrismaClient}from'@prisma/client';const p=new PrismaClient();const r=await p.pokemon.findMany({where:{types:{array_contains:['fire']}},select:{name:true,types:true},take:5});console.log(r);await p.\$disconnect()"
```

Esperado: só espécies de fogo, **incluindo as de tipo duplo** (Charizard é `["fire","flying"]` e tem que aparecer). Se vier vazio ou lançar, **pare e reporte**: o plano B é `types` virar tabela de relação, o que é migration maior e muda as Tarefas 7-8.

- [ ] **Step 7: Verifique e commite**

```bash
npx tsc --noEmit && npx vitest run && npx eslint
git add src/modules/pokedex/queries/collectionWhere.ts tests/modules/pokedex/queries/collectionWhere.test.ts
git commit -m "feat(pokedex): where e orderBy puros da coleção, com desempate por id"
```

---

### Task 8: `getCollectionPage` e o DTO

**Files:**
- Create: `src/modules/pokedex/queries/getCollectionPage.ts`
- Create: `src/modules/pokedex/queries/toCollectionPageDTO.ts`
- Delete: `src/modules/pokedex/queries/getCollection.ts`
- Modify: `src/modules/pokedex/ui/types.ts` (acrescentar `CollectionPageDTO`)
- Modify: `src/modules/pokedex/index.ts:9-15,33` (trocar os exports)
- Test: `tests/modules/pokedex/queries/toCollectionPageDTO.test.ts`

**Interfaces:**
- Consumes: `buildCollectionWhere`, `orderByFor` (Task 7); `COLLECTION_PAGE_SIZE`, `hasActiveFilter`, `CollectionFilters` (Task 6); colunas `bst`/`rarity` (Task 2); `readDeck` (`@/src/modules/deck`).
- Produces:
  - `interface CollectionPageDTO` (em `ui/types.ts`)
  - `getCollectionPage(userId: string, filters: CollectionFilters): Promise<CollectionPageDTO>`
  - `toCollectionCardDTO(row): CollectionCardDTO`

- [ ] **Step 1: Acrescente o DTO em `ui/types.ts`**

```ts
/** Uma PÁGINA da coleção: as 16 cartas, o deck, e o estado da navegação. */
export interface CollectionPageDTO {
  cards: CollectionCardDTO[];
  /** null quando o jogador ainda não tem deck (nasce no primeiro loadout) */
  deck: { id: string; slots: { id: string; userPokemonId: string }[] } | null;
  page: number;
  totalPages: number;
  /** total que o FILTRO encontrou — é o que a tela conta */
  totalCards: number;
  /**
   * total sem filtro nenhum. Existe pra distinguir os dois estados vazios:
   * "coleção vazia" (vai capturar) e "o filtro não achou nada" (limpa o
   * filtro). São telas diferentes.
   */
  totalInCollection: number;
  filters: CollectionFilters;
}
```

E o import no topo do arquivo:

```ts
import type { CollectionFilters } from "../domain/collectionFilters";
```

- [ ] **Step 2: Escreva o teste do mapper**

Crie `tests/modules/pokedex/queries/toCollectionPageDTO.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toCollectionCardDTO } from "@/src/modules/pokedex/queries/toCollectionPageDTO";

// A linha crua do UserPokemon+Pokemon carrega coisa que a tela não precisa
// (userId, pokemonId interno, fetchedAt, o learnset inteiro). Linha de Prisma
// NUNCA vai crua pro browser — o mapper é whitelist explícita, e este teste é o
// que tranca isso por construção.

const linha = {
  id: "up-1",
  level: 12,
  xp: 1728,
  userId: "SEGREDO-DO-DONO",
  pokemon: {
    pokemonApiId: 4,
    name: "charmander",
    spriteUrl: "https://img/4.png",
    types: ["fire"],
    baseStats: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
    bst: 309,
    rarity: "common",
  },
};

describe("toCollectionCardDTO", () => {
  it("monta a carta com bst e rarity vindos da COLUNA", () => {
    const dto = toCollectionCardDTO(linha as never);

    expect(dto.userPokemonId).toBe("up-1");
    expect(dto.pokemonId).toBe(4);
    expect(dto.level).toBe(12);
    expect(dto.bst).toBe(309);
    expect(dto.rarity).toBe("common");
    expect(dto.pokemon).toEqual({
      id: 4,
      name: "charmander",
      artworkUrl: "https://img/4.png",
      iconUrl: "https://img/4.png",
      types: ["fire"],
    });
  });

  it("não vaza campo fora da whitelist", () => {
    const serializado = JSON.stringify(toCollectionCardDTO(linha as never));
    expect(serializado).not.toContain("SEGREDO-DO-DONO");
    expect(serializado).not.toContain("userId");
  });
});
```

- [ ] **Step 3: Rode e confirme que falha**

```
npx vitest run tests/modules/pokedex/queries/toCollectionPageDTO.test.ts
```

Esperado: FAIL — o módulo não existe.

- [ ] **Step 4: Escreva o mapper**

Crie `src/modules/pokedex/queries/toCollectionPageDTO.ts`:

```ts
// Mapper da linha crua -> DTO da carta da coleção. Whitelist EXPLÍCITA, campo a
// campo: linha de Prisma não vai crua pro browser (CLAUDE.md, regra 3).

import type { RarityTier } from "@/src/modules/packs/domain/rarity";
import type { BaseStats } from "@/src/modules/progression";
import type { CollectionCardDTO } from "../ui/types";

/** O recorte que a query pede — e tudo que o mapper tem direito de ver. */
export const COLLECTION_CARD_SELECT = {
  id: true,
  level: true,
  xp: true,
  pokemon: {
    select: {
      pokemonApiId: true,
      name: true,
      spriteUrl: true,
      types: true,
      baseStats: true,
      bst: true,
      rarity: true,
    },
  },
} as const;

interface CollectionCardRow {
  id: string;
  level: number;
  xp: number;
  pokemon: {
    pokemonApiId: number;
    name: string;
    spriteUrl: string | null;
    types: unknown;
    baseStats: unknown;
    bst: number;
    rarity: string;
  };
}

export function toCollectionCardDTO(row: CollectionCardRow): CollectionCardDTO {
  return {
    userPokemonId: row.id,
    pokemonId: row.pokemon.pokemonApiId,
    level: row.level,
    xp: row.xp,
    // Da COLUNA, não do bstOf: é o que garante que a raridade desenhada é a
    // mesma que o filtro do banco usou pra achar esta carta.
    bst: row.pokemon.bst,
    // `rarity` é String no Prisma (não há enum no schema). O cast é a leitura
    // do contrato que o syncPokedex escreveu — mesmo padrão do baseStats Json.
    rarity: row.pokemon.rarity as RarityTier,
    baseStats: row.pokemon.baseStats as unknown as BaseStats,
    pokemon: {
      id: row.pokemon.pokemonApiId,
      name: row.pokemon.name,
      artworkUrl: row.pokemon.spriteUrl,
      iconUrl: row.pokemon.spriteUrl,
      types: row.pokemon.types as string[],
    },
  };
}
```

- [ ] **Step 5: Rode e confirme que passa**

```
npx vitest run tests/modules/pokedex/queries/toCollectionPageDTO.test.ts
```

Esperado: PASS.

- [ ] **Step 6: Escreva a query**

Crie `src/modules/pokedex/queries/getCollectionPage.ts`:

```ts
import { prisma } from "@/src/lib/prisma";
import { readDeck } from "@/src/modules/deck";
import {
  COLLECTION_PAGE_SIZE,
  hasActiveFilter,
  type CollectionFilters,
} from "../domain/collectionFilters";
import type { CollectionPageDTO } from "../ui/types";
import { buildCollectionWhere, orderByFor } from "./collectionWhere";
import { COLLECTION_CARD_SELECT, toCollectionCardDTO } from "./toCollectionPageDTO";

/**
 * Uma PÁGINA da coleção, já filtrada e ordenada pelo banco.
 *
 * Substituiu o antigo `getCollection`, que carregava a coleção INTEIRA e
 * filtrava/ordenava em JS. Aqui nenhuma carta fora da página sai do Postgres.
 *
 * Só LÊ, e não faz I/O de rede (tudo vem do espelho local) — pode ser chamada
 * do render de uma page (CLAUDE.md, regra 2).
 *
 * Sem `$transaction`: são leituras, e uma divergência de milissegundos entre o
 * `count` e o `findMany` não corrompe nada — no pior caso a última página conta
 * uma carta a mais por um instante.
 */
export async function getCollectionPage(
  userId: string,
  filters: CollectionFilters
): Promise<CollectionPageDTO> {
  const where = buildCollectionWhere(userId, filters);
  const filtrando = hasActiveFilter(filters);

  const [rows, totalCards, deck, totalFiltradoFora] = await Promise.all([
    prisma.userPokemon.findMany({
      where,
      orderBy: orderByFor(filters.sort),
      skip: (filters.page - 1) * COLLECTION_PAGE_SIZE,
      take: COLLECTION_PAGE_SIZE,
      select: COLLECTION_CARD_SELECT,
    }),
    prisma.userPokemon.count({ where }),
    readDeck(userId),
    // Só quando há filtro: sem filtro os dois totais são o mesmo número, e
    // mandar a query duas vezes seria uma invocação a mais por page load sem
    // nada em troca (CLAUDE.md §5 — cota).
    filtrando ? prisma.userPokemon.count({ where: { userId } }) : Promise.resolve(null),
  ]);

  return {
    cards: rows.map(toCollectionCardDTO),
    deck: deck
      ? {
          id: deck.id,
          slots: deck.slots.map((s) => ({ id: s.id, userPokemonId: s.userPokemonId })),
        }
      : null,
    page: filters.page,
    totalPages: Math.max(1, Math.ceil(totalCards / COLLECTION_PAGE_SIZE)),
    totalCards,
    totalInCollection: totalFiltradoFora ?? totalCards,
    filters,
  };
}
```

- [ ] **Step 7: Corte o `getCollection`**

```bash
git rm src/modules/pokedex/queries/getCollection.ts
```

Em `src/modules/pokedex/index.ts`:
- troque `export { getCollection } from "./queries/getCollection";` (linha 33) por:

```ts
export { getCollectionPage } from "./queries/getCollectionPage";
export {
  COLLECTION_PAGE_SIZE,
  POKEMON_TYPES,
  RARITY_TIERS,
  parseCollectionFilters,
  hasActiveFilter,
  collectionHref,
} from "./domain/collectionFilters";
export type { CollectionFilters, CollectionSort } from "./domain/collectionFilters";
```

- acrescente `CollectionPageDTO` à lista de `export type` (linha ~9).

Deixar as duas queries vivas criaria duas leituras da coleção que podem discordar de raridade — por isso é corte, não coexistência. O único consumidor era a page, que a Tarefa 11 reescreve.

- [ ] **Step 8: Verifique e commite**

O `tsc` vai acusar `app/(game)/pokedex/page.tsx` — é esperado, a Tarefa 11 conserta. **Confirme que é o único erro** e que ele fala só de `getCollection`/`collectionView`:

```bash
npx tsc --noEmit
npx vitest run && npx eslint
git add -A src/modules/pokedex tests/modules/pokedex
git commit -m "feat(pokedex): getCollectionPage paginado no banco, getCollection removido"
```

---

### Task 9: `Pagination` reaproveitável (e o conserto do catálogo)

Hoje o componente tem `href="/?page=N"` cravado — a paginação do catálogo joga o usuário pra home.

**Files:**
- Modify: `src/modules/pokedex/ui/Pagination.tsx`
- Modify: `src/app/(game)/catalog/page.tsx:41`
- Test: `tests/modules/pokedex/ui/paginationView.test.ts`
- Create: `src/modules/pokedex/ui/paginationView.ts`

**Interfaces:**
- Produces:
  - `paginationView(page: number, totalPages: number): { prevPage: number; nextPage: number; prevDisabled: boolean; nextDisabled: boolean; label: string; totalLabel: string }`
  - `<Pagination page totalPages hrefFor />` onde `hrefFor: (page: number) => string`

- [ ] **Step 1: Escreva o teste da regra de apresentação**

Crie `tests/modules/pokedex/ui/paginationView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { paginationView } from "@/src/modules/pokedex/ui/paginationView";

describe("paginationView", () => {
  it("na primeira página, o anterior está travado", () => {
    const v = paginationView(1, 5);
    expect(v.prevDisabled).toBe(true);
    expect(v.nextDisabled).toBe(false);
    expect(v.nextPage).toBe(2);
  });

  it("na última, o próximo está travado", () => {
    const v = paginationView(5, 5);
    expect(v.prevDisabled).toBe(false);
    expect(v.nextDisabled).toBe(true);
    expect(v.prevPage).toBe(4);
  });

  it("com uma página só, os dois travam", () => {
    const v = paginationView(1, 1);
    expect(v.prevDisabled).toBe(true);
    expect(v.nextDisabled).toBe(true);
  });

  it("página além do fim trava o próximo", () => {
    // Acontece de verdade: o parser não recorta o teto (só a query sabe o
    // total), então ?page=99 numa coleção de 2 páginas chega aqui.
    expect(paginationView(99, 2).nextDisabled).toBe(true);
  });

  it("formata os rótulos com dois dígitos", () => {
    const v = paginationView(3, 12);
    expect(v.label).toBe("03");
    expect(v.totalLabel).toBe("12");
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
npx vitest run tests/modules/pokedex/ui/paginationView.test.ts
```

Esperado: FAIL — módulo inexistente.

- [ ] **Step 3: Implemente o view**

Crie `src/modules/pokedex/ui/paginationView.ts`:

```ts
// Regra de apresentação da paginação. Pura e testada — componente é costura
// (CLAUDE.md, regra 4).

export interface PaginationView {
  prevPage: number;
  nextPage: number;
  prevDisabled: boolean;
  nextDisabled: boolean;
  /** a página atual, dois dígitos */
  label: string;
  /** o total, dois dígitos */
  totalLabel: string;
}

export function paginationView(page: number, totalPages: number): PaginationView {
  return {
    prevPage: page - 1,
    nextPage: page + 1,
    prevDisabled: page <= 1,
    // `>=` e não `===`: o parser dos filtros não recorta o teto (só a query
    // sabe o total), então uma página além do fim chega aqui de verdade.
    nextDisabled: page >= totalPages,
    label: String(page).padStart(2, "0"),
    totalLabel: String(totalPages).padStart(2, "0"),
  };
}
```

- [ ] **Step 4: Rode e confirme que passa**

```
npx vitest run tests/modules/pokedex/ui/paginationView.test.ts
```

- [ ] **Step 5: Reescreva o componente**

`src/modules/pokedex/ui/Pagination.tsx` inteiro:

```tsx
import Link from "next/link";
import { paginationView } from "./paginationView";

// Server Component. A paginação é navegação por URL — não precisa de estado nem
// de JS no cliente pra funcionar.
//
// O href vem por PROP. Antes era "/?page=N" cravado aqui, o que jogava o
// usuário do catálogo pra home; e a coleção precisa preservar q/type/rarity/sort
// ao virar de página, o que nenhum href fixo consegue.

const BASE = "clip-btn px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors";

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className={`${BASE} border border-edge text-ink-dim opacity-40`}>{children}</span>;
  }

  return (
    <Link
      href={href}
      className={`${BASE} border border-edge text-ink-dim hover:border-energy/60 hover:text-energy`}
    >
      {children}
    </Link>
  );
}

export default function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  const v = paginationView(page, totalPages);

  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <PageLink href={hrefFor(v.prevPage)} disabled={v.prevDisabled}>
        ← Anterior
      </PageLink>
      <span className="plate bg-panel-2 border border-edge px-4 py-2">
        <span className="plate-inner font-title text-sm tracking-wider">
          {v.label} / {v.totalLabel}
        </span>
      </span>
      <PageLink href={hrefFor(v.nextPage)} disabled={v.nextDisabled}>
        Próxima →
      </PageLink>
    </div>
  );
}
```

- [ ] **Step 6: Conserte o catálogo**

Em `src/app/(game)/catalog/page.tsx`, linha 41:

```tsx
      <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/catalog?page=${p}`} />
```

Isso conserta um bug existente: a paginação do catálogo levava pra `/`.

- [ ] **Step 7: Verifique e commite**

```bash
npx tsc --noEmit && npx vitest run && npx eslint
git add src/modules/pokedex/ui/Pagination.tsx src/modules/pokedex/ui/paginationView.ts tests/modules/pokedex/ui/paginationView.test.ts "src/app/(game)/catalog/page.tsx"
git commit -m "fix(pokedex): Pagination recebe hrefFor — conserta o catálogo indo pra home"
```

---

### Task 10: `collectionView` adaptado + view dos controles

`collectionView` hoje **não tem teste**, apesar de ser exatamente o tipo de função que a regra 4 manda testar. Esta fatia mexe nele, então o teste entra junto.

**Files:**
- Modify: `src/modules/pokedex/ui/pokedexView.ts:64-135`
- Create: `src/modules/pokedex/ui/collectionFilterView.ts`
- Test: `tests/modules/pokedex/ui/pokedexView.test.ts`
- Test: `tests/modules/pokedex/ui/collectionFilterView.test.ts`

**Interfaces:**
- Consumes: `CollectionPageDTO` (Task 8), `collectionHref`, `POKEMON_TYPES`, `RARITY_TIERS`, `hasActiveFilter` (Task 6).
- Produces:
  - `collectionView(page: CollectionPageDTO): CollectionView` — agora recebe o DTO paginado; `CollectionView` ganha `page`, `totalPages`, `totalCards`, `emptyState`.
  - `collectionFilterView(filters: CollectionFilters): CollectionFilterView`

- [ ] **Step 1: Escreva o teste do `collectionFilterView`**

Crie `tests/modules/pokedex/ui/collectionFilterView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { collectionFilterView } from "@/src/modules/pokedex/ui/collectionFilterView";
import { parseCollectionFilters } from "@/src/modules/pokedex/domain/collectionFilters";

describe("collectionFilterView", () => {
  it("oferece 18 tipos + a opção 'todos'", () => {
    const v = collectionFilterView(parseCollectionFilters({}));
    expect(v.typeOptions).toHaveLength(19);
    expect(v.typeOptions[0]).toEqual({ value: "", label: "Todos os tipos" });
  });

  it("oferece as 4 raridades + 'todas', com rótulo em português", () => {
    const v = collectionFilterView(parseCollectionFilters({}));
    expect(v.rarityOptions).toHaveLength(5);
    expect(v.rarityOptions.map((o) => o.label)).toEqual([
      "Todas as raridades",
      "Comum",
      "Incomum",
      "Rara",
      "Lendária",
    ]);
  });

  it("marca o valor selecionado", () => {
    const v = collectionFilterView(parseCollectionFilters({ type: "fire", rarity: "rare" }));
    expect(v.selectedType).toBe("fire");
    expect(v.selectedRarity).toBe("rare");
  });

  it("sem filtro, não mostra o botão de limpar", () => {
    expect(collectionFilterView(parseCollectionFilters({})).showClear).toBe(false);
  });

  it("com filtro, mostra o botão de limpar apontando pra coleção limpa", () => {
    const v = collectionFilterView(parseCollectionFilters({ q: "pika", page: "4" }));
    expect(v.showClear).toBe(true);
    expect(v.clearHref).toBe("/pokedex");
  });

  it("preserva a ordenação ao limpar os filtros", () => {
    // Ordenação não é filtro: limpar "fogo" não pode desfazer "por nível".
    const v = collectionFilterView(parseCollectionFilters({ type: "fire", sort: "level_desc" }));
    expect(v.clearHref).toBe("/pokedex?sort=level_desc");
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
npx vitest run tests/modules/pokedex/ui/collectionFilterView.test.ts
```

- [ ] **Step 3: Implemente o `collectionFilterView`**

Crie `src/modules/pokedex/ui/collectionFilterView.ts`:

```ts
// O que a barra de filtros DESENHA. Puro e testado — componente é costura
// (CLAUDE.md, regra 4). Importa só de domain/, nunca de queries/commands.

import {
  POKEMON_TYPES,
  RARITY_TIERS,
  collectionHref,
  hasActiveFilter,
  type CollectionFilters,
} from "../domain/collectionFilters";

export interface FilterOption {
  value: string;
  label: string;
}

export interface CollectionFilterView {
  query: string;
  typeOptions: FilterOption[];
  rarityOptions: FilterOption[];
  sortOptions: FilterOption[];
  selectedType: string;
  selectedRarity: string;
  selectedSort: string;
  showClear: boolean;
  /** href que zera busca/tipo/raridade mas PRESERVA a ordenação */
  clearHref: string;
}

const RARITY_LABELS: Record<string, string> = {
  common: "Comum",
  uncommon: "Incomum",
  rare: "Rara",
  legendary: "Lendária",
};

// Os nomes de tipo vêm da PokéAPI em inglês e minúsculo ("fire"). A tela é em
// português, e a tradução é decisão de apresentação — mora aqui.
const TYPE_LABELS: Record<string, string> = {
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  electric: "Elétrico",
  grass: "Planta",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Venenoso",
  ground: "Terrestre",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Sombrio",
  steel: "Aço",
  fairy: "Fada",
};

export function collectionFilterView(filters: CollectionFilters): CollectionFilterView {
  return {
    query: filters.q ?? "",
    typeOptions: [
      { value: "", label: "Todos os tipos" },
      ...POKEMON_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] ?? t })),
    ],
    rarityOptions: [
      { value: "", label: "Todas as raridades" },
      ...RARITY_TIERS.map((r) => ({ value: r, label: RARITY_LABELS[r] ?? r })),
    ],
    sortOptions: [
      { value: "captured", label: "Ordem de captura" },
      { value: "level_desc", label: "Nível — maior primeiro" },
      { value: "level_asc", label: "Nível — menor primeiro" },
    ],
    selectedType: filters.type ?? "",
    selectedRarity: filters.rarity ?? "",
    selectedSort: filters.sort,
    showClear: hasActiveFilter(filters),
    // Ordenação NÃO é filtro: limpar "fogo" não pode desfazer "por nível".
    clearHref: collectionHref(filters, { q: null, type: null, rarity: null }),
  };
}
```

- [ ] **Step 4: Rode e confirme que passa**

```
npx vitest run tests/modules/pokedex/ui/collectionFilterView.test.ts
```

Se o rótulo de tipo do teste discordar, ajuste o teste — o que ele tranca é a **quantidade** e a opção "todos", não a tradução exata.

- [ ] **Step 5: Adapte o `collectionView` e escreva o teste que faltava**

Em `src/modules/pokedex/ui/pokedexView.ts`, a assinatura vira `collectionView(page: CollectionPageDTO)`, e a interface `CollectionView` ganha:

```ts
export type CollectionEmptyState = "none" | "collection" | "filter";

export interface CollectionView {
  cards: CollectionCardView[];
  deckSlots: DeckSlotView[];
  deckCount: number;
  deckLimit: number;
  page: number;
  totalPages: number;
  totalCards: number;
  /**
   * Qual vazio mostrar. "collection" = não tem carta nenhuma (manda capturar);
   * "filter" = tem cartas, o filtro é que não achou (manda limpar). São telas
   * diferentes, e sem os dois totais não dá pra distinguir.
   */
  emptyState: CollectionEmptyState;
}
```

O corpo muda em três pontos:
- `const slots = page.deck?.slots ?? []` e `page.cards` no lugar de `collection.*`;
- o `isEmpty` sai, e no lugar dele:

```ts
  const emptyState: CollectionEmptyState =
    page.cards.length > 0 ? "none" : page.totalInCollection === 0 ? "collection" : "filter";
```

- o retorno passa a levar `page: page.page`, `totalPages`, `totalCards` e `emptyState`.

Crie `tests/modules/pokedex/ui/pokedexView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { collectionView, dexNumber } from "@/src/modules/pokedex/ui/pokedexView";
import { parseCollectionFilters } from "@/src/modules/pokedex/domain/collectionFilters";
import { DECK_LIMIT } from "@/src/modules/deck/domain/rules";
import type { CollectionPageDTO } from "@/src/modules/pokedex/ui/types";

const BASE_STATS = { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 };

const carta = (id: string, pokemonId: number) => ({
  userPokemonId: id,
  pokemonId,
  level: 10,
  xp: 1000,
  bst: 309,
  rarity: "common" as const,
  baseStats: BASE_STATS,
  pokemon: {
    id: pokemonId,
    name: "charmander",
    artworkUrl: "a.png",
    iconUrl: "i.png",
    types: ["fire"],
  },
});

const pagina = (over: Partial<CollectionPageDTO> = {}): CollectionPageDTO => ({
  cards: [carta("up-1", 4)],
  deck: null,
  page: 1,
  totalPages: 1,
  totalCards: 1,
  totalInCollection: 1,
  filters: parseCollectionFilters({}),
  ...over,
});

describe("dexNumber", () => {
  it("preenche com zero à esquerda", () => {
    expect(dexNumber(25)).toBe("#0025");
    expect(dexNumber(1025)).toBe("#1025");
  });
});

describe("collectionView", () => {
  it("sempre devolve DECK_LIMIT vagas, mesmo sem deck", () => {
    expect(collectionView(pagina()).deckSlots).toHaveLength(DECK_LIMIT);
  });

  it("marca a carta que está no deck e dá o id da vaga", () => {
    const v = collectionView(
      pagina({ deck: { id: "d1", slots: [{ id: "slot-9", userPokemonId: "up-1" }] } })
    );
    expect(v.cards[0].inDeck).toBe(true);
    expect(v.cards[0].deckSlotId).toBe("slot-9");
    expect(v.deckCount).toBe(1);
  });

  it("usa o primeiro tipo como cor de destaque", () => {
    expect(collectionView(pagina()).cards[0].accentType).toBe("fire");
  });

  it("sem carta e sem coleção, o vazio é de COLEÇÃO", () => {
    const v = collectionView(pagina({ cards: [], totalCards: 0, totalInCollection: 0 }));
    expect(v.emptyState).toBe("collection");
  });

  it("sem carta MAS com coleção, o vazio é de FILTRO", () => {
    // O jogador tem 40 cartas e filtrou "lendária" sem ter nenhuma. Tela
    // diferente: manda limpar o filtro, não capturar.
    const v = collectionView(pagina({ cards: [], totalCards: 0, totalInCollection: 40 }));
    expect(v.emptyState).toBe("filter");
  });

  it("com carta, não há vazio", () => {
    expect(collectionView(pagina()).emptyState).toBe("none");
  });
});
```

- [ ] **Step 6: Rode e confirme que passa**

```
npx vitest run tests/modules/pokedex/ui
```

- [ ] **Step 7: Prove que o teste dos dois vazios é capaz de falhar**

Troque o `emptyState` por `page.cards.length > 0 ? "none" : "collection"` fixo, rode, confirme FAIL no teste "vazio é de FILTRO", e desfaça.

- [ ] **Step 8: Verifique e commite**

`tsc` ainda acusa a page — esperado até a Tarefa 11.

```bash
npx vitest run && npx eslint
git add src/modules/pokedex/ui tests/modules/pokedex/ui
git commit -m "feat(pokedex): collectionView paginado + view dos filtros, com teste"
```

---

### Task 11: A barra de filtros, a page, e o fechamento

**Files:**
- Create: `src/modules/pokedex/ui/CollectionFilterBar.tsx`
- Modify: `src/app/(game)/pokedex/page.tsx` (inteira)
- Modify: `CLAUDE.md`, `README.md`, `PLANO_JOGO.md`

**Interfaces:**
- Consumes: tudo das tarefas anteriores.

- [ ] **Step 1: Escreva a barra de filtros**

Crie `src/modules/pokedex/ui/CollectionFilterBar.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { collectionHref, type CollectionFilters } from "../domain/collectionFilters";
import { collectionFilterView } from "./collectionFilterView";

// O ÚNICO componente cliente desta tela. Existe por dois motivos que o servidor
// não resolve: o debounce da busca (sem ele, cada tecla vira uma navegação, e
// cada navegação é uma invocação de lambda — CLAUDE.md §5, cota) e o
// `useTransition`, que evita a tela piscar entre uma página e outra.
//
// Ele NÃO busca dado. Ele só troca a URL; quem repinta é o servidor. Por isso a
// page continua Server Component e não há estado de "carregando".

const DEBOUNCE_MS = 300;

const SELECT_CLASS =
  "clip-btn border border-edge bg-panel-2 px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-dim";

export default function CollectionFilterBar({ filters }: { filters: CollectionFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const v = collectionFilterView(filters);

  const [query, setQuery] = useState(v.query);
  // Guarda o valor que veio do servidor pra distinguir "o usuário digitou" de
  // "a URL mudou por outro caminho" (limpar filtro, voltar no browser).
  const vindoDoServidor = useRef(v.query);

  useEffect(() => {
    if (vindoDoServidor.current !== v.query) {
      vindoDoServidor.current = v.query;
      setQuery(v.query);
    }
  }, [v.query]);

  useEffect(() => {
    if (query === v.query) return;
    const t = setTimeout(() => {
      vindoDoServidor.current = query;
      startTransition(() => router.replace(collectionHref(filters, { q: query || null })));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, v.query, filters, router]);

  const navegar = (patch: Partial<CollectionFilters>) =>
    startTransition(() => router.replace(collectionHref(filters, patch)));

  return (
    <div
      className={`clip-card mb-6 flex flex-wrap items-center gap-3 border border-edge p-4 ${
        pending ? "opacity-70" : ""
      }`}
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome..."
        maxLength={50}
        aria-label="Buscar carta por nome"
        className="clip-btn min-w-[12rem] flex-1 border border-edge bg-panel-2 px-3 py-2 text-sm font-semibold text-ink"
      />

      <select
        value={v.selectedRarity}
        onChange={(e) => navegar({ rarity: (e.target.value || null) as CollectionFilters["rarity"] })}
        aria-label="Filtrar por raridade"
        className={SELECT_CLASS}
      >
        {v.rarityOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={v.selectedType}
        onChange={(e) => navegar({ type: e.target.value || null })}
        aria-label="Filtrar por tipo"
        className={SELECT_CLASS}
      >
        {v.typeOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={v.selectedSort}
        onChange={(e) => navegar({ sort: e.target.value as CollectionFilters["sort"] })}
        aria-label="Ordenar"
        className={SELECT_CLASS}
      >
        {v.sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {v.showClear && (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(v.clearHref))}
          className="clip-btn border border-edge px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-dim transition-colors hover:border-flare/60 hover:text-flare"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reescreva a page**

`src/app/(game)/pokedex/page.tsx` inteira:

```tsx
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/modules/auth/auth";
import { collectionHref, getCollectionPage, parseCollectionFilters } from "@/src/modules/pokedex";
import CollectionFilterBar from "@/src/modules/pokedex/ui/CollectionFilterBar";
import CollectionGrid from "@/src/modules/pokedex/ui/CollectionGrid";
import DeckSlots from "@/src/modules/pokedex/ui/DeckSlots";
import Pagination from "@/src/modules/pokedex/ui/Pagination";
import { collectionView } from "@/src/modules/pokedex/ui/pokedexView";

// Server Component. Filtro, busca, ordenação e paginação vivem na URL, e quem
// resolve tudo é o BANCO — nenhuma carta fora da página de 16 sai do Postgres.
// Nenhum fetch de cliente, nenhum estado de "carregando": o HTML já sai pintado.
export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filters = parseCollectionFilters(await searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const page = await getCollectionPage(session.user.id, filters);
  const view = collectionView(page);

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-title text-3xl uppercase tracking-wide">
            Minha <span className="text-energy">Coleção</span>
          </h1>
          <p className="text-sm font-semibold text-ink-dim">
            Monte um deck de até {view.deckLimit} pokémons para batalhar.
          </p>
        </div>
        {view.totalCards > 0 && (
          <p className="font-title text-sm tracking-wider text-ink-dim">
            <span className="text-ink">{view.totalCards}</span>{" "}
            {view.totalCards === 1 ? "CARTA" : "CARTAS"}
          </p>
        )}
      </div>

      <DeckSlots slots={view.deckSlots} deckCount={view.deckCount} deckLimit={view.deckLimit} />

      <CollectionFilterBar filters={filters} />

      {view.emptyState === "collection" && (
        <div className="clip-card border border-dashed border-edge p-10 text-center">
          <p className="mb-2 font-title text-lg uppercase tracking-wide">Coleção vazia</p>
          <p className="mb-4 text-sm font-semibold text-ink-dim">
            Abra pacotes para começar a colecionar.
          </p>
          <Link
            href="/packs"
            className="clip-btn inline-block bg-flare px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-flare-dark"
          >
            Abrir um pacote
          </Link>
        </div>
      )}

      {view.emptyState === "filter" && (
        <div className="clip-card border border-dashed border-edge p-10 text-center">
          <p className="mb-2 font-title text-lg uppercase tracking-wide">Nenhuma carta encontrada</p>
          <p className="mb-4 text-sm font-semibold text-ink-dim">
            Nenhuma das suas {page.totalInCollection} cartas bate com esses filtros.
          </p>
          <Link
            href={collectionHref(filters, { q: null, type: null, rarity: null })}
            className="clip-btn inline-block border border-edge px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink-dim transition-colors hover:border-energy/60 hover:text-energy"
          >
            Limpar filtros
          </Link>
        </div>
      )}

      {view.emptyState === "none" && (
        <>
          <CollectionGrid cards={view.cards} />
          {view.totalPages > 1 && (
            <Pagination
              page={view.page}
              totalPages={view.totalPages}
              hrefFor={(p) => collectionHref(filters, { page: p })}
            />
          )}
        </>
      )}
    </div>
  );
}
```

O botão do vazio mudou de "Ir para a PokéDex" (`/`) pra "Abrir um pacote" (`/packs`): captura direta não existe mais, obter pokémon é só pelo pacote.

- [ ] **Step 3: Verificação completa**

```bash
npx tsc --noEmit
npx vitest run
npx eslint
npx next build
```

Todos têm que passar limpos. `tsc` **não** pode mais acusar a page.

- [ ] **Step 4: Rode de verdade e confirme na tela**

```bash
npm run dev
```

Com uma conta que tenha cartas, confira em `/pokedex`:
1. Sem filtro, aparecem no máximo 16 cartas e a paginação aparece se houver mais.
2. Digitar no campo de busca **não** navega a cada tecla (espera ~300ms) e a URL vira `?q=...`.
3. Trocar raridade/tipo com a paginação na página 2 **volta pra página 1**.
4. Trocar ordenação **preserva** o filtro; "Limpar filtros" **preserva** a ordenação.
5. Filtrar por algo que você não tem mostra "Nenhuma carta encontrada", não "Coleção vazia".
6. `/pokedex?page=999` mostra "Nenhuma carta encontrada" e não quebra.
7. Recarregar com a URL filtrada dá a mesma tela (o estado está na URL, não na memória).
8. Em `/catalog`, "Próxima" vai pra `/catalog?page=2` e não pra home.

- [ ] **Step 5: Atualize os docs**

Terminar a tarefa inclui deixar os docs de acordo com o mundo novo.

**`CLAUDE.md`** — na seção de arquitetura, depois da regra 3 (DTO), acrescente:

```markdown
### 3.1 Guarda no banco o que o banco precisa CONSULTAR. Deriva o resto.

Guardar valor derivado não remove uma fonte de verdade — **adiciona** uma. Só
compensa quando o banco precisa filtrar ou ordenar por aquilo, porque aí não há
alternativa: não dá pra pôr num `WHERE` o que só existe em JS.

- `UserPokemon.xp` é a verdade; `level` é `f(xp)` mas está materializado
  **porque a coleção ordena por ele**. Os dois são escritos SEMPRE juntos, e só
  pelos helpers `progressionFromXp` / `progressionFromLevel`.
- `Pokemon.bst` e `Pokemon.rarity` são fatos imutáveis da ESPÉCIE, congelados na
  importação (`syncPokedex`). Ficam na espécie e não no `UserPokemon` porque a
  evolução troca `UserPokemon.pokemonId` — a carta muda de raridade sozinha ao
  evoluir. Cravado no `UserPokemon`, o valor velho ficaria pra trás pra sempre.
- Os 6 **stats derivados** (`deriveStats`) NÃO são guardados. São função de
  (espécie, nível), que já estão salvos; guardá-los obrigaria a reescrever tudo
  em todo level-up e toda evolução, e aqui não há worker pra reparar depois.
- `BattlePokemon.stats` é a exceção, e **não é cache — é isolamento**: o
  snapshot é congelado pra um level-up no meio não mudar a partida em andamento.

**Fronteira do BST:** `bstOf()`/`BST_BY_ID` (JS) é do **sorteio de pacotes**, que
pondera as 1025 espécies — a maioria não tem linha em `Pokemon`. Quem TEM a linha
lê `pokemon.bst`/`pokemon.rarity`. É o que garante que a raridade desenhada na
carta é a mesma que o filtro do banco usou pra achar ela.
```

Na seção "Dívida conhecida", **remova** a linha sobre `error.tsx` só se ela tiver sido resolvida (não foi — mantenha).

**`README.md`** — onde descreve a coleção, registre que ela é paginada (16 por página) e filtrável por raridade, tipo e nome, com tudo resolvido no banco.

**`PLANO_JOGO.md`** — registre o conserto: a evolução passou a ser checada em toda aplicação de XP (retroativa), não só quando a batalha faz subir de nível.

- [ ] **Step 6: Commite**

```bash
npx tsc --noEmit && npx vitest run && npx eslint && npx next build
git add -A
git commit -m "feat(pokedex): coleção com filtros, busca, ordenação e paginação no banco"
```

- [ ] **Step 7: Abra o PR**

```bash
git push -u origin collection-filters
gh pr create --title "Coleção filtrável + progressão com fonte única" --body "$(cat <<'EOF'
## O que muda

**Fase 1 — integridade da progressão**
- `Pokemon.bst` e `Pokemon.rarity`: fatos imutáveis da espécie, congelados na importação pelo `syncPokedex`, com backfill na migration.
- **Bug corrigido:** a evolução só era checada quando a batalha fazia subir de nível. Um pokémon que cruzou o gatilho enquanto a espécie-alvo não estava no espelho ficava preso na forma antiga pra sempre — no nível 100 a checagem nunca mais voltava. Agora é retroativa.
- `progressionFromXp` / `progressionFromLevel`: o par `(xp, level)` passa a ser escrito por construção, não por convenção.

**Fase 2 — a tela**
- Filtro por raridade e tipo, busca por nome, ordenação por nível e paginação de 16 — **tudo no Postgres**. Nenhuma carta fora da página sai do banco.
- O `ORDER BY` termina sempre em `id`: as 6 cartas de um pacote nascem com `capturedAt` idêntico (`createMany` numa transação), e sem desempate o `LIMIT/OFFSET` duplicava e sumia carta.
- Estado todo na URL — a page continua Server Component, sem fetch de cliente.
- **Bug corrigido de tabela:** o `Pagination` tinha `/?page=N` cravado, então a paginação do catálogo jogava o usuário pra home.

Spec: `docs/superpowers/specs/2026-08-01-collection-filters-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Ordem e dependências

```
Task 1 (helpers) ──┬─> Task 3 (syncPokedex)
Task 2 (migration) ┘   Task 4 (escritores)
                       Task 5 (evolução)

Task 6 (domain filtros) ──> Task 7 (where/orderBy) ──> Task 8 (query+DTO) ──┐
Task 9 (Pagination)  ─────────────────────────────────────────────────────┤
Task 10 (views)  ─────────────────────────────────────────────────────────┴─> Task 11 (UI+page+docs)
```

Tasks 3, 4 e 5 são independentes entre si. A Task 9 não depende de nenhuma das outras e pode ir a qualquer momento. **A Task 2 tem que vir antes da 3 e da 8** (o Prisma Client precisa das colunas).

## Se algo der errado

- **`array_contains` não filtrar (Task 7, Step 6):** pare. O plano B é `types` virar tabela de relação `PokemonType`, o que é migration nova (com `ENABLE ROW LEVEL SECURITY`, por ser tabela nova) e reescreve as Tasks 7, 8 e o `syncPokedex`. Reporte antes de tentar.
- **Alguma linha de `Pokemon` com `bst = 0` depois do backfill (Task 2, Step 6):** a chave do Json `baseStats` daquela espécie é diferente do esperado. Investigue a linha antes de seguir — seguir com `bst=0` classifica a espécie como `common` e o filtro mente.
- **Suíte quebrando em teste que você não escreveu:** não ajuste o teste pra passar. Ele está apontando uma mudança de comportamento que este plano não previu — reporte.
