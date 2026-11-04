# Learning Directions Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать каждому модулю реальные уроки, практику, диагностику, повторение и проект с сохраняемым прогрессом.

**Architecture:** Серверное хранилище версий содержания и публичные представления без ключей. Собственные задания и проекты привязаны к компетенциям, источники импортируются только при разрешении; опубликованные версии попыток неизменяемы.

**Tech Stack:** TypeScript, JSON начальные пакеты, SQLite/Turso, существующий серверный XP и локальный рантайм.

**Spec:** ../specs/2026-11-03-learning-directions.md; контракты Core обязательны.

## Global Constraints

- Все 135 модулей: минимум 5 уроков, 30 самостоятельных задач, 1 проект/кейс с рубрикой, итоговое оценивание и 2 проверенных ресурса.
- Минимум 675 уроков, 4050 самостоятельных задач, 135 проектов; переводы и замены чисел считаются вариантами, не новым содержанием.
- Нет ключей в стартовом ответе, оценка и XP определяются сервером; без внешних API.
- NC/ND и неизвестная лицензия не дают права на импорт/перевод. Внешние ресурсы обозначаются отдельно.
- Сохранить версии попыток, проекты, текущие экзамены и историю между профилями.

## Review Focus

- Ресурс требует оплаты/регистрации/не разрешает копирование — корректный режим, внутренний урок работает (Task 1).
- Повторный submit, гонка с profile switch — один XP, сохранённый черновик и 409 для новой работы в старом профиле (Task 2).
- Внешний URL содержит ключ/недопустимую схему — публикация отклонена (Task 1).
- Прогресс прошлой версии содержания не перепривязывается к новому ключу (Task 2).
- 30 шаблонных числовых вариаций не проходят полноту, сложность и происхождение (Task 3).

### Task 1: Формат содержания и реестр источников

**Files:** Create shared/learningContent.ts, server/learning/content.ts, server/learning/sources.ts, server/content/directions/manifest.json, scripts/directions/content-check.ts, docs/content/directions/sources.md. Modify server/learning/schema.ts, server/routes/learning.ts.

**Interfaces:**
- Produces LearningLesson {id, moduleId, version, locale, objectives, prerequisites, blocks, exerciseIds, sourceIds, reviewState}; LearningExercise {id, conceptId, variantOf?, version, moduleIds, locale, kind, difficulty, prompt, privateAnswer?, rubric?, explanation, provenance, reviewState}; LearningProject {id, moduleId, version, brief, deliverables, rubric, sourceIds}.
- Kinds: choice, numeric, short, rubric, code-reference, model-reference; Старт/Практика/Вызов имеют объяснение критериев сложности. Не добавлять безосновательное официальное признание/сертификацию.
- SourceRecord {id, url, title, author, edition, language, access:{price:'free'|'paid'|'unknown',accountRequired:boolean,availability:'available'|'unavailable'}, mode:'external'|'import'|'tool', licenseId, licenseUrl, checkedAt, attribution, adaptationNotes, importEvidence?}. В бесплатную подборку включать только price:free; наличие аккаунта показывать отдельно.
- getPublicLesson(userId, lessonId): Promise<PublicLearningLesson> и getPublicModule(userId,moduleId): Promise<PublicLearningModule>; только опубликованное разрешённое содержание. GET /api/learning/modules/:moduleId и /lessons/:lessonId используют эти функции.
- validateContentPackage(input): ValidationReport; источник для импорта требует подтверждения прав конкретной редакции и вложений. Для собственного задания сохраняются авторство, исходные данные и использованные справочные ссылки без копирования защищённого текста.

- [ ] Написать content-check на маленьких фикстурах: NC/ND import без разрешения → error; внешняя ссылка такого материала допустима; отсутствуют дата/автор/права → publication error; javascript:/credential URL → error; public lesson не содержит privateAnswer/explanation до ответа; linked resource unavailable не делает свой урок недоступным.
- [ ] Запустить node --import tsx scripts/directions/content-check.ts; получить FAIL на отсутствующих схеме/валидаторе.
- [ ] Реализовать схемы, валидатор, приватные/публичные представления, стабильные ID/версии и реестр. Проверить конкретные бесплатные ссылки из ТЗ; зафиксировать лицензию и дату. Не скачивать teacher-only solutions и не превращать обзорную страницу в фиктивные два разных источника.
- [ ] Повторить content-check с фикстурами и реестром; ожидается PASS, runtime не обращается к источникам по сети.
- [ ] Создать коммит feat: add licensed learning content model and source registry.

### Task 2: Попытки, диагностика, проекты и повторение

**Files:** Create server/learning/assessment.ts, server/learning/progress.ts, server/learning/projects.ts, server/learning/review.ts, scripts/directions/learning-api-check.ts. Modify server/learning/schema.ts, server/routes/learning.ts, server/routes/me.ts, server/routes/review.ts, server/routes/admissions.ts.

