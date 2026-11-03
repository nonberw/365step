# SAT Open Content Expansion Implementation Plan

**Goal:** Expand SAT practice, especially Hard, using freely reusable source materials with no question-provider or paid AI API.
**Architecture:** Keep new question data separate; preserve IDs and history. Attach per-question source, license, changes and editorial difficulty rationale. Adapt open math exercises and public-domain reading passages into SAT format with new Russian explanations.
**Tech Stack:** Existing TypeScript/React/Express bank, local scripts and browser.
**Spec:** User request in this chat, 2026-11-02.

## Constraints and review focus
No commits or publication without instruction. Preserve all previous changes, real database and explicit goals. Source text permission must cover reuse in a commercial platform; keep ShareAlike content downloadable under its own license. Do not claim publisher endorsement or calibrated SAT difficulty. No numeric clones counted as independent Hard items; no new answer leakage through public metadata. Test numeric keys independently, review all RW distractors, and verify the bank/drills use new content.

### Task 1 — Source evidence
- [x] Download source editions and license evidence from public URLs, record hashes and exact locators; exclude noncommercial-only question banks and solution manuals.

### Task 2 — Curated content
- [x] Add separate Math and RW data files plus an attribution registry. Preserve source locators, adaptation notices and rationale for Hard ratings.
- [x] Verify each math answer with independent symbolic/numeric calculations and each RW answer with an evidence rationale for every distractor.

### Task 3 — Integration
- [x] Include new items in canonical bank, hard drills and SAT module selection; display source/license links without exposing answers. Publish the licensed adaptation dataset as a local static download.
- [x] Update assertions that intentionally pin old counts. Check source fields, family uniqueness and Hard module capacity.

### Task 4 — Validation
- [x] Run content, regression, API and production build checks on disposable data. Verify a new Math and RW item in the browser; save evidence and a concise source/count report. Restart the local preview.
