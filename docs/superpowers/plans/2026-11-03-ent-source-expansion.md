# ENT Source Expansion Implementation Plan

**Goal:** Expand the existing ENT bank substantially with distinct exercises actually found in freely reusable sources, prioritising subjects currently limited to one mock.

**Architecture:** A supplemental server-side JSON collection with stable source IDs, provenance and source language. Retain the existing bilingual bank and full mocks, add subject/language discovery and separate persistent attempts, preserve source keys and evidence, and keep imports independent of external APIs. Questions become available on existing installations without reseeding or replacing their question/attempt tables. Only the new attempt table is created idempotently.

**Tech Stack:** Offline Python importers, TypeScript / Express / SQLite, existing React practice UI and checks.

**Spec:** User request in this chat: “нужно намного больше задач ... поищи их в бесплатном доступе”. Existing permission and quality requirements continue.

## Global constraints

- Free access alone does not establish permission to redistribute; record explicit licenses and source editions.
- Count distinct conditions separately from translations and parameter variations.
- Do not mislabel English/Kazakh source text as Russian, infer unsupported ENT subjects, or publish incomplete diagrams/answer keys.
- Do not copy paywalled or confidential exams; use openly licensed published educational/research materials.
- Preserve SAT, ENT 2028 settings and all existing attempts; test using disposable databases or the QA copy.

## Review focus

- Source QA records can have ambiguous answers, unsuitable topics or missing context: retain evidence and filter them.
- A large reading-comprehension dataset must not be silently counted as 16-subject exam coverage.
- Imports in one source language must remain discoverable with honest language counts and choices.
- New imports must appear after an existing seed marker is already present.
- Avoid serving the same question twice through aliases or generating distractors containing equivalent correct answers.

## Tasks

- [x] Research primary-source licenses, download snapshots, inventory real usable questions and subjects; save evidence and exclusions.
- [x] Implement deterministic source importers, safe question/evidence conversion, subject/topic mappings and deduplication; record a representative answer review.
- [x] Integrate source collections, language-aware discovery, reliable repeat practice and availability on existing installations without destructive reseeding.
- [x] Validate source-answer evidence, numerical/reference keys where applicable, API results and complete mocks on disposable data; run regressions and builds.
- [x] Inspect the new material in the browser, export the expanded dataset and source report, refresh the patch and local preview.

## Delivered

6,700 supplemental language records; 4,337 question IDs excluding translation copies; 8,601 records with the preserved core bank. All 16 subjects have additional material, with explicitly uneven coverage. Source keys remain distinct from independent answer verification; source-only entries are not assigned B/C levels. See docs/content/ent/expansion/report-ru.md and validation-results.json for limitations and results. Local browser proof saved; no production deployment.
