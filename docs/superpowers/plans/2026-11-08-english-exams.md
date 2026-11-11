# English SAT and IELTS Implementation Plan

**Goal:** Keep SAT, IELTS and Desmos in English while preserving the Russian platform shell and ENT.

**Architecture:** Translate exam-page copy at its source and use English labels and AI output instructions. Preserve frozen SAT source data with a separate English presentation layer for existing explanations. Prepare static content translations offline, protecting formulas and answer keys.

**Tech Stack:** TypeScript, React, existing KaTeX renderer; offline OPUS-MT translation for archived explanatory text.

**Spec:** User's request on 2026-11-08: do not translate SAT, IELTS or Desmos into Russian.

## Constraints

- No changes to question IDs, answer keys, grading or student progress.
- Desmos embeds and external links use `lang=en`.
- SAT/IELTS UI and exam-course lesson controls use English; ENT and general platform navigation retain their language.
- AI hints, feedback and newly generated exam practice use English, including demo responses.
- Preserve quoted passages, numbers, equations and mathematical markup when preparing English explanations.

## Tasks

- [x] Inventory and translate SAT/IELTS interface and server-provided labels.
- [x] Add English presentation content for explanations and skill lessons; update AI instructions and demo feedback.
- [x] Use English in Desmos and shared exam-course controls.
- [x] Verify language coverage, formulas/keys, typecheck/build and representative pages; commit locally.

Execution: implement directly in the current session as requested.

Validation completed: all 2,751 active SAT explanations, unchanged formulas and answer keys, content checks, TypeScript, web build and server bundle pass. Browser QA confirmed English SAT controls, IELTS Reading and both Desmos language URLs; Scientific loaded English keyboard and accessibility labels. No answers submitted; displayed student XP remained 140. Saved proof: `outputs/sat-english-desmos.png` in the chat workspace.
