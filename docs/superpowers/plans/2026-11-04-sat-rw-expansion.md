# SAT Reading & Writing Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Substantially expand the 649-question English bank with source-backed SAT-style questions, detailed distractor explanations and a directly accessible collection.

**Architecture:** Keep existing IDs/history and exam routes. Store new authored content in focused shared modules, register sources, export an attributed offline dataset, and consume it through the existing bank and answer endpoints.

**Tech Stack:** TypeScript, React, Express, existing SAT content pipeline.

**Spec:** User request of 2026-11-04: add good English questions from open sources to the local SAT question bank.

## Global Constraints
- Preserve ENT → SAT → IELTS navigation and optional selected direction.
- No third-party runtime API; source text must have verified redistribution/adaptation rights.
- Identify authored questions as SAT-style adaptations, never official College Board questions.
- Four distinct choices, exactly one defensible answer, Russian explanations for all options.
- No renaming old questions or changing their answers; preserve student data.

## Review Focus
- A free website does not necessarily grant copying permission: retain original-text permission evidence and source locators.
- Same passage, different question: do not repeat the passage in one assessment.
- Grammar ambiguity: exclude interchangeable punctuation and mixed dialect-dependent alternatives.
- Question/answer exposure: solutions only after submitting; downloadable solutions are explicitly labeled.
- Actual bank count and filters: report active unique conditions, not generated permutations.

### Task 1: Source evidence and content
**Files:** `shared/satRw/`, `shared/satSources.ts`, `docs/content/sat-rw/`.
**Interfaces:** export `SAT_RW_EXPANSION: SatQuestion[]`; stable prefix `rw-open-`.
- [x] Capture original source texts, titles, rights notices and hashes; save source exclusions.
- [x] Author distinct short texts, vocabulary, paired-text, rhetoric and grammar items with per-choice explanations and editorial difficulty.
- [x] Validate source locators, option uniqueness, keys, lengths and duplicates against existing content.

### Task 2: Integration and quality
**Files:** `shared/sat.ts`, `shared/satQuality.ts`, `server/routes/sat.ts`, `src/pages/sat/Bank.tsx`, export/check scripts.
**Interfaces:** `collection=rw-open`; shared manifest and `/content/sat-rw-open-2026.json`.
- [x] Add regression checks for collection membership, no repeated reading passage, old IDs and key stability.
- [x] Integrate content, collection filter and count; export attribution and solutions.
- [x] Run TypeScript, content checks, API answer/filter checks and production builds.

### Task 3: Local delivery
- [x] Restart the existing preview against its existing database, verify browser list and representative Hard item with explanation/source.
- [x] Update content report with actual counts and limitations, and provide the local collection link.
