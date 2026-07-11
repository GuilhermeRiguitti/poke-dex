-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `emailVerified` BOOLEAN NOT NULL,
    `image` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `accessTokenExpiresAt` DATETIME(3) NULL,
    `refreshTokenExpiresAt` DATETIME(3) NULL,
    `scope` VARCHAR(191) NULL,
    `idToken` TEXT NULL,
    `password` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Verification` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pokemon` (
    `id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `baseExperience` INTEGER NULL,
    `height` INTEGER NOT NULL,
    `weight` INTEGER NOT NULL,
    `spriteDefault` TEXT NULL,
    `spriteShiny` TEXT NULL,
    `spriteArtwork` TEXT NULL,
    `cryUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Pokemon_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Type` (
    `id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Type_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TypeEffectiveness` (
    `attackerTypeId` INTEGER NOT NULL,
    `defenderTypeId` INTEGER NOT NULL,
    `multiplier` DOUBLE NOT NULL,

    PRIMARY KEY (`attackerTypeId`, `defenderTypeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PokemonType` (
    `pokemonId` INTEGER NOT NULL,
    `typeId` INTEGER NOT NULL,
    `slot` INTEGER NOT NULL,

    PRIMARY KEY (`pokemonId`, `slot`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Stat` (
    `id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Stat_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PokemonStat` (
    `pokemonId` INTEGER NOT NULL,
    `statId` INTEGER NOT NULL,
    `baseStat` INTEGER NOT NULL,
    `effort` INTEGER NOT NULL,

    PRIMARY KEY (`pokemonId`, `statId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ability` (
    `id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `effect` TEXT NULL,

    UNIQUE INDEX `Ability_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PokemonAbility` (
    `pokemonId` INTEGER NOT NULL,
    `abilityId` INTEGER NOT NULL,
    `isHidden` BOOLEAN NOT NULL,
    `slot` INTEGER NOT NULL,

    PRIMARY KEY (`pokemonId`, `slot`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Move` (
    `id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `power` INTEGER NULL,
    `accuracy` INTEGER NULL,
    `pp` INTEGER NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `damageClass` VARCHAR(191) NOT NULL,
    `typeId` INTEGER NULL,
    `effect` TEXT NULL,
    `effectChance` INTEGER NULL,
    `ailment` VARCHAR(191) NULL,
    `ailmentChance` INTEGER NULL,
    `flinchChance` INTEGER NULL,
    `minHits` INTEGER NULL,
    `maxHits` INTEGER NULL,
    `critRate` INTEGER NOT NULL DEFAULT 0,
    `healing` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `Move_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PokemonMove` (
    `id` VARCHAR(191) NOT NULL,
    `pokemonId` INTEGER NOT NULL,
    `moveId` INTEGER NOT NULL,
    `learnMethod` VARCHAR(191) NOT NULL,
    `levelLearnedAt` INTEGER NOT NULL,

    INDEX `PokemonMove_pokemonId_idx`(`pokemonId`),
    UNIQUE INDEX `PokemonMove_pokemonId_moveId_learnMethod_key`(`pokemonId`, `moveId`, `learnMethod`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserCard` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `pokemonId` INTEGER NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserCard_userId_pokemonId_key`(`userId`, `pokemonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Deck` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'Meu Deck',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeckCard` (
    `id` VARCHAR(191) NOT NULL,
    `deckId` VARCHAR(191) NOT NULL,
    `userCardId` VARCHAR(191) NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DeckCard_deckId_userCardId_key`(`deckId`, `userCardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TypeEffectiveness` ADD CONSTRAINT `TypeEffectiveness_attackerTypeId_fkey` FOREIGN KEY (`attackerTypeId`) REFERENCES `Type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TypeEffectiveness` ADD CONSTRAINT `TypeEffectiveness_defenderTypeId_fkey` FOREIGN KEY (`defenderTypeId`) REFERENCES `Type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PokemonType` ADD CONSTRAINT `PokemonType_pokemonId_fkey` FOREIGN KEY (`pokemonId`) REFERENCES `Pokemon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PokemonType` ADD CONSTRAINT `PokemonType_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `Type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PokemonStat` ADD CONSTRAINT `PokemonStat_pokemonId_fkey` FOREIGN KEY (`pokemonId`) REFERENCES `Pokemon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PokemonStat` ADD CONSTRAINT `PokemonStat_statId_fkey` FOREIGN KEY (`statId`) REFERENCES `Stat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PokemonAbility` ADD CONSTRAINT `PokemonAbility_pokemonId_fkey` FOREIGN KEY (`pokemonId`) REFERENCES `Pokemon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PokemonAbility` ADD CONSTRAINT `PokemonAbility_abilityId_fkey` FOREIGN KEY (`abilityId`) REFERENCES `Ability`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Move` ADD CONSTRAINT `Move_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `Type`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PokemonMove` ADD CONSTRAINT `PokemonMove_pokemonId_fkey` FOREIGN KEY (`pokemonId`) REFERENCES `Pokemon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PokemonMove` ADD CONSTRAINT `PokemonMove_moveId_fkey` FOREIGN KEY (`moveId`) REFERENCES `Move`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCard` ADD CONSTRAINT `UserCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCard` ADD CONSTRAINT `UserCard_pokemonId_fkey` FOREIGN KEY (`pokemonId`) REFERENCES `Pokemon`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deck` ADD CONSTRAINT `Deck_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeckCard` ADD CONSTRAINT `DeckCard_deckId_fkey` FOREIGN KEY (`deckId`) REFERENCES `Deck`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeckCard` ADD CONSTRAINT `DeckCard_userCardId_fkey` FOREIGN KEY (`userCardId`) REFERENCES `UserCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
