# SAT scale expansion implementation plan

Goal: Compare public SAT-bank counts and add thousands of additional offline exercises, prioritizing genuinely multistep Hard Math while keeping generated variants separate from authored/source-exercise counts.

Constraints: Preserve existing changes and user history; no paid/provider API, publication, commits or live-database edits. Only use source editions or generators with explicit reuse permissions. Attribute and distribute licensed derivatives. Reject off-SAT calculus/advanced topics, ambiguous keys, numeric duplicates and fabricated reading questions. Difficulty remains editorial.

- [x] Record primary-source competitor counts and date; distinguish total advertised questions from independently audited counts.
- [x] Obtain permission evidence for reusable math generators and source exercise material. Save input hashes and licenses.
- [x] Build a reproducible local-only expansion pipeline, topic mapping, structural-family IDs, exact/rounded answer handling, independent verification and per-question Russian solutions.
- [x] Add thousands of verified exercises with a substantive Hard subset, flag generated variants as reinforcement, retain standalone/source problems as assessment only when the checker supports the task. Show honest collection/family counts and filters.
- [x] Integrate new data into bank, practice, hard drills and source downloads. Preserve old IDs and full-test family limits.
- [x] Run source/content, independent-math, regression, API and build checks; inspect new Hard examples and collection counts in the browser, restart local preview and deliver comparison/report.
