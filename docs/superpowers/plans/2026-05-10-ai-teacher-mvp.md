# AI Teacher MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working AI Teacher scaffold: React student/parent UI, REST API, material chunking, selected-text help, paraphrase retry state, configurable mastery thresholds, and AI routing preferences.

**Architecture:** Vite React frontend calls an Express REST API. Backend owns persistence, lesson state, AI routing, provider keys, and scoring orchestration. Local development uses Prisma with SQLite, with a clean path to PostgreSQL later.

**Tech Stack:** TypeScript, React, Vite, Express, Prisma, SQLite, Vitest, React Testing Library, Supertest, Google Identity Services, DeepSeek API, OpenAI API.

---

## Scope

This plan creates the first executable scaffold and core learning-loop foundation. Real Google OAuth, production DeepSeek/OpenAI calls, streaming TTS, OCR/photo extraction, and deployment get follow-up plans because each needs credentials and provider-specific testing.

## File Structure

```text
apps/web/src/app/App.tsx
apps/web/src/auth/GoogleLoginButton.tsx
apps/web/src/lessons/LessonReader.tsx
apps/web/src/lessons/ChunkNavigator.tsx
apps/web/src/lessons/SelectableText.tsx
apps/web/src/lessons/HelpPopover.tsx
apps/web/src/lessons/ParaphrasePanel.tsx
apps/web/src/parent/ParentDashboard.tsx
apps/web/src/parent/MaterialEditor.tsx
apps/web/src/settings/MasterySettings.tsx
apps/web/src/settings/AiRoutingSettings.tsx
apps/api/src/app.ts
apps/api/src/server.ts
apps/api/src/config/env.ts
apps/api/src/db/prisma.ts
apps/api/src/materials/chunker.ts
apps/api/src/materials/materialService.ts
apps/api/src/materials/materialRoutes.ts
apps/api/src/lessons/lessonService.ts
apps/api/src/scoring/rubric.ts
apps/api/src/ai/aiRouter.ts
apps/api/src/ai/aiTeachingService.ts
apps/api/src/ai/providers/deepSeekClient.ts
apps/api/src/ai/providers/openAiClient.ts
apps/api/prisma/schema.prisma
packages/shared/src/aiCapabilities.ts
packages/shared/src/types.ts
```

---

### Task 1: Initialize Workspace

**Files:** create root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, and package manifests for `apps/web`, `apps/api`, and `packages/shared`.

- [ ] Write root scripts: `dev`, `build`, `test`, `lint`, `db:generate`, `db:migrate`.
- [ ] Add workspace packages: `apps/*`, `packages/*`.
- [ ] Add TypeScript base config with strict mode.
- [ ] Add `.gitignore` for `node_modules`, `.env`, `dist`, `coverage`, SQLite dev DB, and `.superpowers`.
- [ ] Add dependencies: React/Vite for web, Express/Prisma for API, Vitest for tests.
- [ ] Run `pnpm install`.
- [ ] Commit: `chore: initialize ai teacher workspace`.

### Task 2: Shared Contracts

**Files:** `packages/shared/src/aiCapabilities.ts`, `packages/shared/src/types.ts`, tests.

- [ ] Write failing test that asserts capabilities include `simplifyText`, `explainContext`, `defineVocabulary`, `explainWhyItMatters`, `scoreChunkParaphrase`, `generateGapAwareExplanation`, `scoreFinalSummary`, `transcribeSpeech`, `generateSpeech`, `extractTextFromImage`, `fallback`.
- [ ] Implement `AI_CAPABILITIES`, `AI_PROVIDERS`, `AiCapability`, `AiProvider`, and `AiRoutingPreferences`.
- [ ] Implement shared types: `UserRole`, `ReadingLevel` without `closeToOriginal`, `MasterySettings`, `StudentProfile`, `MaterialChunk`, `ScoreRubric`, `ScoreResult`.
- [ ] Run `pnpm --filter @ai-teacher/shared test`.
- [ ] Commit: `feat: define shared ai teacher contracts`.

### Task 3: API Shell

**Files:** `apps/api/src/app.ts`, `server.ts`, `config/env.ts`, `.env.example`, tests.

