# SAT Bank Curation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Remove elementary items and repetitive bulk variants from the active SAT bank while retaining recoverable source content and student history.

**Architecture:** Generate a versioned allowlist from the complete annotated archive using documented exclusions, structural deduplication, family limits and screenshot topic ceilings. Route new practice through that allowlist; retain the full ID lookup for old results and running tests. Source archives and their manifests remain historical snapshots.

**Tech Stack:** TypeScript, JSON, Express, React, existing SQLite storage and content checks.

**Spec:** docs/content/sat-curation-spec.md

## Global Constraints
- Quality takes priority over screenshot counts: no filler.
- Preserve IDs, answer positions, attribution, attempts and bookmarks.
- Keep Question Banks, 29 topics, and seeded mixed difficulty ordering.
- No new dependencies or source downloads required.

## Review Focus
- Archived answered/bookmarked questions must not re-enter the active bank merely because history exists.
- Direct archived links and in-progress test questions must still resolve.
- Course/topic counts and collection labels must describe the active set.
- Repeated passages and numeric-only variants must be capped without changing keys.
- Full two-module tests must remain possible in both sections.

### Task 1: Reproducible selection and report
**Files:** Create shared/satCuration.ts, shared/satCurated.json, scripts/curate-sat-bank.ts, scripts/check-sat-curation.ts, docs/content/sat-curation-report.json and .md; modify shared/sat.ts.
**Interfaces:** selectCuratedBank(items: SatQuestion[]) returns selected items and per-ID exclusion reasons; SAT_ACTIVE_BANK becomes an explicit curated allowlist; SAT_BANK and SAT_BY_ID preserve the archive.
- [x] Add regression assertions rejecting basic and bulk-import questions in the active set; run against the current bank and confirm failure.
- [x] Implement exclusions, normalized mathematical skeletons, two-item family/passage limits, and screenshot topic ceilings; generate stable IDs and before/after reports.
- [x] Verify active IDs equal generated selection, no exact repeats/basic items, no template excess, and unchanged archived keys.

### Task 2: Integrate practice and counts
**Files:** Modify server/routes/sat.ts, server/routes/path.ts, server/satBank.ts, shared/satBankCatalog.ts, src/pages/sat/Bank.tsx, scripts/sat-bank-check.ts and historical expansion checks.
**Interfaces:** bank/catalog reports active collection totals; bank list and sequence exclude archived history; old /question/:id lookup remains intact.
- [x] Use active pools for bank, lesson/course counts and Blitz; keep historical lookups untouched.
- [x] Replace old hardcoded collection sizes with real active counts; preserve filters, topic navigation and shuffle.
- [x] Add disposable-DB tests for archived attempts/bookmarks, direct question access, old running tests, accurate counts and complete practice sequences.
- [x] Adapt historical expansion tests to distinguish preserved archives from current curation totals.

### Task 3: Verify and show the result
- [x] Run curation/content regressions, complete-bank API checks, typecheck and production builds.
- [x] Restart the owned localhost server with the same database, verify actual topic totals and mixed question selection in the browser without answering for the user.
- [x] Save screenshot and report final counts plus gaps against the screenshot reference honestly.

Validation completed: 1,334 active items (550 R&W, 784 Math); content checks, 4,264 regressions, 3,888 bank API checks, 2,233 authored-RW API checks, 5,004 archive-RW API checks, typecheck and both builds passed. Browser confirmed exact counts, all 29 topics, and unchanged student XP/activity summary.
