# SAT open-content expansion — 2026-11-02

Added 120 SAT-style assessment questions: 80 Math and 40 Reading & Writing. Of these, 50 are editorially Hard (32 Math, 18 RW) and 70 Medium. Active unique bank: 1,587 → 1,707. Active Hard: Math 6 → 38; RW 4 → 22.

The new items are adaptations, not official College Board questions and not an imported official SAT bank. Math follows selected open textbook exercises/sections, with the changes specified per item. Reading passages are new English paraphrases of public-domain original English works, with original questions, distractors and Russian explanations. Source author endorsement is not claimed. No paid provider or question API was used. Difficulty describes the editorial reasoning demands; it is not measured item difficulty or SAT calibration.

## Sources and permission evidence

- David Lippman and Melonie Rasmussen, *Precalculus: An Investigation of Functions*, edition 2.3 (2022), https://www.opentextbookstore.com/precalc/. Copyright/license page 2 explicitly licenses the book CC BY-SA 4.0. The separate detailed solutions manual is noncommercial-only and was not used. New solutions were calculated independently. Selected exercises in the book credit D. H. Collingwood and K. D. Prince [UW]; chapter 3 credits Carl Stitz and Jeff Zeager, whose material was used with permission. Retain these source notices with redistributions.
- David Lippman, *Math in Society*, edition 2.6 (2022), https://www.opentextbookstore.com/mathinsociety/. Front matter page 2 explicitly gives CC BY-SA 4.0; statistics/data/probability chapters credit Jeff Eldridge and onlinestatbook.com. Used chapters: Problem Solving, Statistics, Describing Data, Probability.
- Lewis Carroll, *Alice’s Adventures in Wonderland* (1865), https://www.gutenberg.org/ebooks/11.
- Jane Austen, *Pride and Prejudice* (1813), https://www.gutenberg.org/ebooks/1342.
- Charles Darwin, *On the Origin of Species*, first edition (1859), https://www.gutenberg.org/ebooks/1228.
- Frederick Douglass, *Narrative of the Life of Frederick Douglass* (1845), https://www.gutenberg.org/ebooks/23.
- Arthur Conan Doyle, *The Adventures of Sherlock Holmes* (1892), https://www.gutenberg.org/ebooks/1661.

The five literary/scientific originals are public-domain English source works. No modern translation, publisher synopsis, image, Gutenberg branding or third-party SAT question is reproduced. Source chapter/story locators, authors, edition, changes and rights links are available on each question. Retrieved-file SHA-256 hashes are in `sat-open-source-snapshots.json`; the two source copyright notices are saved under `licenses/`.

CC BY-SA 4.0 permits sharing and adaptation, including commercial use, subject to attribution and ShareAlike: https://creativecommons.org/licenses/by-sa/4.0/. The full new adaptation dataset, including answer keys and attribution, is distributed without authentication at `/content/sat-open-2026.json` under CC BY-SA 4.0. This license applies to that content collection; it does not relicense the application code or older bank. The source/license panel links directly to this download, whose inclusion of solutions is stated explicitly.

## Integration and validation

Old question IDs, canonical aliases, option orders, answers, attempts and saved items are preserved. New items have distinct conditions, assessment purpose, stable `open-math-*` and `open-rw-*` IDs, and reuse existing skill names so lesson paths and skill filters are enriched. Closely related numeric constructions share explicit family IDs; the existing cap of two variants per test remains in force. Correct answer positions are balanced in the added MCQs. Both Hard drills can now deliver all ten questions at Hard; two nonrepeating ten-item selections are checked for each section.

New Math covers linear modeling and systems, nonlinear/parameter equations, functions and composition domains, quadratics, exponential models, probability, sample interpretation, summary statistics, circles, similarity, volume and right-triangle trigonometry. No calculus or logarithm syllabus is added. Hard examples require domain/case checks, feasible optimization, nested probability conditions or several geometric relations. Routine computations remain Medium.

`scripts/sat-open-reference.ts` contains independent numerical/algebraic calculations for every Math key, separate from the content/option constructors. The checker verifies all 80 results, numeric/rounded responses, blank rejection, distinct choices, source fields, existing-topic integration, canonical uniqueness, source distribution parity and Hard family limits. Each RW item explains the correct answer and why every other choice fails; grammar items were checked for alternative valid completions. The public question endpoints continue to withhold answer keys and explanations until checking; explicit licensed-download access is separate.

Commands: `npm run export:sat-open`, `npm run check:content`, `npm run check:regressions`, `npm run check:api`, `npm run build`. `check:content` includes the new open-content checks. API checks use disposable databases with all paid-provider credentials disabled.

Final validation: 1,093 open-content assertions, 4,578 regression assertions and 87 API assertions passed. TypeScript and production build passed. Browser verified the new parameter-system question with answer 26, the Holmes evidence question with answer A, Russian feedback and attribution/download links. A collection filter exposes all 120 new items and its 50 Hard items directly. Tests and preview used disposable/QA databases; no real user database, commits or deployment were changed.
