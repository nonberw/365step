# SAT exact-topic expansion — 2026-11-05

The active bank contains **2,751 questions: 1,517 Reading & Writing and 1,234 Math**. All 29 leaf-topic counts equal the learner's screenshots, including the seven Problem-Solving and Data Analysis topics. Counts are computed from selectable question objects, not presentation-only counters.

The frozen cleanup retains 1,334 questions. This expansion adds **967 R&W and 450 Math**, without restoring the archived bulk language exercises or numeric generator series. The previous 8,386 records, their IDs, answer keys, bookmarks, attempts and historical downloads remain addressable.

## Provenance and editorial treatment

- **OneStopQA / STARC**, Berzak, Malmaud and Levy (2020), CC BY-SA 4.0: 73 native central/detail questions; 206 newly framed evidence questions using the published critical spans; 33 new implication questions; 13 comparisons with an explicitly newly authored hypothetical position. Only Advanced passages are used.
- **OneStopEnglish**, Vajjala and Lučić (2018), Guardian / OneStopEnglish text contributors, CC BY-SA 4.0: 174 contextual vocabulary questions with individually specified meanings and distractors; 255 syntax questions using source grammatical forms and parsed sentence structures; 81 rhetoric questions.
- **SQuAD 2.0 / Wikipedia**, CC BY-SA 4.0: 132 new rhetoric questions. Per-item article title/link and original context are preserved. Function, transition and synthesis tasks cover contrast, consequence, example and addition.
- **AQuA**, Copyright 2017 Google Inc., Apache 2.0: 148 selected algebraic word problems. The fifth alternative is removed without deleting the key, duplicates and noted source errors are excluded or explicitly corrected, and each selected record has a separate solution review/calculation. Source wording, five options, key and rationale remain in the audit.
- **College Readiness Math**, The Learning Agency Lab and contributors, CC BY 4.0: four selected models/data items, with recalculated answers or an explicitly changed target. The rest of the downloaded corpus was not bulk imported.
- **365step original math practice**, CC BY 4.0: 298 individually specified exercises, with OpenStax's pinned CC BY curriculum as a conceptual reference. These are not described as verbatim OpenStax exercises. They have explicit calculations or independently solved two-variable systems, not random numeric expansions.

Sources: [OneStopQA](https://github.com/berzak/onestop-qa), [OneStopEnglish](https://github.com/nishkalavallabhi/OneStopEnglishCorpus), [SQuAD](https://rajpurkar.github.io/SQuAD-explorer/), [AQuA](https://github.com/google-deepmind/AQuA), [College Readiness license statement](https://the-learning-agency.com/guides-resources/datasets/), [pinned OpenStax edition](https://github.com/openstax/osbooks-college-algebra-bundle/tree/4922e46ebc04326979e19392ccc2384cb8b9076c).

The final adaptation includes documented repairs for dropped initial letters/articles in several digitized source paragraphs. Original text and exact replacements are retained in `reference.json`. No source author endorses the adaptations. Difficulty is an editorial estimate, not a psychometrically calibrated SAT rating. Source correspondence, symbolic calculations, answer checking, rendering and exact topic totals are checked automatically; those checks do not constitute independent teacher review of every semantic judgment.

## Distribution and checks

- `shared/satExact.json`: 1,417 additional runtime questions.
- `shared/satExactManifest.json`: actual active IDs and exact topic totals.
- `shared/satCurated.json`: unchanged initial cleanup snapshot.
- `docs/content/sat-exact/reference.json`: original contexts, source keys/spans, edits, authored choices and math calculation records.
- `public/content/sat-exact-2026.json`: distributable questions, solutions, provenance and license notices. The license applicable to each item is specified separately; the compilation does not relabel Apache or CC BY items as ShareAlike.
- `report.json`: before/addition/active count for every topic and attribution totals.

Run `python scripts/sat-exact/verify_math.py` to compare 116 native numeric keys with the separate calculations (32 non-numeric native answers have individual reviews), then run `npm run check:sat-exact`, `npm run check:sat-curation`, `npm run check:sat-bank`, `npm run check:content`, `npm run check:regressions` and `npm run build`. API checks use temporary databases; they must not submit answers on a student's account.

## Offline rebuild

Set `SAT_EXACT_SOURCES` to an untracked source-cache directory. The source files and SHA-256 hashes are listed in `source-snapshots.json`; obtain those exact publicly downloadable files first. No paid API or provider token is used.

Source inputs: OneStopQA archive at commit `7a058755e1ff0d3f835a67109c669c7e294d4239` saved as `onestop.zip`; OneStopEnglish archive at commit `37f8db3945cd2f3cc0caafe45674147b224349be` as `onestop-english.zip`; AQuA `train.json` as `aqua-train.json` and its LICENSE as `aqua-license.txt`; Kaggle College Readiness download as `college-readiness-math.zip`; SQuAD `train-v2.0.json` as `squad-train-v2.0.json`; pinned OpenStax archive as `openstax-2026-08.zip`.

Install `scripts/sat-exact/requirements.txt` in a Python environment. Run `node --import tsx scripts/export-sat-exact-baseline.ts`, then `python scripts/sat-exact/prepare.py`. Run `build_reading.py`, `build_vocabulary.py`, `build_grammar.py`, `build_rhetoric.py`, `build_paired.py`, and `build_math.py` from that directory; finally run `publish.py`. The vocabulary target/context selection is pinned separately in `vocabulary_choices.tsv` and `vocabulary_contexts.json`, rather than relying on dictionary-generated distractors. `aqua_review.tsv` is the explicit native-math selection list; `authored_math.py` contains every individually specified additional math exercise. Builders fail if any topic lacks its required number; they do not pad it.
