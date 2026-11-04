# Learning Directions Editorial and Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать редактору управление курсами, добавить языки и проверить всё ТЗ на локальном сайте.

**Architecture:** Версионированные черновики/рецензии/публикации под существующей requireAdmin, без новых прав публичной регистрации. Общая локализация и отдельные языковые версии контента; конечная приёмка по реальным сценариям, данным и счётчикам.

**Tech Stack:** React/TypeScript, Express, SQLite/Turso, JSON словари, существующий build/test pipeline.

**Spec:** ../specs/2026-11-03-learning-directions.md; Core/Experience/Content и их контракты обязательны.

## Global Constraints

- Методист управляет направлениями/специальностями/порядком/зависимостями/источниками/публикацией без изменения кода.
- Публичный ученик не получает административных прав; preview не открывает личные данные другого ученика.
- Статусы проверок не выдумываются; машинный перевод не называется отредактированным.
- UI ru/kk/en; язык ресурса отдельный; существующие экзаменационные данные и функции сохраняются.
- Полнота всей версии: 27/135/675/4050/135. Внешнюю публикацию не запускать вместо локального результата.

## Review Focus

- Подстановка role/admin/preview из body или query не даёт доступ редактора (Task 1).
- Публикация модуля с циклом prerequisites, отсутствующим ресурсом/переводом блокируется (Task 1).
- Переключение языка не меняет направление, экзаменационные ответы, даты и историю (Task 2).
- Старый аккаунт не принудительно получает IT; начатый экзамен можно завершить (Task 3).
- Одновременное сохранение ученика и публикация редакции не меняют старую попытку (Task 3).

### Task 1: Редактор и публикационный процесс

**Files:** Create server/routes/learningAdmin.ts, server/learning/editorial.ts, shared/learningEditorial.ts, src/pages/learning/admin/ContentAdmin.tsx, src/pages/learning/admin/ContentEditor.tsx, scripts/directions/editorial-api-check.ts. Modify server/learning/schema.ts, server/app.ts, src/main.tsx, server/learning/content.ts.

**Interfaces:**
- Consumes requireAdmin(req), validateContentPackage, версии Content.
- /api/learning-admin/catalog, /content, /sources поддерживают CRUD черновиков; удаление опубликованного — архивирование с сохранением ссылок/истории, не физическая очистка.
- POST /api/learning-admin/content/:id/reviews {version,stage,result,notes}; stages methodological, assessment, rights; review stores authenticated reviewer/time and checks target version.
- POST /api/learning-admin/content/:id/publish {expectedVersion} publishes only fully reviewed, valid version. New edits create draft; previous published version remains stable.
- GET /api/learning-admin/preview/:directionId returns synthetic empty learner progress, never another user's data. Routes /admin/learning и /admin/learning/:contentId доступны только после серверного подтверждения текущих административных прав.
- Редактор может добавлять новые уникальные slug IDs в runtime каталог; исходные 27 ID не переименовываются и не переиспользуются. Тип DirectionId не должен делать CMS-записи невозможными из-за compile-time enum.

- [ ] Написать editorial-api-check: student/anonymous/forged role → 403/401; valid existing admin can edit labels/specialties/module links without code; publish missing review/rights → 422; stale review/version → 409; prerequisites cycle → 422; published archive preserves attempts; preview содержит только синтетические данные; public catalogue не содержит drafts/private answers.
- [ ] Запустить editorial-api-check; получить FAIL на отсутствующем редакторе/API.
- [ ] Реализовать редактор карточек/модулей/уроков/задач/проектов/ресурсов, карту пробелов, публикацию и роли проверяющих. Не добавлять административных пользователей и не расширять права аккаунтов как побочный эффект.
- [ ] Повторить API-проверки и в браузере пройти draft→reviews→publish→edit new version→archive на одноразовых данных; ожидается воспроизводимый audit log.
- [ ] Создать коммит feat: add reviewed learning content editor.

### Task 2: Языки, доступность и методическая редактура

