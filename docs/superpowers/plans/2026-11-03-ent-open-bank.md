# ENT Open Bank Implementation Plan

**Goal:** Add substantial, usable exam-level practice to all 16 existing ENT subjects, from freely reusable sources, with reliable answers and explanations.

**Architecture:** Versioned static question files on the server, stable IDs and provenance per item. Idempotent database insertion integrates the bank into existing practice, tests and review without replacing user history. Numeric variants and bilingual versions are counted separately from distinct authored questions.

**Tech Stack:** TypeScript / Express / libSQL, React, offline Python verification for numerical models.

**Spec:** User request in this conversation: all ENT subjects, free permitted sources, meaningful secondary-school exam difficulty.

## Global constraints

- Preserve SAT expansion, ENT 2028 dates and existing user work.
- No external content or AI API dependency for ordinary practice or tests.
- No copying of confidential/proprietary ENT banks; link official specifications.
- Per-item attribution, allowed reuse and changes; no blanket claims about current OpenStax licenses.
- No elementary filler relabeled as C; no fabricated historical quotations.
- Russian/Kazakh content respects the selected language and each subject's fixed language.
- Validate real topic, valid options, complete multi/matching keys, coherent context groups, exact numerical checks.
- Verification and browser use run against disposable data or the existing QA copy, not the user's live database.

## Review focus

1. A subject or topic must not receive unrelated percentage demonstrations.
2. Exhausted fresh items must offer review, not falsely claim no materials exist or call paid AI automatically.
3. Test blocks must be complete, contexts kept together and no question ID repeated.
4. Translation copies and parameter variants must not be represented as independent questions.
5. Source licenses, public/private answer separation and existing histories must survive integration.

## Tasks

- [x] Verify current official ENT format and source permissions; document source snapshots and topic coverage.
- [x] Create reusable question/provenance types and content builders; independently recompute numerical answers.
- [x] Supply substantive question sets across every subject and topic, context groups, multi-answer and matching tasks; expose truthful counts.
- [x] Integrate bank idempotently with practice, full/subject tests, review and suitable master-mode questions; remove automatic generation dependency.
- [x] Add subject-wide discovery, difficulty filters, repeat/fresh behavior and per-question source links in the UI.
- [x] Validate all content, all subjects/languages/types via API, complete 120-item mock tests, existing regressions and production build; inspect actual examples in browser.
- [x] Save content dataset, source/quality report and screenshots; refresh combined changes artifact and leave local preview running.
