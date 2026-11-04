# Learning Directions Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Показать выбор направления первым экраном и персонализировать весь кабинет.

**Architecture:** Один LearningProvider читает bootstrap, сверяет версию и сообщает о смене вкладкам. Все меню используют getNavigation; компоненты обучения читают один профиль. Переходы и запросы защищаются от устаревших ответов.

**Tech Stack:** React, React Router, существующие компоненты 365step, BroadcastChannel/storage events.

**Spec:** ../specs/2026-11-03-learning-directions.md; контракты Core и Content обязательны.

## Global Constraints

- Первый экран — 27 направлений; одно выбранное, специальность необязательна.
- Меню, док, mobile, главная, путь, поиск, библиотека, related links используют один активный профиль.
- Смена в Профиль → Настройки обучения → Дополнительные параметры; история сохраняется.
- ЕНТ-2028 и ручной выбор года не регрессируют; диагностику можно пропустить.

## Review Focus

- Перезагрузка/назад восстанавливают один черновик и корректные экзамены (Task 1).
- Аккаунт B или новый профиль не показывают ответ запроса аккаунта A (Task 2).
- Нет выбранных экзаменов: кабинет не навязывает SAT/IELTS (Task 3).
- Узкий экран и клавиатура дают полный выбор и понятный radio state (Task 1).
- Свой сохранённый проект виден после смены, чужой каталог по URL не открывается (Task 3).

### Task 1: Первый экран, миграция и подтверждённая смена

**Files:** Create src/components/DirectionPicker.tsx, src/pages/learning/ChooseDirection.tsx, src/components/learning/ProfileSwitch.tsx, src/lib/directionDraft.ts, scripts/directions/onboarding-check.ts. Modify src/pages/auth/Register.tsx, src/pages/Profile.tsx, src/main.tsx, src/pages/auth/Login.tsx.

**Interfaces:**
- Consumes GET /api/directions, PUT /api/learning/profile, PublicUser.learningProfile.
- Produces DirectionPicker({catalog, value: DirectionId|null, onChange, locale}); radio group с поиском/синонимами и preview пяти модулей.
- Produces normaliseDirectionDraft(raw: unknown, catalog): DirectionDraft; migrate current sessionStorage key to versioned draft without losing exam dates.
- Routes /choose-direction (legacy/new incomplete profile), /learn (active profile), /profile#learning (collapsed switch settings). Профиль после входа не назначается по Goals.major.
- Необязательный опрос interests/preferences рекомендует top 3 и объясняет основания; не сохраняет выбор без ученика. Диагностика Content/Task 2 запускается после регистрации, Skip сохраняет self-assessment.

- [ ] Написать onboarding-check: radio business→medicine даёт одно значение; пустой выбор блокирует продолжение; старый draft/неизвестный ID безопасно нормализуются; grade10/2026-11-03→2028, explicit2029 сохраняется; back/reload сохраняют цели; quiz не вызывает PUT. В браузерный чек-лист включить Tab/Space/Enter, поиск «стоматолог», мобильные 360px, фокус ошибок и старый аккаунт.
- [ ] Запустить onboarding-check; получить FAIL на отсутствии DirectionPicker/draft logic.
- [ ] Реализовать новые экраны и состояния loading/error/retry; добавить направление в регистрацию первым содержательным экраном. Исключить code из списка экзаменов: интерес к коду определяется профилем; legacy Goals.coding читается для истории. Выбор экзаменов не является обязательным для профильного обучения. Добавить страну обучения/год окончания/предпочитаемый язык и специальность.
- [ ] Проверить скрипт и браузерный сценарий регистрации, пропуска диагностики, старого аккаунта и отмены смены; ожидается один профиль, без раннего переключения на черновик.
- [ ] Создать коммит feat: add direction onboarding and profile switching.

### Task 2: Реактивный профиль, вкладки и сетевые гонки

**Files:** Create src/lib/learning.tsx, src/lib/profileEvents.ts, scripts/directions/request-lifecycle-check.ts. Modify src/lib/auth.tsx, src/hooks/useApi.ts, src/api.ts, src/main.tsx.