**Interfaces:**
- POST /api/learning/attempts {lessonId, contentVersion, profileVersion, idempotencyKey} → {attemptId, items:PublicExercise[]}.
- POST /api/learning/attempts/:id/answers {itemId, answer, idempotencyKey} → feedback; POST /:id/finish → {score, completed, xp, competencies}.
- GET/POST /api/learning/diagnostic — короткая оценка по компетенциям активного направления; пропуск не блокирует обучение и не создаёт фиктивных ответов.
- PUT /api/learning/projects/:id/draft {profileVersion, contentVersion, draftVersion, body} → {draftVersion,savedAt}; POST /:id/submit → собственная работа и rubric assessment status. Рубричное задание не называется объективно проверенным тестом; не начислять XP за присланную клиентом оценку.
- GET /api/learning/review — активный профиль; общие экзаменационные повторения остаются по выбранным экзаменам. GET /api/learning/archive — только свои прежние результаты/работы, без чужого каталога.
- Таблицы learning_attempts (snapshot версии/ключа), learning_answers, learning_progress, learning_project_drafts, learning_project_submissions, learning_review_cards. Уникальные idempotency keys и XP reason привязаны к попытке; завершение и начисление атомарны.

- [ ] Написать learning-api-check: правильный/неправильный/numeric fraction/рубрик ответы; клиентский score игнорируется; start/answer/finish без ключей; повторный finish/retry не дублирует XP; неверный владелец → 404; смена профиля сохраняет attempts/drafts, новая работа по старой версии → 409; возврат восстанавливает прогресс; пропущенная диагностика работает; ответы старой версии оцениваются её сохранённым ключом.
- [ ] Запустить learning-api-check на одноразовой БД; получить FAIL на отсутствующем runtime.
- [ ] Реализовать оценивание с существующими надёжными числовыми проверками, snapshot попыток, рубрики, autosave, навыки и review; собственные старые проекты доступны в архиве. Учебный проект в портфолио появляется как факт выполненной работы, не как автоматически готовое вступительное эссе. Изменить today/next-action на опубликованную профильную последовательность.
- [ ] Повторить проверки, перезапустить сервер и подтвердить сохранность прогресса; сравнить логические хеши старых таблиц на копии. Ожидается PASS, один XP на завершение.
- [ ] Создать коммит feat: add persistent profile learning practice and projects.

### Task 3: Полное наполнение 27 направлений

**Files:** Create server/content/directions/{it,engineering,architecture,transport,safety,business,finance,economics,marketing,international,law,linguistics,humanities,psychology,society,education,medicine,biology,chemistry,physics,mathematics,earth,agriculture,design,arts,hospitality,sport}.json; scripts/directions/coverage-check.ts; docs/content/directions/{coverage,review-log,rights,report-ru}.md. Modify manifest.json и sources.md.

**Interfaces:**
- Consumes LearningLesson/Exercise/Project, SourceRecord, 135 module IDs и validateContentPackage.
- Produces 27 validated packages; each has пять модулей эталонного реестра, измеримые результаты, входные требования, диагностику, минимум 5 lessons/30 distinct concepts/1 project/2 checked resources per module и итоговое оценивание.
- coverage report distinguishes independent concepts, parameter variants, translations, published lessons/projects and review status. Один объект, связанный с несколькими модулями, не увеличивает общий счётчик самостоятельных задач.

- [ ] Написать coverage-check: exactly 27 initial direction IDs and 135 module IDs; each >=5 lessons, >=30 independent concept IDs, >=1 project with rubric, >=2 distinct relevant source records; global >=675 lessons/>=4050 independent exercises/>=135 projects; translations/variantOf не добавляют concepts; all references resolve; a fake 30-variant package fails.
- [ ] Запустить coverage-check; получить FAIL с точной картой отсутствующего содержания, без заполнения заглушками.
- [ ] Авторские пакеты создавать тематическими партиями: (a) business/finance/economics/marketing; (b) international/law/linguistics/humanities; (c) psychology/society/education; (d) medicine/biology/chemistry; (e) physics/mathematics/earth/agriculture; (f) it/engineering/architecture/transport/safety; (g) design/arts/hospitality/sport. Каждый урок содержит объяснение/пример/практику, каждый ответ — решение/рубрику. Использовать фактические вычисления/данные и независимую повторную проверку решений; творческие направления — содержательные брифы, не универсальный одинаковый квиз. Привязать существующие инструменты, но не считать их автоматически 675 новыми уроками.
- [ ] После каждой партии запустить content-check/coverage-check с фильтром партии и learning-api-check по опубликованным примерам; вручную решить выборку Старт/Практика/Вызов и проверить проекты. Отдельно проверять нормативные даты, клинические границы и версии инструментов. Не приписывать медицинскую/экспертную рецензию без реального подтверждения. Непроверенные элементы остаются черновиками и перечисляются как незавершённые.
- [ ] Каждую проверенную партию сохранить отдельным коммитом content: add reviewed <family> learning modules; финальный coverage-check должен пройти полностью. Пока есть пробелы, задача полного наполнения не завершена.
