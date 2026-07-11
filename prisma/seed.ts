/**
 * Seed script — populates the database with Pokémon data from PokéAPI.
 *
 * Phases:
 *  1. Types (IDs 1-18) + TypeEffectiveness
 *  2. Stats (derived from first fetch, no extra calls)
 *  3. Pokémon (POKEMON_LIMIT entries with types, stats, abilities, move list)
 *  4. Abilities (one call per unique ability collected above)
 *  5. Moves (one call per unique move collected above)
 *  6. PokemonMove junction rows
 *
 * Usage:
 *   npx prisma db seed
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Change this to seed more generations (251 = Gen 2, 386 = Gen 3, 1010 = all) */
const POKEMON_LIMIT = 151;

const API = "https://pokeapi.co/api/v2";
const DELAY_MS = 90;

// ─── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json();
}

/** Extract numeric ID from a PokéAPI resource URL, e.g. ".../type/4/" → 4 */
function extractId(url: string): number {
  return parseInt(url.split("/").filter(Boolean).pop()!);
}

// ─── phase 1: types + effectiveness ──────────────────────────────────────────

async function seedTypes() {
  console.log("\n[1/6] Seeding types & type effectiveness…");

  const typeDataList: any[] = [];

  for (let id = 1; id <= 18; id++) {
    const data = await getJson(`${API}/type/${id}`);
    typeDataList.push(data);
    await sleep(DELAY_MS);

    await prisma.type.upsert({
      where: { id: data.id },
      update: { name: data.name },
      create: { id: data.id, name: data.name },
    });
    process.stdout.write(`  type ${data.name}\r`);
  }

  // Build type-effectiveness rows (only non-1× entries)
  for (const type of typeDataList) {
    const attackerId: number = type.id;
    const { damage_relations } = type;

    const pairs: { url: string; multiplier: number }[] = [
      ...damage_relations.double_damage_to.map((t: any) => ({ url: t.url, multiplier: 2 })),
      ...damage_relations.half_damage_to.map((t: any) => ({ url: t.url, multiplier: 0.5 })),
      ...damage_relations.no_damage_to.map((t: any) => ({ url: t.url, multiplier: 0 })),
    ];

    for (const { url, multiplier } of pairs) {
      const defenderId = extractId(url);
      if (defenderId < 1 || defenderId > 18) continue;

      await prisma.typeEffectiveness.upsert({
        where: {
          attackerTypeId_defenderTypeId: { attackerTypeId: attackerId, defenderTypeId: defenderId },
        },
        update: { multiplier },
        create: { attackerTypeId: attackerId, defenderTypeId: defenderId, multiplier },
      });
    }
  }

  console.log(`  ✓ 18 types seeded`);
}

// ─── phase 3-6: pokémon, abilities, moves ────────────────────────────────────

