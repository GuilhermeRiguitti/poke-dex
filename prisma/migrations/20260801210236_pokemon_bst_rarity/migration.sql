-- AlterTable
ALTER TABLE "Pokemon" ADD COLUMN     "bst" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rarity" TEXT NOT NULL DEFAULT 'common';

-- CreateIndex
CREATE INDEX "Pokemon_rarity_idx" ON "Pokemon"("rarity");

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
