# Mathematical Typography Implementation Plan

**Goal:** Render SAT formulas with mathematical typography matching the user's example, including plain-text legacy expressions.

**Architecture:** Add an opt-in plain-expression formatter to RichText, using the installed KaTeX renderer. Enable it on SAT Math surfaces only; keep question data, grading, IDs and progress unchanged.

**Tech Stack:** React, TypeScript, KaTeX.

**Spec:** User's 2026-11-07 screenshot and request in this chat.

## Constraints and review focus

- Preserve existing LaTeX, ordinary English/Russian prose, currency, code, answer blanks and underlining.
- Format fractions, roots, powers, functions, comparison signs and isolated mathematical variables.
- Never interpret arbitrary English words as products of variables.
- Keep malformed expressions readable; never execute source HTML or enable trusted KaTeX commands.
- Check inline alignment and long formulas in the actual dark lesson interface.

## Tasks

- [x] Add focused rendering checks for the reported inequality, the function example, fractions, powers, currency, prose and coding isolation.
- [x] Implement opt-in formatting and connect lesson, bank, review, drills, SAT Blitz and theory surfaces.
- [x] Run rendering checks, existing SAT rendering checks, typecheck and production build.
- [x] Verify in the browser, save a screenshot and commit locally.

Execution: implement directly in this session as requested by the user.

## Validation

- `check:math-text`: reported examples and 15,868 text fields across all 2,751 active SAT questions render without KaTeX errors.
- `check:sat-exact`: 28,611 checks pass; the 29 topic counts and all question/answer strings remain unchanged.
- TypeScript and Vite production build pass (existing unrelated CAD/chunk size warnings remain).
- Browser: SAT Math lesson shows italic variables and typeset inequality choices; function question `x-math-linear-functions-h11` shows italic function notation and a stacked fraction. No answers submitted; student XP remains 119.
