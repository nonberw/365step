# SAT Topic Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Organize the SAT bank into source cards and 29 browsable skills, with real counts and stable mixed practice.

**Architecture:** Keep all existing questions and answer mappings. A shared taxonomy maps legacy skills into the 10 Reading & Writing and 19 Math topics observed on 1609SAT. One server selection pipeline drives topic counts, pages and full practice sequences. Official College Board is an external resource, as authorized by the user.

**Tech Stack:** Existing React, TypeScript, Express and SQLite; no new runtime dependencies.

**Spec:** User request of 4 November 2026: inspect 1609SAT Question Bank, separate Practice Tests and Official College Board, browse by topic/count and mix question difficulty. User explicitly chose official links instead of importing official questions.

## Global Constraints
- Preserve ENT → SAT → IELTS, chosen directions, existing questions/keys and student progress.
- Do not copy third-party question banks, label our questions as College Board, or present reference counts as local inventory.
- Store the observed 1609 counts separately, with date and the All/All-difficulty filter setting.
- Shuffle must stay stable across pagination, refresh and Previous/Next; explicit reshuffle creates a new seed.
- Official resources open externally; local practice continues without their APIs.

## Review Focus
- Legacy skill names must map to exactly one topic, including combined evidence and trigonometry skills.
- Topic totals, status counters and list totals must use identical filters.
- A new random order must not repeat or skip questions at page boundaries.
- Answering and navigating quickly must not show a stale question or carry answer eliminations to another question.
- Empty filters, missing browser storage and old direct bank URLs must stay usable.

### Task 1: Taxonomy and deterministic selection
**Files:** Create `shared/satBankCatalog.ts`, `shared/satBankOrder.ts`, `server/satBank.ts`; modify `server/routes/sat.ts`; test `scripts/sat-bank-check.ts`.
**Interfaces:** `topicFor(question)` returns one canonical topic; `orderBank(items, seed)` returns a full permutation; `/sat/bank/catalog`, `/sat/bank/sequence` and `/sat/bank` share selection and filters.
- [x] Assert 29 unique topics, every active record mapped once and all 8,357 IDs preserved.
- [x] Assert seed stability, a different permutation for another seed, full page coverage and mixed difficulties when alternatives exist.
- [x] Implement authenticated counts and sequences without answer keys; retain old collection/skill filters.
- [x] Verify filtered counts, statuses, saves, answer privacy and all pages on disposable data.

### Task 2: Source cards, topic dashboard and practice navigation
**Files:** Modify `src/pages/sat/Bank.tsx`, `src/pages/sat/QuestionPage.tsx`, `src/pages/sat/Learn.tsx`; create `src/lib/satBank.ts` and focused bank components.
**Interfaces:** `/sat/bank` is the source overview, `source=practice` shows topic groups, `view=questions&topic=…` shows filtered questions. Session context contains IDs, seed, API query and return URL.
- [x] Add Practice Tests and Official College Board cards, progress summaries, grouped topic buttons and real counts.
- [x] Add status/difficulty filters and a default mixed order with explicit reshuffle.
- [x] Keep all existing collection filters; open full filtered sequences instead of only the first 40 questions.
- [x] Restore topic/filter context on return and reset per-question tools; ignore stale fetch results.

### Task 3: Verification and delivery
**Files:** Add `docs/content/sat-bank/reference-1609.json` and `docs/content/sat-bank/report.md`.
- [x] Record reference counts and inspected question formats without copying question text or account information.
- [x] Run meaningful bank/API checks, existing affected SAT checks, TypeScript and frontend/server builds.
- [x] Update the existing localhost server, verify source/topic/filter/shuffle/next/return flows without answering from the student's account, and save screenshots.
- [x] Commit the tested result and report actual inventory and the remaining count differences honestly.
