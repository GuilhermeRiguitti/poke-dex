-- DropForeignKey
ALTER TABLE `TypeEffectiveness` DROP FOREIGN KEY `TypeEffectiveness_attackerTypeId_fkey`;

-- DropForeignKey
ALTER TABLE `TypeEffectiveness` DROP FOREIGN KEY `TypeEffectiveness_defenderTypeId_fkey`;

-- DropForeignKey
ALTER TABLE `PokemonType` DROP FOREIGN KEY `PokemonType_pokemonId_fkey`;

-- DropForeignKey
ALTER TABLE `PokemonType` DROP FOREIGN KEY `PokemonType_typeId_fkey`;

-- DropForeignKey
ALTER TABLE `PokemonStat` DROP FOREIGN KEY `PokemonStat_pokemonId_fkey`;

-- DropForeignKey
ALTER TABLE `PokemonStat` DROP FOREIGN KEY `PokemonStat_statId_fkey`;

-- DropForeignKey
ALTER TABLE `PokemonAbility` DROP FOREIGN KEY `PokemonAbility_pokemonId_fkey`;

-- DropForeignKey
ALTER TABLE `PokemonAbility` DROP FOREIGN KEY `PokemonAbility_abilityId_fkey`;

-- DropForeignKey
ALTER TABLE `Move` DROP FOREIGN KEY `Move_typeId_fkey`;

-- DropForeignKey
ALTER TABLE `PokemonMove` DROP FOREIGN KEY `PokemonMove_pokemonId_fkey`;

-- DropForeignKey
ALTER TABLE `PokemonMove` DROP FOREIGN KEY `PokemonMove_moveId_fkey`;

-- DropForeignKey
ALTER TABLE `UserCard` DROP FOREIGN KEY `UserCard_pokemonId_fkey`;

-- DropTable
DROP TABLE `Pokemon`;

-- DropTable
DROP TABLE `Type`;

-- DropTable
DROP TABLE `TypeEffectiveness`;

-- DropTable
DROP TABLE `PokemonType`;

-- DropTable
DROP TABLE `Stat`;

-- DropTable
DROP TABLE `PokemonStat`;

-- DropTable
DROP TABLE `Ability`;

-- DropTable
DROP TABLE `PokemonAbility`;

-- DropTable
DROP TABLE `Move`;

-- DropTable
DROP TABLE `PokemonMove`;

-- CreateTable
CREATE TABLE `PokeApiCache` (
    `key` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