**Files:** Create shared/learningLocale.ts, src/lib/locale.tsx, src/locales/ru.json, src/locales/kk.json, src/locales/en.json, scripts/directions/locale-check.ts, docs/content/directions/ui-inventory.md. Modify src/main.tsx, src/components/AppShell.tsx, src/components/Ecosystem.tsx, src/components/DirectionPicker.tsx, src/pages/auth/{Login,Register}.tsx, src/pages/Profile.tsx, src/pages/student/{Home,Review}.tsx, src/pages/learning/{ChooseDirection,DirectionHome,Module,Lesson,Project}.tsx; inventory lists existing exam/library/admissions/engineering/coding user-facing pages for subsequent string migration.

**Interfaces:**
- Produces t(key: LocaleKey, locale: Locale, params?): string; locale label != resource language; formatting uses Intl with ru-KZ/kk-KZ/en equivalents.
- New direction metadata/content uses localized records with explicit translation state. Существующие stems/accepted answers сохраняют исходный язык/формат; переключение UI не переводит правильные ответы автоматически.
- Inventory generated from actual src/pages/*.tsx and components serving student routes; for each exact file records extraction/migration/review state. Full-interface completion requires no remaining untracked student-facing flow.

- [ ] Написать locale-check: key sets ru/kk/en equal, no empty strings, interpolation placeholders match; все 27/135 titles/descriptions/specialties translated; missing reviewed translation blocks publish; changing locale leaves profile/version/goals unchanged; unsupported locale safely falls back to ru. В browser checklist: 360px/desktop, длинные казахские строки, keyboard, radio labels, visible focus, errors associated with fields, reduced motion.
- [ ] Запустить locale-check; получить FAIL на отсутствующих словарях/переводах.
- [ ] Реализовать локализацию новых потоков и последовательно перенести все существующие student-facing страницы по inventory. Подготовить и проверить ru/kk/en новые материалы; терминология согласована, источник/язык виден до открытия. В списке курсов не выдавать английский ресурс за русскоязычный.
- [ ] Повторить locale-check, сборку и браузерную проверку трёх языков; редакционные пробелы явно отражать в отчёте, не маскировать русским fallback как готовую казахскую редакцию.
- [ ] Создать коммит feat: localize focused learning experience and improve accessibility.

### Task 3: Миграция, совместимость и локальная передача

**Files:** Create scripts/directions/migration-check.ts, scripts/directions/delivery-check.ts, docs/content/directions/acceptance.md, docs/content/directions/delivery-report.json. Modify package.json (scripts only), docs/content/directions/report-ru.md, планы (checkboxes).

**Interfaces:**
- package scripts check:directions, check:directions-api, check:directions-coverage запускают соответствующие детерминированные проверки; сетевые проверки источников отдельно и явно, без изменения боевой БД.
- delivery-report включает actual counts, coverage/review/language gaps, legacy data comparison, tests, screenshot paths, local URL и publication state. Только фактически выполненные проверки помечаются passed.

- [ ] Написать migration-check на отдельном снимке старой БД: legacy профиль null, повторный boot не меняет attempts/projects/xp/tests, choose required для нового старта обучения, принадлежащий ученику начатый экзамен завершается, business→design→business восстанавливает профильную историю. delivery-check проверяет 18 сценариев приёмки из исходного ТЗ и ссылки на фактические доказательства.
- [ ] Запустить оба скрипта до завершения миграции/UI; получить FAIL с незавершёнными сценариями.
- [ ] Подключить мягкую миграцию без назначения направления по умолчанию; опубликовать только прошедшие review версии. Выполнить typecheck, frontend/server build, старые содержательные/API-регрессии затронутых разделов, check:ent-schedule, все directions проверки. Использовать bundled Node 24 и доступный пакетный рантайм, не менять зависимости/lockfile без необходимости.
- [ ] Пройти браузером новые/старые аккаунты, бизнес+SAT, профиль без экзаменов, it/engineering tools, прямые URLs, две вкладки, смену языка, сохранение проектов и перезапуск сервера. Сохранить скриншоты и итоговый отчёт в outputs текущего чата. Перезапустить http://localhost:8787 на отдельной QA-копии, подтвердить health и страницу. Ожидается полный PASS без потери пользовательских данных.
- [ ] Создать коммит feat: deliver complete focused university preparation locally; передать пользователю ссылки и честный отчёт. Если полнота/review не пройдены, продолжать работу или назвать конкретный блокер, не объявлять все 135 модулей завершёнными.