**Interfaces:**
- Produces useLearning(): {bootstrap: LearningBootstrap|null, loading: boolean, error: string, refresh(): Promise<void>, switchProfile(input): Promise<void>}.
- Produces ProfileChangedEvent {userId: string, version: number}; broadcasts no tokens, emails or answers.
- useApi<T>(path: string|null, poll?: number, identityKey?: string) keeps compatibility, cancels or discards requests from old path/user/profile generation. On identity change, clear old data before render; unmounted/aborted requests do not set state.
- Provider waits for auth, keys requests by userId/version, refreshes on BroadcastChannel/storage and window focus/pageshow. Other devices reconcile bootstrap on focus and before mutations. Does not overwrite optimistic version with an older response.

- [ ] Написать request-lifecycle-check с управляемыми промисами: A starts, switch to B, B resolves, A resolves → only B; sign out→sign in other user cannot display A; duplicate/out-of-order ProfileChangedEvent не откатывает версию; same-tab switch emits once; 409 refreshes current state, no silent retry with changed intent.
- [ ] Запустить script; получить FAIL на текущем useApi, допускающем ответ старого запроса.
- [ ] Реализовать provider/events/request generation и подключить под AuthProvider. Перед сменой вызвать сохранение текущего черновика; при ошибке сохранения профиль не меняется, показывается retry/cancel.
- [ ] Повторить проверки; в двух браузерных вкладках сменить профиль и проверить отсутствие вспышки старого каталога и потери черновика.
- [ ] Создать коммит feat: synchronize learning profile without stale responses.

### Task 3: Кабинет, навигация, каталог и маршруты

**Files:** Modify src/components/AppShell.tsx, src/components/Ecosystem.tsx, src/components/TelegramAssistant.tsx, src/components/Deadlines.tsx, src/components/Notify.tsx, src/pages/student/Home.tsx, src/pages/student/Review.tsx, src/pages/learn/Path.tsx, src/pages/library/Library.tsx, src/pages/library/Reader.tsx, src/pages/admissions/Portfolio.tsx, src/main.tsx. Create src/components/learning/DirectionGuard.tsx, src/components/learning/FocusedSearch.tsx, src/pages/learning/DirectionHome.tsx, src/pages/learning/Module.tsx, src/pages/learning/Lesson.tsx, src/pages/learning/Project.tsx, scripts/directions/navigation-check.ts.

**Interfaces:**
- Consumes getNavigation/routeAccess/visibleModuleIds, useLearning и Content API. Routes /learn/module/:moduleId, /learn/lesson/:lessonId, /learn/project/:projectId; legacy /learn?course= и /learn/:course/:node остаются совместимыми и проверяются политикой.
- AppShell sidebar/mobile/dock строятся из одного NavigationGroup[]; related links проходят routeAccess. Landing для посетителей может показывать направления; кабинет не открывает общий каталог помимо picker.
- DirectionGuard outside-profile показывает объяснение и ссылку /learn; choose-profile отправляет /choose-direction, кроме профиля/выхода/своих данных/принадлежащих ученику начатых экзаменов.

- [ ] Написать navigation-check: business+SAT → ровно пять бизнес-ссылок, SAT есть, IELTS/coding/engineering/medicine отсутствуют; it и engineering сохраняют собственные legacy tools; пустые экзамены → нет exam fallback; все related/day/review href разрешены; nav для sidebar/mobile/dock равны по доступным целям.
- [ ] Запустить navigation-check; получить FAIL на STUDENT_NAV/DOCK и related static links.
- [ ] Реализовать профильную главную с next action/skill progress/project, каталог модулей, поиск и страницы Content API; удалить только устаревшую статическую сборку навигации, инструменты сохраняются. Экзаменационные метрики показываются по выбранным целям. Портфолио поддерживает архив личных проектов и явно отмечает профиль. Все ошибки имеют возврат/retry, нет пустых ссылок на незаполненные курсы.
- [ ] Повторить navigation-check; браузером проверить business→design→business, прямые URLs/закладки, поиск, related, проекты, desktop/mobile и клавиатуру. Скриншоты сохранить в outputs текущего чата.
- [ ] Создать коммит feat: focus every student learning surface on one direction.
