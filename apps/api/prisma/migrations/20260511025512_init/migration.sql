-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ParentStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "preferredReadingLevel" TEXT NOT NULL DEFAULT 'simple',
    "chunkMasteryThreshold" INTEGER NOT NULL DEFAULT 90,
    "finalSummaryMasteryThreshold" INTEGER NOT NULL DEFAULT 90,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'notStarted',
    "finalBestScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Material_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialChunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'notStarted',
    "bestScore" INTEGER,
    CONSTRAINT "MaterialChunk_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ParaphraseAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "chunkId" TEXT,
    "scope" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "rubricJson" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParaphraseAttempt_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ParaphraseAttempt_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "MaterialChunk" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiRoutingPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentProfileId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    CONSTRAINT "AiRoutingPreference_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudent_parentId_studentId_key" ON "ParentStudent"("parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialChunk_materialId_index_key" ON "MaterialChunk"("materialId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "AiRoutingPreference_studentProfileId_capability_key" ON "AiRoutingPreference"("studentProfileId", "capability");
