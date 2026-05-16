-- AlterTable: change StudentProfile threshold defaults from 90 to 80
-- Recreate table with new defaults (SQLite requires full table recreation to change defaults)
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "preferredReadingLevel" TEXT NOT NULL DEFAULT 'simple',
    "chunkMasteryThreshold" INTEGER NOT NULL DEFAULT 80,
    "finalSummaryMasteryThreshold" INTEGER NOT NULL DEFAULT 80,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StudentProfile" SELECT "id","userId","displayName","preferredReadingLevel","chunkMasteryThreshold","finalSummaryMasteryThreshold","createdAt","updatedAt" FROM "StudentProfile";
UPDATE "new_StudentProfile" SET "chunkMasteryThreshold" = 80 WHERE "chunkMasteryThreshold" = 90;
UPDATE "new_StudentProfile" SET "finalSummaryMasteryThreshold" = 80 WHERE "finalSummaryMasteryThreshold" = 90;
DROP TABLE "StudentProfile";
ALTER TABLE "new_StudentProfile" RENAME TO "StudentProfile";
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
