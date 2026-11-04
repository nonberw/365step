# Learning Directions Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Хранить одно направление, сохранять историю и проверять профиль на сервере.

**Architecture:** Общие контракты и начальный каталог; отдельные аддитивные таблицы профиля/событий и редактируемого опубликованного каталога. Серверные проверки и единая чистая политика видимости; существующая авторизация не заменяется.

**Tech Stack:** TypeScript, Express, SQLite/Turso, Node.js 24.

**Spec:** ../specs/2026-11-03-learning-directions.md; Global Constraints основного плана обязательны.

## Global Constraints

- 27 начальных направлений, пять модулей на каждое, ровно одно активное направление.
- Старому ученику профиль не назначается автоматически. Прогресс, XP, тарифы и экзамены сохраняются.
- Чужой directionId из query/body не подменяет серверный профиль.
- Изменение профиля атомарно, expectedVersion проверяется; старый запрос получает 409.

## Review Focus

- Массив/неизвестный/снятый с публикации ID — 400 без изменения аккаунта (Task 2).
- Две смены с одной версией — один победитель и одно событие (Task 2).
- Новая регистрация с неверным профилем не оставляет пользователя/сессию (Task 2).
- Чужие маршруты и угадываемые ID не обходят фокус (Task 3).
- Возврат к прошлому направлению не удаляет старые записи (Task 2).

### Task 1: Контракты и начальный каталог

**Files:** Create shared/directions.ts, shared/directionTypes.ts, shared/directionPolicy.ts, scripts/directions/catalog-check.ts. Modify shared/types.ts.

**Interfaces:**
- Produces DirectionId (string, валидируется каталогом), Direction, DirectionModuleSummary, LearningProfile {directionId: DirectionId|null, specializationId: string|null, version: number}, LearningBootstrap {profile, direction, modules, exams, navigation}, Locale = ru|kk|en.
- Produces DIRECTION_SEED: readonly Direction[]; у каждого id, group, localized title/description, specialties, aliases и пять модулей с постоянными ID и entryLinks существующих инструментов.
- Produces validateDirectionSelection(value: unknown, catalog: readonly Direction[]): DirectionId; findDirections(query: string, locale: Locale, catalog: readonly Direction[]): Direction[].
- PublicUser.learningProfile обязателен в ответе, но содержит directionId:null/version:0 для старого аккаунта. Goals.major остаётся исходным свободным текстом; он не выбирает профиль.

- [ ] Написать scripts/directions/catalog-check.ts: assert.equal(DIRECTION_SEED.length,27); assert.equal(sum(modules.length),135); проверить уникальность ID, пять модулей, 27 точных названий из спецификации; поиск «стоматолог» → medicine, «пилот» → transport, «предприниматель» → business; validateDirectionSelection(['it','business'],catalog) бросает ошибку.
- [ ] Запустить node --import tsx scripts/directions/catalog-check.ts; получить FAIL на отсутствующем реестре.
- [ ] Реализовать перечисленные экспорты, локализованные метаданные и связи существующих инструментов. Общий модуль допускает явные связи с несколькими направлениями; отдельные направления не смешиваются.
- [ ] Повторить catalog-check; ожидается PASS без внешних запросов.
- [ ] Создать коммит feat: add university direction catalogue and contracts.

### Task 2: Профиль, регистрация и история

**Files:** Create server/learning/profile.ts, server/learning/schema.ts, server/routes/learning.ts, scripts/directions/profile-api-check.ts. Modify server/db.ts, server/auth.ts, server/routes/auth.ts, server/app.ts.

