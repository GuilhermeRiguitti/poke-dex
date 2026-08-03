/*
  Warnings:

  - You are about to drop the `DeckSlotCard` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DeckSlotCard" DROP CONSTRAINT "DeckSlotCard_deckSlotId_fkey";

-- DropForeignKey
ALTER TABLE "DeckSlotCard" DROP CONSTRAINT "DeckSlotCard_moveId_fkey";

-- DropTable
DROP TABLE "DeckSlotCard";
