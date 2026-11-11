# Exact SAT topic inventory Implementation Plan

> Implemented in the existing checkout; validation recorded in docs/content/sat-exact/validation.md.

**Goal:** Deliver exactly 1,517 Reading & Writing and 1,234 Math, with each of the 29 topic counts matching the user screenshots.

**Architecture:** Preserve the reviewed 1,334-item baseline. Add source-traceable questions to each specific shortage, keeping complete archives addressable. A separate exact-bank manifest verifies per-topic equality, uniqueness, explanations and provenance; it must never achieve targets by changing counters or duplicating variants.

**Tech Stack:** Existing TypeScript/React/Express application; offline JSON content with Python/TypeScript verification.

**Spec:** User steering on 2026-11-04 supersedes the curation plan's willingness to stop below reference counts. CURATION_TARGETS in shared/satCuration.ts transcribes the screenshot requirements.

## Global Constraints
- Exact per-topic counts, not just section totals.
- Do not restore discarded bulk basic grammar or numerical clones to fill quotas.
- Use explicit reuse licenses, public-domain sources or newly authored adaptations with honest provenance.
- Preserve IDs, existing keys and account history; maintain random mixed order.
- All questions must contain complete context and a justified unique answer.

## Review Focus
- Duplicate rater rows and equivalent math choices in source datasets.
- Evidence questions must actually test evidence; skill labels cannot be changed just to fill shortages.
- Cropped passages must retain every fact needed for the published key.
- Grammar alternatives must have exactly one valid completion, without a stem revealing the rule.
- Word meanings must match the specific source context and grammatical use.

### Task 1: Source audit and supply
- [x] Download and record licensed primary datasets/texts, hashes, original question IDs and rights evidence.
- [x] Record per-topic shortages from the frozen curated baseline.
- [x] Build candidates with source contexts, keys and explanations; reject weak, ambiguous, duplicate and missing-visual items.

### Task 2: Complete the exact bank
- [x] Add independently attributable source questions/adaptations and fill all topic shortages with varied substantive tasks.
- [x] Verify per-topic equality to all 29 screenshot targets, no reused numerical skeletons, meaningful explanations and preserved old keys.
- [x] Integrate the new collection, honest live counts, licenses and downloadable adaptation data.

### Task 3: Test and show
- [x] Run content, curation and disposable-DB API tests, typecheck and builds.
- [x] Verify exact counts and sample questions on localhost with the unchanged student DB; save screenshot and report actual validation limits.