async function seedPokemon() {
  console.log(`\n[2/6] Fetching Pokémon list (limit=${POKEMON_LIMIT})…`);

  const list = await getJson(`${API}/pokemon?limit=${POKEMON_LIMIT}&offset=0`);

  // Collected across all pokemon for batch seeding later
  const abilityIds = new Set<number>();
  const moveIds = new Set<number>();
  /** key: `${pokemonId}-${moveId}-${learnMethod}` */
  const pendingMoves = new Map<
    string,
    { pokemonId: number; moveId: number; learnMethod: string; levelLearnedAt: number }
  >();

  console.log(`[3/6] Seeding ${list.results.length} Pokémon…`);

  for (const item of list.results as { name: string; url: string }[]) {
    const p = await getJson(item.url);
    await sleep(DELAY_MS);

    const artwork =
      p.sprites?.other?.["official-artwork"]?.front_default ?? null;

    // ── Pokemon row ──────────────────────────────────────────────────────────
    await prisma.pokemon.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        name: p.name,
        baseExperience: p.base_experience ?? null,
        height: p.height,
        weight: p.weight,
        spriteDefault: p.sprites?.front_default ?? null,
        spriteShiny: p.sprites?.front_shiny ?? null,
        spriteArtwork: artwork,
        cryUrl: p.cries?.latest ?? null,
      },
    });

    // ── Stats ────────────────────────────────────────────────────────────────
    for (const s of p.stats as any[]) {
      const statId = extractId(s.stat.url);

      await prisma.stat.upsert({
        where: { id: statId },
        update: { name: s.stat.name },
        create: { id: statId, name: s.stat.name },
      });

      await prisma.pokemonStat.upsert({
        where: { pokemonId_statId: { pokemonId: p.id, statId } },
        update: { baseStat: s.base_stat, effort: s.effort },
        create: { pokemonId: p.id, statId, baseStat: s.base_stat, effort: s.effort },
      });
    }

    // ── Types ────────────────────────────────────────────────────────────────
    for (const t of p.types as any[]) {
      const typeId = extractId(t.type.url);

      await prisma.pokemonType.upsert({
        where: { pokemonId_slot: { pokemonId: p.id, slot: t.slot } },
        update: { typeId },
        create: { pokemonId: p.id, typeId, slot: t.slot },
      });
    }

    // ── Abilities (collect IDs for later) ────────────────────────────────────
    for (const a of p.abilities as any[]) {
      const abilityId = extractId(a.ability.url);
      abilityIds.add(abilityId);

      // Upsert stub ability first to satisfy FK (phase 4 fills in details)
      await prisma.ability.upsert({
        where: { id: abilityId },
        update: {},
        create: { id: abilityId, name: a.ability.name },
      });

      await prisma.pokemonAbility.upsert({
        where: { pokemonId_slot: { pokemonId: p.id, slot: a.slot } },
        update: { abilityId, isHidden: a.is_hidden },
        create: { pokemonId: p.id, abilityId, isHidden: a.is_hidden, slot: a.slot },
      });
    }

    // ── Moves (collect for later) ────────────────────────────────────────────
    for (const m of p.moves as any[]) {
      const moveId = extractId(m.move.url);
      moveIds.add(moveId);

      for (const vgd of m.version_group_details as any[]) {
        const method: string = vgd.move_learn_method.name;
        const level: number = vgd.level_learned_at;
        const key = `${p.id}-${moveId}-${method}`;
        if (!pendingMoves.has(key)) {
          pendingMoves.set(key, {
            pokemonId: p.id,
            moveId,
            learnMethod: method,
            levelLearnedAt: level,
          });
        }
      }
    }

    process.stdout.write(`  ✓ ${p.name.padEnd(20)}\r`);
  }

  console.log(`  ✓ ${list.results.length} Pokémon seeded`);

  // ── Phase 4: Abilities ────────────────────────────────────────────────────
  console.log(`\n[4/6] Seeding ${abilityIds.size} abilities…`);

  for (const abilityId of abilityIds) {
    const data = await getJson(`${API}/ability/${abilityId}`);
    await sleep(DELAY_MS);

    const effect =
      (data.effect_entries as any[])?.find((e: any) => e.language.name === "en")
        ?.short_effect ?? null;

    await prisma.ability.upsert({
      where: { id: abilityId },
      update: {},
      create: { id: abilityId, name: data.name, effect },
    });
  }

  console.log(`  ✓ ${abilityIds.size} abilities seeded`);

  // ── Phase 5: Moves ────────────────────────────────────────────────────────
  console.log(`\n[5/6] Seeding ${moveIds.size} moves…`);

  for (const moveId of moveIds) {
    const data = await getJson(`${API}/move/${moveId}`);
    await sleep(DELAY_MS);

    const effect =
      (data.effect_entries as any[])?.find((e: any) => e.language.name === "en")
        ?.short_effect ?? null;

    const rawTypeId = data.type ? extractId(data.type.url) : null;
    const typeId = rawTypeId && rawTypeId >= 1 && rawTypeId <= 18 ? rawTypeId : null;

    await prisma.move.upsert({
      where: { id: moveId },
      update: {},
      create: {
        id: moveId,
        name: data.name,
        power: data.power ?? null,
        accuracy: data.accuracy ?? null,
        pp: data.pp ?? null,
        priority: data.priority ?? 0,
        damageClass: data.damage_class?.name ?? "status",
        typeId,
        effect,
        effectChance: data.effect_chance ?? null,
        ailment: data.meta?.ailment?.name ?? null,
        ailmentChance: data.meta?.ailment_chance ?? null,
        flinchChance: data.meta?.flinch_chance ?? null,
        minHits: data.meta?.min_hits ?? null,
        maxHits: data.meta?.max_hits ?? null,
        critRate: data.meta?.crit_rate ?? 0,
        healing: data.meta?.healing ?? 0,
      },
    });
  }

  console.log(`  ✓ ${moveIds.size} moves seeded`);

  // ── Phase 6: PokemonMove junction ─────────────────────────────────────────
  console.log(`\n[6/6] Seeding ${pendingMoves.size} pokemon-move associations…`);

  let skipped = 0;
  for (const pm of pendingMoves.values()) {
    try {
      await prisma.pokemonMove.upsert({
        where: {
          pokemonId_moveId_learnMethod: {
            pokemonId: pm.pokemonId,
            moveId: pm.moveId,
            learnMethod: pm.learnMethod,
          },
        },
        update: { levelLearnedAt: pm.levelLearnedAt },
        create: pm,
      });
    } catch {
      skipped++;
    }
  }

  const inserted = pendingMoves.size - skipped;
  console.log(`  ✓ ${inserted} associations seeded (${skipped} skipped)`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== PokéDex seed ===");
  console.log(`Target: ${POKEMON_LIMIT} Pokémon (Gen ${POKEMON_LIMIT <= 151 ? 1 : POKEMON_LIMIT <= 251 ? 2 : "N"})`);

  await seedTypes();
  await seedPokemon();

  console.log("\n✅ Seed complete!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