- [ ] Write failing Supertest test for `GET /health` returning `{ "status": "ok" }`.
- [ ] Implement Express app with JSON body parsing and CORS.
- [ ] Implement env parsing for `PORT`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`.
- [ ] Run `pnpm --filter @ai-teacher/api test`.
- [ ] Commit: `feat: add api health check`.

### Task 4: Data Model

**Files:** `apps/api/prisma/schema.prisma`, `apps/api/src/db/prisma.ts`, schema tests.

- [ ] Write failing test that schema contains `User`, `ParentStudent`, `StudentProfile`, `Material`, `MaterialChunk`, `ParaphraseAttempt`, and `AiRoutingPreference`.
- [ ] Implement Prisma schema with parent/student linking, materials, chunks, attempts, thresholds, and routing preferences.
- [ ] Run `pnpm db:generate`.
- [ ] Run `pnpm db:migrate --name init`.
- [ ] Run API tests.
- [ ] Commit: `feat: add ai teacher data model`.

### Task 5: Material Chunking

**Files:** `apps/api/src/materials/chunker.ts`, tests.

- [ ] Write failing tests for paragraph splitting, trimming whitespace, and dropping empty chunks.
- [ ] Implement `chunkText(text)` returning `{ index, text }[]`.
- [ ] Run chunking tests.
- [ ] Commit: `feat: add material chunking`.

### Task 6: Material Creation API

**Files:** `materialRoutes.ts`, `materialService.ts`, `app.ts`, route tests.

- [ ] Write failing route tests for `POST /materials` with pasted text and `400` on empty text.
- [ ] Implement Zod input validation.
- [ ] Implement service that stores material and creates ordered chunks.
- [ ] Mount route at `/materials`.
- [ ] Run route tests.
- [ ] Commit: `feat: add material creation api`.

### Task 7: AI Routing Foundation

**Files:** `aiRouter.ts`, `aiTeachingService.ts`, `deepSeekClient.ts`, `openAiClient.ts`, tests.

- [ ] Write failing tests that route `simplifyText` to the selected provider.
- [ ] Test that disabled capabilities throw a clear error.
- [ ] Test that `browserTts` is rejected for backend-only work.
- [ ] Implement router with DeepSeek and OpenAI clients.
- [ ] Provider clients should throw clear missing-key errors until real API calls are added.
- [ ] Run AI router tests.
- [ ] Commit: `feat: add ai capability router`.

### Task 8: Scoring and Completion Rules

**Files:** `lessonService.ts`, `scoring/rubric.ts`, tests.

- [ ] Write failing tests for chunk threshold pass/fail.
- [ ] Write failing tests requiring all chunks plus final summary threshold for material completion.
- [ ] Implement `determineChunkStatus`, `determineMaterialStatus`, and `normalizeScoreResult`.
- [ ] Run lesson service tests.
- [ ] Commit: `feat: add mastery completion rules`.

### Task 9: Web Shell and Login

**Files:** `apps/web/index.html`, `main.tsx`, `App.tsx`, `GoogleLoginButton.tsx`, Vite config, tests.

- [ ] Write failing React test that the button says `Login with Google`.
- [ ] Implement Vite React shell.
- [ ] Implement initial Google login button; it can emit a dev credential until real Google Identity Services is integrated.
- [ ] Run web tests.
- [ ] Commit: `feat: add web app shell`.

### Task 10: Lesson Reader UI

**Files:** `LessonReader.tsx`, `ChunkNavigator.tsx`, tests.

- [ ] Write failing test that the reader displays `Chunk 2 of 2`.
- [ ] Write failing test that current chunk has `data-current="true"`.
- [ ] Write failing test that clicking/tapping another chunk selects it for review.
- [ ] Implement chunk navigation and current-chunk visual classes such as `current-reading-chunk`.
- [ ] Run lesson reader tests.
- [ ] Commit: `feat: add chunk-aware lesson reader`.

### Task 11: Selected Text Help

**Files:** `SelectableText.tsx`, `HelpPopover.tsx`, tests.

- [ ] Write failing test that double-clicking a word selects it.
- [ ] Write failing test that left/right expansion controls appear.
- [ ] Write failing test that help actions are `Simplify`, `Explain Context`, `Define`, `Why It Matters`, and `Read Aloud`.
- [ ] Write failing test that `Try Again` is not in the help popover.
- [ ] Implement a first token-based selection model with expandable handles.
- [ ] Run selected-text tests.
- [ ] Commit: `feat: add selected text help popover`.

### Task 12: Paraphrase Retry Panel

**Files:** `ParaphrasePanel.tsx`, tests.

- [ ] Write failing test that `Try Again` and `Explain Again` appear only after a failed score.
- [ ] Write failing test that they are absent before scoring and after passing.
- [ ] Implement record button, score display, feedback display, and failed-score retry actions.
- [ ] Run paraphrase panel tests.
- [ ] Commit: `feat: add paraphrase retry panel`.

### Task 13: Settings Screens

**Files:** `MasterySettings.tsx`, `AiRoutingSettings.tsx`, tests.

- [ ] Write failing test for separate chunk and final summary threshold inputs.
- [ ] Write failing test for routing controls for teaching, speech transcription, high-quality text-to-speech, image extraction, and fallback provider.
- [ ] Implement threshold controls with min 0 and max 100.
- [ ] Implement routing selects with DeepSeek, OpenAI, Browser TTS, and Disabled.
- [ ] Run settings tests.
- [ ] Commit: `feat: add mastery and ai routing settings`.

### Task 14: Parent Dashboard

**Files:** `ParentDashboard.tsx`, `MaterialEditor.tsx`, tests.

- [ ] Write failing test that dashboard shows material title, completion status, and final score state.
- [ ] Implement material history list.
- [ ] Implement paste-based material editor.
- [ ] Include disabled file/photo controls with visible labels for future support.
- [ ] Run dashboard tests.
- [ ] Commit: `feat: add parent material dashboard`.

### Task 15: Verification

- [ ] Run `pnpm test`; expected all tests pass.
- [ ] Run `pnpm build`; expected all packages build.
- [ ] Run `pnpm dev`; expected API on `http://localhost:3001/health` and web on `http://127.0.0.1:5173`.
- [ ] Smoke test login screen, lesson reader, chunk selection, selected-text popover, retry actions, mastery settings, and AI routing settings.
- [ ] Commit final fixes: `chore: verify ai teacher mvp scaffold`.

## Follow-Up Plans

- Real Google Identity Services and backend ID-token verification.
- Real DeepSeek prompts and structured response schemas.
- Real OpenAI transcription and streaming text-to-speech.
- Upload/photo/PDF text extraction with parent review.
- Learning profile analytics and trend dashboard.
- Production deployment, secrets management, and hosted database.

## Self-Review Notes

Coverage: student/parent web app, REST API, chunk flow, current-chunk focus, clickable chunks, selected text handles, separated Try Again behavior, separate mastery thresholds, and AI routing preferences are covered. Real provider integrations and deployment are intentionally split into follow-up plans.

Placeholder scan: no TBD/TODO placeholders. Follow-up items are explicit future slices, not hidden gaps in the MVP scaffold.
