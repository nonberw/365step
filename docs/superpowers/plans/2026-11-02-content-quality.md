# Content Quality Implementation Plan

> **For agentic workers:** Execute sequentially in this session, as requested by the user. No commits, push, publication, paid APIs, or database reset.

**Goal:** Correct answer checking and misleading content/assessment flows while retaining question IDs and user history.

**Architecture:** Shared, explicit content metadata and strict numeric rules; immutable legacy question identities; server-side selection and quarantine; original assessment content with independently checked keys. Preserve existing database rows, filter invalid content and demonstration measurements at read time.

**Tech Stack:** TypeScript, React, Express, SQLite/libSQL, tsx, Vite.

**Spec:** User attachment “Вставленный текст.txt”, audit at outputs/365step-content-audit.md in the 2026-11-01 chat.

## Global Constraints

- B2C only; no school/class management.
- Do not overwrite other changes (existing untracked pnpm-lock.yaml).
- Preserve all existing IDs, database rows, saved answers and attempts.
- No commits, push, publication or paid model calls.
- Difficulty is editorial, not statistically calibrated; no official score prediction claims.

## Review Focus

- Fractions, decimal commas, zero denominators and explicit rounding: numeric regression suite.
- Existing saved option indices and reopened tests: leave legacy option ordering stable; balance selection instead.
- Duplicate conditions with different options and parametric families: canonical metadata plus strict assessment selector.
- Legacy demo IELTS records: filter using stored result mode, including earlier records.
- Unsupported ENT subject, topic or language: return empty material state, quarantine old malformed rows without deletion.

---

### Task 1: Numeric answers and question defects
**Files:** shared/sat.ts, shared/types.ts, shared/numeric.ts, src/components/RichText.tsx, question input components, scripts/content-regressions.ts.
**Interfaces:** numericEqual(input, expected, rule); SatQuestion numericRule, acceptedAnswers.
- [x] Pin exact bus answer 100/3, reject 33.33 absent rounding, test equivalent fractions/decimals and invalid inputs.
- [x] Replace prime distractors with meaningful candidates and deterministic regeneration when necessary.
- [x] Edit ambiguous boundary options and store subject heads explicitly.
- [x] Render underline recursively in the shared renderer; verify bank, lesson and mock.

### Task 2: SAT metadata, difficulty and diversity
**Files:** shared/satQuality.ts, shared/satDifficulty.json, shared/satOriginal.ts, server/routes/sat.ts, server/routes/path.ts, SAT bank UI.
**Interfaces:** fingerprint(q), annotateBank(items), selectAssessment(pool, count, excluded), purpose and difficultyReview metadata.
- [x] Inventory baseline and exact duplicate groups without modifying IDs.
- [x] Review all Hard items against a documented rubric and record reason/rating per item.
- [x] Tag warmup/reinforcement/assessment, exact duplicates and parametric families; enforce diversity across test modules.
- [x] Keep legacy options stable; balance answer positions in assessment selection and document remaining bank skew.
- [x] Add original longer R&W texts with explicit right-answer and distractor explanations; validate lengths and keys.

### Task 3: Honest IELTS assessments
**Files:** server/content/ieltsAcademic.ts, server/content/ielts.ts, server/routes/ielts.ts, shared/ieltsAssessment.ts, shared/types.ts, src/pages/ielts/*, server/ai.ts, server/progress.ts.
**Interfaces:** original academic exam with 3 passages, 2150–2750 words, 40 questions, 60 minutes; common headings groups with no reuse; exercise result percentage, no band.
- [x] Add an original full Academic Reading set with evidence references and real grouped headings, completion, TFNG and MCQ.
- [x] Expose separate exercise/exam flows, accurate unique-text counts and a 60-minute exam timer.
- [x] Remove short-set/listening band conversion; label browser speech as synthetic skills practice.
- [x] Return null demo bands; exclude demo records from level analytics; never score pronunciation from transcript.
- [x] Verify API answer validation, all exam keys against passage evidence, demo histories and result UI.

### Task 4: ENT isolation and coding references
**Files:** shared/entQuality.ts, server/ai.ts, server/routes/ent.ts, server/routes/path.ts, related ENT selection routes, scripts/coding-reference.ts, scripts/check-content.ts.
**Interfaces:** isUsableEnt(q); independent REF functions plus explicit boundary cases.
- [x] Reproduce malformed ENT rows read-only; exclude safely in every new-content selector, preserve historical lookup.
- [x] Limit demo generation to supported math-literacy percentage topic and language; reject equivalent duplicate options.
- [x] Add independent solutions for all 64 coding problems and meaningful edge fixtures without changing expectations to match implementations.
- [x] Expand structural, numeric, duplicate/family, markup and key checks; distinguish editorial evidence from automated consistency.

### Task 5: Verification and report
**Files:** scripts/content-regressions.ts, docs/content-quality-report.md, current chat outputs/365step-content-quality-report.md.
- [x] Run typecheck, content validation, regressions and production build.
- [x] Run a local server against a disposable database copy with AI credentials disabled.
- [x] Browser-check SAT bank, lesson, mock, fractions, underline, IELTS exercise/full exam/demo results and ENT empty state.
- [x] Record before/after counts, IDs, reclassifications, quarantine, validation evidence and limitations; deliver all uncommitted changes in the specified repository.