**Interfaces:**
- Consumes DirectionId, LearningProfile, validateDirectionSelection.
- Produces getLearningProfile(userId: string): Promise<LearningProfile>; changeLearningProfile(userId: string, input: {directionId: DirectionId, specializationId?: string|null, expectedVersion: number}): Promise<LearningProfile>.
- GET /api/directions — опубликованный каталог выбора без заданий/ключей. GET /api/learning/bootstrap — личный профиль и допустимые модули/экзамены/навигация.
- PUT /api/learning/profile — тело changeLearningProfile; 400 invalid, 401 unauthenticated, 409 stale; 200 новое состояние и версия.
- Регистрация требует b.directionId, принимает только специальность, принадлежащую ему. Пользователь+профиль создаются транзакционно. PATCH /auth/me не меняет направление через Goals.major или неизвестные поля.
- Аддитивные таблицы learning_directions, learning_modules, learning_profiles(user_id PRIMARY KEY, direction_id, specialization_id, version, updated_at), learning_profile_events; опубликованный начальный каталог вставляется идемпотентно. Никаких DROP/DELETE старой истории.

- [ ] Написать API-проверки на одноразовой БД: отсутствие/массив/неизвестный ID регистрации → 400 и неизменные users/sessions; одно направление сохраняется после повторного входа; legacy → null/0; business→design→business сохраняет исходные counts/hashes попыток, XP, тариф и цели; две одновременные смены expectedVersion:1 → статусы [200,409], одно событие; failed transaction не создаёт частичных записей.
- [ ] Запустить node --import tsx scripts/directions/profile-api-check.ts; получить FAIL на отсутствующих API/контрактах.
- [ ] Реализовать сервис, маршруты и транзакции через установленный @libsql/client; использовать write transaction с проверкой актуальной версии в той же транзакции. Обновить toPublic и регистрацию; текущие результаты экзаменов не менять.
- [ ] Повторить проверки на пустой и копии старой БД; ожидается PASS, повторная миграция идемпотентна; выполнить check:ent-schedule.
- [ ] Создать коммит feat: persist one learning direction with safe switching.

### Task 3: Единая политика фокуса и серверные границы

**Files:** Modify shared/directionPolicy.ts, server/routes/learning.ts, server/routes/path.ts, server/routes/library.ts, server/routes/coding.ts, server/routes/eng.ts, server/routes/review.ts, server/routes/me.ts, server/progress.ts, server/bot.ts, server/quota.ts, server/ai.ts. Create server/learning/access.ts, server/learning/context.ts, scripts/directions/focus-api-check.ts.

**Interfaces:**
- Produces getNavigation(profile: LearningProfile, goals: Goals, catalog: readonly Direction[]): NavigationGroup[].
- Produces routeAccess(path: string, profile: LearningProfile, goals: Goals, catalog: readonly Direction[]): 'allow'|'choose-profile'|'outside-profile'; visibleModuleIds(profile, catalog): string[].
- Produces requireLearningModule(req: Request, moduleId: string): Promise<LearningProfile>; buildLearningContext(userId: string): Promise<LearningMentorContext>.
- Server wrong-profile access → 403 {code:'OUTSIDE_PROFILE', home:'/learn'}; missing profile → 409 {code:'PROFILE_REQUIRED'}. Личные архивные работы и принадлежащие ученику начатые экзамены остаются читаемыми/завершаемыми, но не открывают чужой учебный каталог.
- GET /api/learning/search?q=&locale= — только активный профиль + подходящие общие материалы, нет ключей. Начальный каталог выбора — отдельный GET /api/directions.

- [ ] Написать focus-api-check: business с SAT видит пять бизнес-модулей и SAT, не coding/engineering/medicine/IELTS; подставленный directionId=medicine игнорируется; start чужого урока → 403; чужой user/project ID → 404/403; собственная начатая экзаменационная попытка завершается после смены; поиск/related/today/review/assistant context не содержат чужих маршрутов; отсутствие AI ключа не ломает bootstrap/search.
- [ ] Запустить focus-api-check; получить FAIL на текущем общем каталоге и SAT/кодинг рекомендациях.
- [ ] Подключить политику к перечисленным серверным поверхностям. Генерировать следующий шаг по профилю; избегать SAT fallback без цели SAT. Наставнику передавать профиль/модуль/уровень/разрешённые источники; не позволять модели менять профиль.
- [ ] Повторить focus-api-check и затронутые check:api/check:regressions на копии БД; ожидается PASS, ответы не попадают в выдачу до попытки.
- [ ] Создать коммит feat: enforce direction focus across learning APIs.
