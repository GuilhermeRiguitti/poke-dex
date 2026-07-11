-- CreateTable
CREATE TABLE `Battle` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('IN_PROGRESS', 'FINISHED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
    `currentTurn` INTEGER NOT NULL DEFAULT 1,
    `turnStartedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `winnerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BattleParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `battleId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `activeSlot` INTEGER NOT NULL DEFAULT 1,
    `missedTurns` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `BattleParticipant_battleId_userId_key`(`battleId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BattlePokemon` (
    `id` VARCHAR(191) NOT NULL,
    `participantId` VARCHAR(191) NOT NULL,
    `slot` INTEGER NOT NULL,
    `pokemonId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `spriteUrl` TEXT NULL,
    `types` JSON NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 50,
    `stats` JSON NOT NULL,
    `maxHp` INTEGER NOT NULL,
    `currentHp` INTEGER NOT NULL,
    `fainted` BOOLEAN NOT NULL DEFAULT false,
    `moves` JSON NOT NULL,

    UNIQUE INDEX `BattlePokemon_participantId_slot_key`(`participantId`, `slot`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BattlePendingMove` (
    `id` VARCHAR(191) NOT NULL,
    `battleId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `turnNumber` INTEGER NOT NULL,
    `actionType` ENUM('MOVE', 'SWITCH') NOT NULL,
    `moveSlot` INTEGER NULL,
    `switchToSlot` INTEGER NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BattlePendingMove_battleId_userId_turnNumber_key`(`battleId`, `userId`, `turnNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BattleTurnLog` (
    `id` VARCHAR(191) NOT NULL,
    `battleId` VARCHAR(191) NOT NULL,
    `turnNumber` INTEGER NOT NULL,
    `events` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BattleTurnLog_battleId_turnNumber_key`(`battleId`, `turnNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MatchmakingQueueEntry` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deckId` VARCHAR(191) NOT NULL,
    `enqueuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MatchmakingQueueEntry_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BattleParticipant` ADD CONSTRAINT `BattleParticipant_battleId_fkey` FOREIGN KEY (`battleId`) REFERENCES `Battle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BattlePokemon` ADD CONSTRAINT `BattlePokemon_participantId_fkey` FOREIGN KEY (`participantId`) REFERENCES `BattleParticipant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BattlePendingMove` ADD CONSTRAINT `BattlePendingMove_battleId_fkey` FOREIGN KEY (`battleId`) REFERENCES `Battle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BattleTurnLog` ADD CONSTRAINT `BattleTurnLog_battleId_fkey` FOREIGN KEY (`battleId`) REFERENCES `Battle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
