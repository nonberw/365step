# English SAT and IELTS presentation

SAT and IELTS pages, exam-course lesson controls, hints and feedback use English. ENT and the general platform shell retain Russian. Desmos embeds explicitly request `lang=en`.

The frozen question banks, identifiers, answer keys and student records are not rewritten. `shared/examEnglish.json` is a separate presentation dictionary applied to SAT/IELTS API responses and English exam-course responses. Student text, supplied answers and identifiers are excluded from recursive localization. The shared UI dictionary is small and independent of the server's content dictionary.

Existing Russian explanations were prepared offline using Helsinki-NLP's OPUS-MT Russian-to-English model through CTranslate2, with protected equations, numerals and original English fragments. UI copy and assessment/demo descriptions were edited for context. This is a language migration, not a fresh psychometric or subject-matter review of the bank.

Preparation tooling is in `scripts/english-exams/`; the one-time source migration requires `@babel/parser` in the separate directory given by `EXAM_EN_WORK`. Models, intermediate inventories and caches are not shipped with the application. The live site does not call a translation API or run a translation model.

Model provenance:

- Original: https://huggingface.co/Helsinki-NLP/opus-mt-ru-en (CC BY 4.0).
- CTranslate2 conversion: https://huggingface.co/gaudi/opus-mt-ru-en-ctranslate2 at `d5c98dcc59a677e768e00ab6e29fbdea80a53729` (repository metadata Apache 2.0; original model attribution retained).
- Inference: https://opennmt.net/CTranslate2/guides/opus_mt.html; source tokens terminate with `</s>`.
- Source content attribution and licences remain attached to the original questions.

Validation: `check:english-exams` checks all 2,751 active explanations, original formulas, unchanged question/choice/key values, IELTS feedback, demo honesty and English/Russian route boundaries. `check:content` checks the original banks. No student answers are submitted for language QA.

Browser QA (2026-11-08): SAT question controls and IELTS Reading display English. Graphing and Scientific use English URLs; the Scientific iframe loads English labels with the question still visible. No student responses were submitted. TypeScript, content checks, web build and server bundle passed.
