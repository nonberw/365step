# 365step: исправление качества контента и учебных сценариев

Дата: 2 ноября 2026 года. Все изменения сохранены локально, без коммитов, push, публикации и платных API.

## Основа и границы проверки

Рабочий репозиторий: `/Users/nurbek/Documents/Codex/2026-11-01/https-github-com-nonberw-365step-https/work/365step`. Исходная версия и проверенный удалённый HEAD GitHub — `6e914c23a61873535915e7f35b5c36b02dff7a8b`. Прочитан предоставленный аудит. Начальное состояние содержало только посторонний неотслеживаемый `pnpm-lock.yaml`; он не редактировался.

Это исправления проекта с проверяемым кодом, а не утверждение о полной верификации всего банка. Все 192 встроенные сгенерированные Math-задачи и ещё 300 свежих вариантов пересчитаны из условий независимым арифметическим проверяющим кодом. Для всех 64 задач программирования есть эталоны, проверяющие отдельно сохранённые ожидаемые ответы. Все старые 495 Hard рассмотрены редакционно по условиям и дистракторам. Полного независимого решения всех 1 606 исходных SAT-вопросов, внешней лингвистической экспертизы и статистической калибровки не проводилось.

## Воспроизведено и исправлено

1. **Точность Math.** `m-ratio-04` сохраняет `100/3`. Принимаются `200/6`, полная десятичная запись и десятичная запятая; `33.33` без требования округления отклоняется. Все 12 задач `m-ratio-01`…`m-ratio-12` объясняют перевод минут через точную дробь. Общий допуск `1e-3` заменён рациональным сравнением с допуском только машинного представления. Для каждой числовой задачи явно задано точное либо указанное в условии округление. Поддержана модель дополнительных допустимых ответов; эти ключи не передаются клиенту до проверки. Пустой MCQ-ответ больше не превращается в A. Ввод в банке и пробнике допускает длинные дроби и десятичную запятую.
2. **Дистракторы.** Удалён механизм добавления штрихов. Исправлены `m-slope-01`, `m-slope-10`, `m-sys-09`, `m-sys-11`; у соответствующих генераторов достаточно разных числовых кандидатов, а нехватка вариантов вызывает явную ошибку. Регрессии проверяют 2 000 новых вариантов на отсутствие штрихов и численно эквивалентных вариантов.
3. **Грамматика.** В `rw-gen-bd-06` пояснение после двоеточия стало именной группой про невозможность серверов обслужить пользователей; в `rw-gen-bd-08` — именной группой про возможность сделать домашнюю работу необязательной. Точка с запятой теперь соединяла бы предложение с фрагментом и не является допустимой альтернативой. Это содержательное исправление условий, без искусственных вариантов вида `:,`. Все 16 SVA-задач хранят главное слово явно. Особенно исправлены `rw-gen-sva-09`, `-10` (One) и `-15`, `-16` (members).
4. **Подчёркивание.** Общий `RichText` поддерживает `__…__`, включая вложенную математическую разметку. Исправление действует в банке, уроках, пробниках и разборах. Старые 19 заданий сохранены; новое `rw-original-museum-label` использует ту же разметку.
5. **Повторы.** Все 19 групп/29 дополнительных записей подтверждены. Записи и их варианты ответа не удалены. Для новой выдачи выбирается один канонический экземпляр; старые URL, сохранённые вопросы и история работают по прежним ID. Семейства генераторов помечены явно, числовые варианты одинаковых формулировок импортированных задач распознаются структурно. В SAT-контроле запрещены одинаковые условия между модулями и больше двух вариантов одного семейства. Такие же ограничения применяются к коротким тренировкам. Семь одинаковых треугольников 8–15–17 сохраняются только для совместимости; повторные карточки не выдаются заново как разнообразный банк.
6. **Назначение.** Есть разминка, закрепление и контроль; фильтр виден в банке. Короткие R&W-фразы используются для разминки, параметрические задачи — для закрепления. Полный SAT отбирается только из контрольного пула. Порядок старых вариантов не перемешивается: индексы ответов в истории и старых тестах остаются стабильными. Вместо этого при подборе балансируются позиции правильного ответа и дефициты тем.
7. **Сложность.** Для всех 495 прежних Hard сохранены решение и обоснование: 82 → Easy, 407 → Medium, 6 оставлены Hard. Рубрика учитывает независимые решения, параметры и ограничения, языковую плотность, преобразования и правдоподобие дистракторов. `m-trig-01`, `x-math-two-variable-data-h01`, `x-rw-form-structure-sense-h01` теперь Easy. Сохранённые старые Hard: `x-math-equivalent-expressions-h13`, `x-math-nonlinear-equations-h05`, `x-math-probability-h06`, `x-math-probability-h07`, `x-math-right-triangles-h13`, `x-math-systems-h12`. После добавлений есть только 6 Hard Math и 4 Hard R&W, поэтому соответствующие тренировки честно сообщают фактическое число. Предпочтения сложности при подборе контрольного модуля могут ослабляться при нехватке контента; ограничения повторов не ослабляются.
8. **Дополнительно найденные дефекты.** `rw-sec-05`: устранено повторение Meitner при вставке ответа; `x-rw-boundaries-h04`: повторение Pando; `x-rw-quantitative-evidence-h10`: неподдерживаемое таблицей превосходство роли рабочего пространства заменено подтверждаемым изменением долей; `x-rw-transitions-h15`: убрана конкурирующая связка Accordingly; `x-rw-text-structure-h08`: исправлена логика возраста движущегося льда; `x-math-nonlinear-equations-h15`: явно указан ненулевой коэффициент квадратного члена.

## Объём до и после

| Раздел | До | После |
|---|---:|---:|
| SAT, все совместимые ID | 1 606 | 1 616 |
| SAT, уникальные условия в новой выдаче | 1 577 | 1 587 |
| SAT Math, все ID / активные | 1 047 / 1 018 | 1 047 / 1 018 |
| SAT R&W | 559 | 569 |
| SAT Easy / Medium / Hard, все ID | 550 / 561 / 495 | 632 / 974 / 10 |
| IELTS Reading, короткие наборы / вопросы | 65 / 329 | 65 / 329 |
| IELTS Reading, уникальные короткие тексты | 20 | 20 |
| IELTS Reading, полные авторские комплекты | 0 | 1: 3 новых текста, 40 вопросов |
| IELTS Reading, всего уникальных текстов / вопросов | 20 / 329 | 23 / 369 |
| IELTS Listening | 2 набора / 12 вопросов | 2 набора / 12 вопросов, явно обозначенная синтетическая тренировка |
| Программирование | 64 задачи / 266 тестов | 64 задачи / 390 тестов |
| Независимые эталоны программирования | 20 | 64 |
| ЕНТ, локальные записи | 10 ошибочных | 10 сохранены, 0 допущены к новой выдаче |

В активном SAT: 232 разминок, 164 заданий для закрепления, 1191 для контроля. Это назначение контента, а не сертификат правильности каждого импортированного задания.

Распределение по доменам (вторая колонка включает совместимые повторы, третья — активные условия):

| Раздел и домен | Исходные ID | После, активные |
|---|---:|---:|
| rw · Information and Ideas | 187 | 192 |
| rw · Craft and Structure | 142 | 146 |
| rw · Expression of Ideas | 109 | 110 |
| rw · Standard English Conventions | 121 | 121 |
| math · Algebra | 285 | 282 |
| math · Advanced Math | 183 | 180 |
| math · Problem-Solving and Data Analysis | 363 | 359 |
| math · Geometry and Trigonometry | 216 | 197 |

Старая позиционная асимметрия банка остаётся видимой: Math A/B/C/D = 258/226/167/50 среди 701 MCQ. В импортированной части D по-прежнему 25/593. Это намеренно не исправлялось сменой ключей у сохранённых вопросов. В выборке 100 полных Math-тестов после нового подбора позиции дали 800/801/800/799 среди 3 200 MCQ; распределение доменов — 1 589 Algebra, 1 568 Advanced Math, 643 Data Analysis, 600 Geometry. Это проверка поведения селектора, не психометрическая эквивалентность форм.

## Новые SAT Reading & Writing

Все десять сценариев оригинальные и вымышленные: они не выдаются за опубликованные исследования. Тексты требуют анализа отбора архивов, выборки, причинных объяснений, ограничений данных, авторского решения и двух позиций. Каждый вопрос имеет один ключ и объяснение ошибок всех трёх дистракторов.

| ID | Слов | Редакционная сложность 1–3 |
|---|---:|---:|
| `rw-original-archive` | 103 | 3 |
| `rw-original-night-maps` | 110 | 3 |
| `rw-original-seed-test` | 103 | 2 |
| `rw-original-translation` | 107 | 2 |
| `rw-original-museum-label` | 103 | 2 |
| `rw-original-river-count` | 107 | 3 |
| `rw-original-clock` | 104 | 2 |
| `rw-original-tool-library` | 119 | 2 |
| `rw-original-corridor` | 109 | 3 |
| `rw-original-map-index` | 109 | 2 |

Максимум длины R&W вырос с 84 до 119 слов. Коротких текстов меньше 25 слов остаётся 232; они выведены в разминку. Десять добавлений не устраняют весь дефицит длинного материала.

## IELTS: формат и оценка

**Reading.** Короткие упражнения показывают число верных ответов, процент, ключи и объяснения; пересчёт 5/5 → Band 9 удалён. Счётчики различают 65 наборов и 20 уникальных текстов, включая путь обучения. Старые Matching headings/information обозначены как упрощённые микроупражнения.

Полный комплект `academic-original-01`: тексты `seeds`, `lighting`, `repair` по 770, 781 и 922 слова, суммарно 2 473; 40 вопросов, 60 минут. Включены общий список восьми заголовков для шести абзацев с запретом повторного использования, TFNG, completion с лимитом слов и MCQ. Повторные заголовки отвергаются и сервером. К каждому ключу записаны объяснение и опорная цитата из соответствующего текста; отдельно сохранён проверенный список 40 ключей в регрессиях. Для NOT GIVEN вручную проверено отсутствие нужного сравнения/факта. Тексты написаны для этого проекта, не скопированы из официального банка.

Сервер хранит срок, ответы и результат в новой таблице `ielts_reading_runs`. Перезагрузка не продлевает время; после истечения учитываются только ранее сохранённые ответы. Повторное завершение не создаёт новые попытки или XP. Комплект возвращает raw score /40 и процент; неподтверждённый Band не назначается даже полному авторскому комплекту.

**Listening.** Браузерная речь названа синтетической, два коротких сценария отделены от полноценного пробника. Результат — точность, без Band. Нового полноценного аудиокомплекта и проверки акцентов/голосов в этой работе не добавлено.

**Speaking.** Числовой Pronunciation по тексту всегда заменяется на «не оценивалось» и исключается из среднего. Даже если модель вернёт такой балл, сервер его отбросит. Оставшаяся средняя оценка трёх критериев явно названа частичной оценкой расшифровки; аудиоплавность по ней не измеряется. В аналитике общего IELTS эта частичная оценка не используется.

**Writing/Speaking demo.** Общий балл, прогноз и критерии возвращают null; показываются технические сведения об объёме/темпе, без содержательных выводов из числа слов. Старые демозаписи с числовыми оценками безопасно нормализуются при чтении, а не удаляются. Аналитика уровня выбирает только Writing с `mode=ai`; она не является измерением всех четырёх экзаменационных навыков. Активность/XP могут сохраняться как факт упражнения, но не как подтверждённый языковой уровень.

## ЕНТ и сохранность данных

Демогенератор работает только для поддержанных русскоязычных упражнений на проценты/финансовую грамотность в `math-lit`. Для другого предмета, темы, языка или типа возвращает отсутствие материалов. Позиция ответа меняется корректно вместе с индексом; повторяющиеся, в том числе численно эквивалентные, варианты отклоняются.

Все 10 исходных ошибочных записей исключены фильтром качества из практики, наполнения пробников, пути, новых дуэлей, мастер-режима и очереди повторения. Старые записи, попытки и расписание повторения остаются в базе; исторические lookup по ID не удалены. Изоляция осуществляется при выдаче, а не массовым удалением или сбросом.

Изолированные ID: `ent-5qOlvfgh`, `ent-5tI0nFaj`, `ent-A7zMxFVx`, `ent-ANrqaj77`, `ent-dId8dFkQ`, `ent-eIX23zB-`, `ent-hiQLfF9z`, `ent-oUbOr_o7`, `ent-rTjGX5g-`, `ent-xScAb-XJ`.

Хеши логических строк 57 таблиц исходной базы сравнены с сохранённым снимком: изменённых таблиц — **0**. Проверки API и браузера выполнялись на одноразовых базах и отдельной копии `qa.sqlite`. В исходной базе сохранены все десять записей ЕНТ. Новая таблица результатов Reading создаётся аддитивно, без пересоздания существующих таблиц.

## Программирование и автоматические проверки

Добавлены 44 независимых эталонных решения и 124 фиксированных граничных теста в сами задачи. Все ожидаемые значения заданы отдельно, не вычисляются эталоном при генерации банка. Покрыты повторы, нули, отрицательные числа, пустые входы в допустимых контрактах, точные границы интервалов, деление к нулю, непрямые нарушения BST, путь только до листа, недостижимость, циклы и невозможные комбинации. Сравнение ответов больше не игнорирует порядок внутри перестановок и подмножеств; для групп анаграмм игнорирование внутреннего порядка включается отдельно.

`check:content` проверяет обязательные поля, уникальные ID, числовые ключи/правила округления, ключи MCQ, численно эквивалентные варианты, канонические условия, семейства, ссылки на подчёркивание, длины новых текстов, структуру Academic-комплекта и опорные цитаты. Собственная проверка сохранённого ключа оставлена только как проверка согласованности. Правильность арифметики генераторов и программных тестов подтверждается отдельными реализациями.

| Проверка | Результат |
|---|---|
| Проверка типов | PASS |
| Production build (`tsc --noEmit && vite build`) | PASS |
| `check:content` | PASS: 492 независимых пересчёта Math, 64 эталона, 390 coding fixtures |
| `check:regressions` | PASS: 4 567 assertions |
| `check:api` | PASS: 71 assertions на новой одноразовой базе |
| `git diff --check` | PASS |
| Исходные строки базы | Без изменений по хешам логического содержимого |

В среде использовался поставляемый Node.js 24.22.1 и pnpm; сценарий сборки соответствует `npm run build`. Исправлена ранее воспроизводимая ошибка TypeScript-расширения Express: используется стандартный глобальный интерфейс Express.Request вместо недоступного прямого имени транзитивного пакета типов.

Нефатальные предупреждения сборки: существующая CAD-зависимость внешне использует `node:module`, а некоторые существующие chunks больше 500 kB. Они не исправлялись в рамках качества учебного контента.

## Ручная проверка в браузере

- Банк SAT: фильтр «Контроль», переразмеченная сложность, отсутствие дублей в новой выдаче.
- `m-ratio-04`: ввод `100/3`, ответ «Верно!», точное объяснение и математическая вёрстка.
- Подчёркивание: `x-rw-text-structure-h01` в банке и тестовом пробнике; подчеркиваемое предложение в обычном уроке пути; ответ урока проверен. Для доступа к конкретным режимам использованы фикстуры только в копии базы.
- Пробник: выбранный вариант сохраняется при повторном открытии; отдельно API завершил все четыре модуля полного теста из 98 вопросов.
- IELTS Reading: корректные счётчики, результат короткого набора без Band, настоящий общий список заголовков, отключение уже использованного заголовка, сохранение выбора и оставшегося времени после reload, полный результат /40.
- IELTS Writing demo: тире вместо Band, явная пометка отсутствия оценки уровня.
- IELTS Listening: подпись об ограниченности синтетической практики; микрофон и платные модели не включались.
- ЕНТ history-kz: показано отсутствие проверенных материалов; скидки вместо истории не выдаются.

Скриншоты приложены рядом с отчётом: `sat-fraction-verified.png`, `sat-underline-verified.png`, `sat-lesson-underline.png`, `sat-mock-underline.png`, `ielts-short-result.png`, `ielts-academic-result.png`, `ielts-writing-demo.png`, `ent-no-materials.png`.

## Оставшиеся ограничения

- Метки сложности редакционные. Пилотирования на репрезентативной выборке, IRT-калибровки и доказанного прогноза официального SAT/IELTS нет.
- Подбор SAT балансирует темы и позиции, но не делает формы психометрически равноценными. После честной ревизии сложных заданий мало; фактическая смесь может отличаться от целевой.
- Структурное обнаружение семейств не заменяет ручную проверку семантических повторов. Полная символьная эквивалентность всех алгебраических дистракторов не доказана.
- Из исходного импортированного SAT-банка не решены независимо все задания. Добавленные ключи проверены по текстам и отдельным спискам; внешней экспертизы авторского IELTS-комплекта не было.
- Старые короткие IELTS-наборы сохраняют упрощённые форматы. Настоящий общий headings-list реализован в новом полном комплекте; все старые форматы массово не переписывались.
- Listening остаётся ограниченной синтетической тренировкой. Анализ произношения по аудио отсутствует; AI Speaking оценивает только доступные текстовые признаки.
- Десять новых длинных R&W-текстов улучшают охват, но не исправляют весь исходный перекос банка.
- Старые флаги правильности в attempts и сохранённые итоговые баллы тестов не пересчитывались задним числом. Таблица attempts не хранит исходный введённый ответ, поэтому надёжный массовый пересчёт невозможен. Новые проверки и повторное отображение вопросов используют исправленные ключи.
- Код и локальные данные проверены; изменения на рабочий сервер не развёрнуты. Коммиты и отправка на GitHub не выполнялись.

## Основные файлы изменений

- `shared/numeric.ts`, `shared/sat.ts`, `shared/satQuality.ts`, `shared/satDifficulty.json`, `shared/satOriginal.ts`: числовые правила, генераторы, метаданные, сложность, новый контент.
- `server/routes/sat.ts`, `server/routes/path.ts`, `src/components/RichText.tsx`, страницы SAT: новая выдача, совместимость, разметка, ввод, честные подписи тренировок.
- `server/content/ieltsAcademic.ts`, `shared/ieltsAssessment.ts`, `server/routes/ielts.ts`, `server/db.ts`, страницы IELTS: полный Reading и результаты.
- `server/ai.ts`, `server/progress.ts`: деморежимы, частичная оценка Speaking и исключение демоданных из уровня.
- `shared/entQuality.ts`, маршруты ЕНТ/дуэлей/пути/повтора, `server/review.ts`: безопасная изоляция и контроль генерации.
- `scripts/coding-reference.ts`, `shared/codingEdges.ts`, `shared/answer.ts`, `shared/problems.ts`, `src/lib/runner.ts`: независимые эталоны, граничные тесты и корректное сравнение.
- `scripts/check-content.ts`, `scripts/sat-math-reference.ts`, `scripts/content-regressions.ts`, `scripts/content-api-check.ts`, `scripts/content-inventory.ts`: воспроизводимые проверки и инвентаризация.

Полный перечень 495 решений по Hard с причинами, распределение по навыкам, новые ID и отображение 29 старых ID на канонические находятся в `content-changes.json`. Полный применимый diff — `365step-content-quality.patch`.

## Приложение: группы одинаковых условий

Слева канонический ID; справа сохранённые совместимые дополнительные ID:

- `m-lin-03` ← `m-lin-06`
- `m-cost-01` ← `m-cost-04`
- `m-cost-02` ← `m-cost-05`
- `m-quad-03` ← `m-quad-07`
- `m-growth-02` ← `m-growth-06`
- `m-growth-05` ← `m-growth-11`
- `m-pct-04` ← `m-pct-12`
- `m-pct-05` ← `m-pct-07`
- `m-ratio-01` ← `m-ratio-06`
- `m-ratio-10` ← `m-ratio-11`
- `m-circle-01` ← `m-circle-06`
- `m-circle-04` ← `m-circle-07`
- `m-circle-08` ← `m-circle-09`, `m-circle-12`, `x-math-area-volume-e04`
- `m-pyth-01` ← `m-pyth-08`
- `m-pyth-02` ← `m-pyth-06`, `m-pyth-09`
- `m-pyth-04` ← `m-pyth-11`, `m-pyth-12`
- `m-pyth-07` ← `m-pyth-10`
- `m-trig-01` ← `m-trig-02`, `m-trig-04`, `m-trig-06`, `m-trig-07`, `m-trig-08`, `m-trig-11`
- `m-trig-05` ← `m-trig-10`, `m-trig-12`

## Приложение: исходные 19 заданий с подчёркиванием

`rw-ii-04`, `rw-cs-01`, `rw-cs-02`, `rw-cs-03`, `rw-cs-07`, `rw-ei-01`, `rw-ei-02`, `rw-ei-05`, `rw-ei-06`, `rw-sec-01`, `rw-sec-02`, `rw-sec-03`, `rw-sec-04`, `rw-sec-05`, `rw-sec-06`, `rw-sec-07`, `rw-gen-sva-01`, `rw-gen-sva-02`, `rw-gen-sva-03`, `rw-gen-sva-04`, `rw-gen-sva-05`, `rw-gen-sva-06`, `rw-gen-sva-07`, `rw-gen-sva-08`, `rw-gen-sva-09`, `rw-gen-sva-10`, `rw-gen-sva-11`, `rw-gen-sva-12`, `rw-gen-sva-13`, `rw-gen-sva-14`, `rw-gen-sva-15`, `rw-gen-sva-16`, `rw-gen-tr-01`, `rw-gen-tr-02`, `rw-gen-tr-03`, `rw-gen-tr-04`, `rw-gen-tr-05`, `rw-gen-tr-06`, `rw-gen-tr-07`, `rw-gen-tr-08`, `rw-gen-tr-09`, `rw-gen-tr-10`, `rw-gen-tr-11`, `rw-gen-tr-12`, `rw-gen-bd-01`, `rw-gen-bd-02`, `rw-gen-bd-03`, `rw-gen-bd-04`, `rw-gen-bd-05`, `rw-gen-bd-06`, `rw-gen-bd-07`, `rw-gen-bd-08`, `x-rw-boundaries-e01`, `x-rw-boundaries-e02`, `x-rw-boundaries-e03`, `x-rw-boundaries-e04`, `x-rw-boundaries-e05`, `x-rw-boundaries-e06`, `x-rw-boundaries-e07`, `x-rw-boundaries-e08`, `x-rw-boundaries-e09`, `x-rw-boundaries-e10`, `x-rw-boundaries-e11`, `x-rw-boundaries-e12`, `x-rw-boundaries-e13`, `x-rw-boundaries-e14`, `x-rw-boundaries-e15`, `x-rw-boundaries-m01`, `x-rw-boundaries-m02`, `x-rw-boundaries-m03`, `x-rw-boundaries-m04`, `x-rw-boundaries-m05`, `x-rw-boundaries-m06`, `x-rw-boundaries-m07`, `x-rw-boundaries-m08`, `x-rw-boundaries-m09`, `x-rw-boundaries-m10`, `x-rw-boundaries-m11`, `x-rw-boundaries-m12`, `x-rw-boundaries-m13`, `x-rw-boundaries-m14`, `x-rw-boundaries-m15`, `x-rw-boundaries-h01`, `x-rw-boundaries-h02`, `x-rw-boundaries-h03`, `x-rw-boundaries-h04`, `x-rw-boundaries-h05`, `x-rw-boundaries-h06`, `x-rw-boundaries-h07`, `x-rw-boundaries-h08`, `x-rw-boundaries-h09`, `x-rw-boundaries-h10`, `x-rw-boundaries-h11`, `x-rw-boundaries-h12`, `x-rw-boundaries-h13`, `x-rw-boundaries-h14`, `x-rw-boundaries-h15`, `x-rw-form-structure-sense-e01`, `x-rw-form-structure-sense-e02`, `x-rw-form-structure-sense-e03`, `x-rw-form-structure-sense-e04`, `x-rw-form-structure-sense-e05`, `x-rw-form-structure-sense-e06`, `x-rw-form-structure-sense-e07`, `x-rw-form-structure-sense-e08`, `x-rw-form-structure-sense-e09`, `x-rw-form-structure-sense-e10`, `x-rw-form-structure-sense-e11`, `x-rw-form-structure-sense-e12`, `x-rw-form-structure-sense-e13`, `x-rw-form-structure-sense-e14`, `x-rw-form-structure-sense-e15`, `x-rw-form-structure-sense-m01`, `x-rw-form-structure-sense-m02`, `x-rw-form-structure-sense-m03`, `x-rw-form-structure-sense-m04`, `x-rw-form-structure-sense-m05`, `x-rw-form-structure-sense-m06`, `x-rw-form-structure-sense-m07`, `x-rw-form-structure-sense-m08`, `x-rw-form-structure-sense-m09`, `x-rw-form-structure-sense-m10`, `x-rw-form-structure-sense-m11`, `x-rw-form-structure-sense-m12`, `x-rw-form-structure-sense-m13`, `x-rw-form-structure-sense-m14`, `x-rw-form-structure-sense-m15`, `x-rw-form-structure-sense-h01`, `x-rw-form-structure-sense-h02`, `x-rw-form-structure-sense-h03`, `x-rw-form-structure-sense-h04`, `x-rw-form-structure-sense-h05`, `x-rw-form-structure-sense-h06`, `x-rw-form-structure-sense-h07`, `x-rw-form-structure-sense-h08`, `x-rw-form-structure-sense-h09`, `x-rw-form-structure-sense-h10`, `x-rw-form-structure-sense-h11`, `x-rw-form-structure-sense-h12`, `x-rw-form-structure-sense-h13`, `x-rw-form-structure-sense-h14`, `x-rw-form-structure-sense-h15`, `x-rw-inferences-e01`, `x-rw-inferences-e02`, `x-rw-inferences-e03`, `x-rw-inferences-e04`, `x-rw-inferences-e05`, `x-rw-inferences-e06`, `x-rw-inferences-e07`, `x-rw-inferences-e08`, `x-rw-inferences-e09`, `x-rw-inferences-e10`, `x-rw-inferences-e11`, `x-rw-inferences-e12`, `x-rw-inferences-e13`, `x-rw-inferences-e14`, `x-rw-inferences-e15`, `x-rw-inferences-m01`, `x-rw-inferences-m02`, `x-rw-inferences-m03`, `x-rw-inferences-m04`, `x-rw-inferences-m05`, `x-rw-inferences-m06`, `x-rw-inferences-m07`, `x-rw-inferences-m08`, `x-rw-inferences-m09`, `x-rw-inferences-m10`, `x-rw-inferences-m11`, `x-rw-inferences-m12`, `x-rw-inferences-m13`, `x-rw-inferences-m14`, `x-rw-inferences-m15`, `x-rw-inferences-h01`, `x-rw-inferences-h02`, `x-rw-inferences-h03`, `x-rw-inferences-h04`, `x-rw-inferences-h05`, `x-rw-inferences-h06`, `x-rw-inferences-h07`, `x-rw-inferences-h08`, `x-rw-inferences-h09`, `x-rw-inferences-h10`, `x-rw-inferences-h11`, `x-rw-inferences-h12`, `x-rw-inferences-h13`, `x-rw-inferences-h14`, `x-rw-inferences-h15`, `x-rw-quantitative-evidence-e01`, `x-rw-quantitative-evidence-e02`, `x-rw-quantitative-evidence-e03`, `x-rw-quantitative-evidence-e04`, `x-rw-quantitative-evidence-e06`, `x-rw-quantitative-evidence-e07`, `x-rw-quantitative-evidence-e08`, `x-rw-quantitative-evidence-e09`, `x-rw-quantitative-evidence-e11`, `x-rw-quantitative-evidence-e12`, `x-rw-quantitative-evidence-e13`, `x-rw-quantitative-evidence-e14`, `x-rw-quantitative-evidence-m01`, `x-rw-quantitative-evidence-m02`, `x-rw-quantitative-evidence-m04`, `x-rw-quantitative-evidence-m05`, `x-rw-quantitative-evidence-m07`, `x-rw-quantitative-evidence-m09`, `x-rw-quantitative-evidence-m10`, `x-rw-quantitative-evidence-m12`, `x-rw-quantitative-evidence-m14`, `x-rw-quantitative-evidence-h01`, `x-rw-quantitative-evidence-h03`, `x-rw-quantitative-evidence-h05`, `x-rw-quantitative-evidence-h10`, `x-rw-quantitative-evidence-h12`, `x-rw-text-structure-e01`, `x-rw-text-structure-e02`, `x-rw-text-structure-e05`, `x-rw-text-structure-e08`, `x-rw-text-structure-e10`, `x-rw-text-structure-e13`, `x-rw-text-structure-m01`, `x-rw-text-structure-m04`, `x-rw-text-structure-m07`, `x-rw-text-structure-m09`, `x-rw-text-structure-m11`, `x-rw-text-structure-m14`, `x-rw-text-structure-h01`, `x-rw-text-structure-h03`, `x-rw-text-structure-h06`, `x-rw-text-structure-h08`, `x-rw-text-structure-h10`, `x-rw-text-structure-h12`, `x-rw-text-structure-h14`, `x-rw-transitions-e01`, `x-rw-transitions-e02`, `x-rw-transitions-e03`, `x-rw-transitions-e04`, `x-rw-transitions-e05`, `x-rw-transitions-e06`, `x-rw-transitions-e07`, `x-rw-transitions-e08`, `x-rw-transitions-e09`, `x-rw-transitions-e10`, `x-rw-transitions-e11`, `x-rw-transitions-e12`, `x-rw-transitions-e13`, `x-rw-transitions-e14`, `x-rw-transitions-e15`, `x-rw-transitions-m01`, `x-rw-transitions-m02`, `x-rw-transitions-m03`, `x-rw-transitions-m04`, `x-rw-transitions-m05`, `x-rw-transitions-m06`, `x-rw-transitions-m07`, `x-rw-transitions-m08`, `x-rw-transitions-m09`, `x-rw-transitions-m10`, `x-rw-transitions-m11`, `x-rw-transitions-m12`, `x-rw-transitions-m13`, `x-rw-transitions-m14`, `x-rw-transitions-m15`, `x-rw-transitions-h01`, `x-rw-transitions-h02`, `x-rw-transitions-h03`, `x-rw-transitions-h04`, `x-rw-transitions-h05`, `x-rw-transitions-h06`, `x-rw-transitions-h07`, `x-rw-transitions-h08`, `x-rw-transitions-h09`, `x-rw-transitions-h10`, `x-rw-transitions-h11`, `x-rw-transitions-h12`, `x-rw-transitions-h13`, `x-rw-transitions-h14`, `x-rw-transitions-h15`, `x-rw-words-in-context-e01`, `x-rw-words-in-context-e02`, `x-rw-words-in-context-e03`, `x-rw-words-in-context-e04`, `x-rw-words-in-context-e05`, `x-rw-words-in-context-e06`, `x-rw-words-in-context-e07`, `x-rw-words-in-context-e08`, `x-rw-words-in-context-e09`, `x-rw-words-in-context-e10`, `x-rw-words-in-context-e11`, `x-rw-words-in-context-e12`, `x-rw-words-in-context-e13`, `x-rw-words-in-context-e14`, `x-rw-words-in-context-e15`, `x-rw-words-in-context-m01`, `x-rw-words-in-context-m02`, `x-rw-words-in-context-m03`, `x-rw-words-in-context-m04`, `x-rw-words-in-context-m05`, `x-rw-words-in-context-m06`, `x-rw-words-in-context-m07`, `x-rw-words-in-context-m08`, `x-rw-words-in-context-m09`, `x-rw-words-in-context-m10`, `x-rw-words-in-context-m11`, `x-rw-words-in-context-m12`, `x-rw-words-in-context-m13`, `x-rw-words-in-context-m14`, `x-rw-words-in-context-m15`, `x-rw-words-in-context-h01`, `x-rw-words-in-context-h02`, `x-rw-words-in-context-h03`, `x-rw-words-in-context-h04`, `x-rw-words-in-context-h05`, `x-rw-words-in-context-h06`, `x-rw-words-in-context-h07`, `x-rw-words-in-context-h08`, `x-rw-words-in-context-h09`, `x-rw-words-in-context-h10`, `x-rw-words-in-context-h11`, `x-rw-words-in-context-h12`, `x-rw-words-in-context-h13`, `x-rw-words-in-context-h14`, `x-rw-words-in-context-h15`.

## Приложение: решения по прежним Hard

1 = Easy, 2 = Medium, 3 = Hard. Исходная метка всех перечисленных ID была 3. Причины в машиночитаемом перечне.

| ID | После |
|---|---:|
| `rw-ii-04` | 2 |
| `rw-ii-07` | 2 |
| `rw-cs-03` | 2 |
| `rw-cs-05` | 2 |
| `rw-cs-06` | 2 |
| `rw-ei-04` | 2 |
| `rw-ei-05` | 1 |
| `rw-sec-05` | 2 |
| `rw-sec-06` | 2 |
| `m-nosol-01` | 2 |
| `m-nosol-02` | 2 |
| `m-nosol-03` | 2 |
| `m-nosol-04` | 2 |
| `m-nosol-05` | 2 |
| `m-nosol-06` | 2 |
| `m-nosol-07` | 2 |
| `m-nosol-08` | 2 |
| `m-nosol-09` | 2 |
| `m-nosol-10` | 2 |
| `m-nosol-11` | 2 |
| `m-nosol-12` | 2 |
| `m-vertex-01` | 2 |
| `m-vertex-02` | 2 |
| `m-vertex-03` | 2 |
| `m-vertex-04` | 2 |
| `m-vertex-05` | 2 |
| `m-vertex-06` | 2 |
| `m-vertex-07` | 2 |
| `m-vertex-08` | 2 |
| `m-vertex-09` | 2 |
| `m-vertex-10` | 2 |
| `m-vertex-11` | 2 |
| `m-vertex-12` | 2 |
| `m-trig-01` | 1 |
| `m-trig-02` | 1 |
| `m-trig-03` | 1 |
| `m-trig-04` | 1 |
| `m-trig-05` | 1 |
| `m-trig-06` | 1 |
| `m-trig-07` | 1 |
| `m-trig-08` | 1 |
| `m-trig-09` | 1 |
| `m-trig-10` | 1 |
| `m-trig-11` | 1 |
| `m-trig-12` | 1 |
| `x-rw-boundaries-h01` | 2 |
| `x-rw-boundaries-h02` | 1 |
| `x-rw-boundaries-h03` | 2 |
| `x-rw-boundaries-h04` | 2 |
| `x-rw-boundaries-h05` | 1 |
| `x-rw-boundaries-h06` | 2 |
| `x-rw-boundaries-h07` | 2 |
| `x-rw-boundaries-h08` | 1 |
| `x-rw-boundaries-h09` | 1 |
| `x-rw-boundaries-h10` | 2 |
| `x-rw-boundaries-h11` | 1 |
| `x-rw-boundaries-h12` | 2 |
| `x-rw-boundaries-h13` | 2 |
| `x-rw-boundaries-h14` | 2 |
| `x-rw-boundaries-h15` | 2 |
| `x-rw-central-ideas-h01` | 2 |
| `x-rw-central-ideas-h02` | 2 |
| `x-rw-central-ideas-h03` | 2 |
| `x-rw-central-ideas-h04` | 2 |
| `x-rw-central-ideas-h05` | 2 |
| `x-rw-central-ideas-h06` | 1 |
| `x-rw-central-ideas-h07` | 2 |
| `x-rw-central-ideas-h08` | 2 |
| `x-rw-central-ideas-h09` | 2 |
| `x-rw-central-ideas-h10` | 2 |
| `x-rw-central-ideas-h11` | 2 |
| `x-rw-central-ideas-h12` | 2 |
| `x-rw-central-ideas-h13` | 2 |
| `x-rw-central-ideas-h14` | 2 |
| `x-rw-central-ideas-h15` | 2 |
| `x-rw-cross-text-h01` | 2 |
| `x-rw-cross-text-h02` | 2 |
| `x-rw-cross-text-h03` | 2 |
| `x-rw-cross-text-h04` | 2 |
| `x-rw-cross-text-h05` | 2 |
| `x-rw-cross-text-h06` | 2 |
| `x-rw-cross-text-h07` | 2 |
| `x-rw-cross-text-h08` | 2 |
| `x-rw-cross-text-h09` | 2 |
| `x-rw-cross-text-h10` | 2 |
| `x-rw-cross-text-h11` | 2 |
| `x-rw-cross-text-h12` | 2 |
| `x-rw-cross-text-h13` | 2 |
| `x-rw-cross-text-h14` | 2 |
| `x-rw-cross-text-h15` | 2 |
| `x-rw-form-structure-sense-h01` | 1 |
| `x-rw-form-structure-sense-h02` | 1 |
| `x-rw-form-structure-sense-h03` | 2 |
| `x-rw-form-structure-sense-h04` | 2 |
| `x-rw-form-structure-sense-h05` | 2 |
| `x-rw-form-structure-sense-h06` | 1 |
| `x-rw-form-structure-sense-h07` | 1 |
| `x-rw-form-structure-sense-h08` | 2 |
| `x-rw-form-structure-sense-h09` | 2 |
| `x-rw-form-structure-sense-h10` | 2 |
| `x-rw-form-structure-sense-h11` | 1 |
| `x-rw-form-structure-sense-h12` | 2 |
| `x-rw-form-structure-sense-h13` | 1 |
| `x-rw-form-structure-sense-h14` | 1 |
| `x-rw-form-structure-sense-h15` | 2 |
| `x-rw-inferences-h01` | 2 |
| `x-rw-inferences-h02` | 2 |
| `x-rw-inferences-h03` | 2 |
| `x-rw-inferences-h04` | 2 |
| `x-rw-inferences-h05` | 2 |
| `x-rw-inferences-h06` | 2 |
| `x-rw-inferences-h07` | 2 |
| `x-rw-inferences-h08` | 2 |
| `x-rw-inferences-h09` | 2 |
| `x-rw-inferences-h10` | 2 |
| `x-rw-inferences-h11` | 2 |
| `x-rw-inferences-h12` | 2 |
| `x-rw-inferences-h13` | 2 |
| `x-rw-inferences-h14` | 2 |
| `x-rw-inferences-h15` | 2 |
| `x-rw-quantitative-evidence-h01` | 2 |
| `x-rw-quantitative-evidence-h02` | 2 |
| `x-rw-quantitative-evidence-h03` | 2 |
| `x-rw-quantitative-evidence-h04` | 2 |
| `x-rw-quantitative-evidence-h05` | 2 |
| `x-rw-quantitative-evidence-h06` | 2 |
| `x-rw-quantitative-evidence-h07` | 2 |
| `x-rw-quantitative-evidence-h08` | 2 |
| `x-rw-quantitative-evidence-h09` | 2 |
| `x-rw-quantitative-evidence-h10` | 2 |
| `x-rw-quantitative-evidence-h11` | 2 |
| `x-rw-quantitative-evidence-h12` | 2 |
| `x-rw-quantitative-evidence-h13` | 2 |
| `x-rw-quantitative-evidence-h14` | 2 |
| `x-rw-quantitative-evidence-h15` | 2 |
| `x-rw-rhetorical-synthesis-h01` | 2 |
| `x-rw-rhetorical-synthesis-h02` | 2 |
| `x-rw-rhetorical-synthesis-h03` | 2 |
| `x-rw-rhetorical-synthesis-h04` | 2 |
| `x-rw-rhetorical-synthesis-h05` | 2 |
| `x-rw-rhetorical-synthesis-h06` | 2 |
| `x-rw-rhetorical-synthesis-h07` | 2 |
| `x-rw-rhetorical-synthesis-h08` | 2 |
| `x-rw-rhetorical-synthesis-h09` | 2 |
| `x-rw-rhetorical-synthesis-h10` | 1 |
| `x-rw-rhetorical-synthesis-h11` | 2 |
| `x-rw-rhetorical-synthesis-h12` | 2 |
| `x-rw-rhetorical-synthesis-h13` | 2 |
| `x-rw-rhetorical-synthesis-h14` | 2 |
| `x-rw-rhetorical-synthesis-h15` | 2 |
| `x-rw-text-structure-h01` | 2 |
| `x-rw-text-structure-h02` | 2 |
| `x-rw-text-structure-h03` | 2 |
| `x-rw-text-structure-h04` | 2 |
| `x-rw-text-structure-h05` | 2 |
| `x-rw-text-structure-h06` | 2 |
| `x-rw-text-structure-h07` | 2 |
| `x-rw-text-structure-h08` | 2 |
| `x-rw-text-structure-h09` | 2 |
| `x-rw-text-structure-h10` | 2 |
| `x-rw-text-structure-h11` | 2 |
| `x-rw-text-structure-h12` | 2 |
| `x-rw-text-structure-h13` | 2 |
| `x-rw-text-structure-h14` | 2 |
| `x-rw-text-structure-h15` | 2 |
| `x-rw-textual-evidence-h01` | 2 |
| `x-rw-textual-evidence-h02` | 2 |
| `x-rw-textual-evidence-h03` | 2 |
| `x-rw-textual-evidence-h04` | 2 |
| `x-rw-textual-evidence-h05` | 2 |
| `x-rw-textual-evidence-h06` | 2 |
| `x-rw-textual-evidence-h07` | 2 |
| `x-rw-textual-evidence-h08` | 2 |
| `x-rw-textual-evidence-h09` | 2 |
| `x-rw-textual-evidence-h10` | 2 |
| `x-rw-textual-evidence-h11` | 2 |
| `x-rw-textual-evidence-h12` | 2 |
| `x-rw-textual-evidence-h13` | 2 |
| `x-rw-textual-evidence-h14` | 2 |
| `x-rw-textual-evidence-h15` | 2 |
| `x-rw-transitions-h01` | 1 |
| `x-rw-transitions-h02` | 1 |
| `x-rw-transitions-h03` | 1 |
| `x-rw-transitions-h04` | 1 |
| `x-rw-transitions-h05` | 1 |
| `x-rw-transitions-h06` | 1 |
| `x-rw-transitions-h07` | 1 |
| `x-rw-transitions-h08` | 1 |
| `x-rw-transitions-h09` | 1 |
| `x-rw-transitions-h10` | 1 |
| `x-rw-transitions-h11` | 1 |
| `x-rw-transitions-h12` | 1 |
| `x-rw-transitions-h13` | 1 |
| `x-rw-transitions-h14` | 1 |
| `x-rw-transitions-h15` | 1 |
| `x-rw-words-in-context-h01` | 2 |
| `x-rw-words-in-context-h02` | 2 |
| `x-rw-words-in-context-h03` | 2 |
| `x-rw-words-in-context-h04` | 2 |
| `x-rw-words-in-context-h05` | 2 |
| `x-rw-words-in-context-h06` | 2 |
| `x-rw-words-in-context-h07` | 2 |
| `x-rw-words-in-context-h08` | 2 |
| `x-rw-words-in-context-h09` | 2 |
| `x-rw-words-in-context-h10` | 2 |
| `x-rw-words-in-context-h11` | 2 |
| `x-rw-words-in-context-h12` | 2 |
| `x-rw-words-in-context-h13` | 2 |
| `x-rw-words-in-context-h14` | 2 |
| `x-rw-words-in-context-h15` | 2 |
| `x-math-area-volume-h01` | 2 |
| `x-math-area-volume-h02` | 2 |
| `x-math-area-volume-h03` | 2 |
| `x-math-area-volume-h04` | 2 |
| `x-math-area-volume-h05` | 1 |
| `x-math-area-volume-h06` | 2 |
| `x-math-area-volume-h07` | 2 |
| `x-math-area-volume-h08` | 2 |
| `x-math-area-volume-h09` | 1 |
| `x-math-area-volume-h10` | 2 |
| `x-math-area-volume-h11` | 2 |
| `x-math-area-volume-h12` | 2 |
| `x-math-area-volume-h13` | 2 |
| `x-math-area-volume-h14` | 2 |
| `x-math-area-volume-h15` | 2 |
| `x-math-circles-h01` | 2 |
| `x-math-circles-h02` | 2 |
| `x-math-circles-h03` | 2 |
| `x-math-circles-h04` | 1 |
| `x-math-circles-h05` | 2 |
| `x-math-circles-h06` | 2 |
| `x-math-circles-h07` | 2 |
| `x-math-circles-h08` | 2 |
| `x-math-circles-h09` | 2 |
| `x-math-circles-h10` | 2 |
| `x-math-circles-h11` | 1 |
| `x-math-circles-h12` | 2 |
| `x-math-circles-h13` | 2 |
| `x-math-circles-h14` | 2 |
| `x-math-circles-h15` | 2 |
| `x-math-equivalent-expressions-h01` | 2 |
| `x-math-equivalent-expressions-h02` | 2 |
| `x-math-equivalent-expressions-h03` | 2 |
| `x-math-equivalent-expressions-h04` | 1 |
| `x-math-equivalent-expressions-h05` | 2 |
| `x-math-equivalent-expressions-h06` | 1 |
| `x-math-equivalent-expressions-h07` | 1 |
| `x-math-equivalent-expressions-h08` | 1 |
| `x-math-equivalent-expressions-h09` | 2 |
| `x-math-equivalent-expressions-h10` | 1 |
| `x-math-equivalent-expressions-h11` | 1 |
| `x-math-equivalent-expressions-h12` | 1 |
| `x-math-equivalent-expressions-h13` | 3 |
| `x-math-equivalent-expressions-h14` | 2 |
| `x-math-equivalent-expressions-h15` | 2 |
| `x-math-inequalities-h01` | 2 |
| `x-math-inequalities-h02` | 2 |
| `x-math-inequalities-h03` | 2 |
| `x-math-inequalities-h04` | 2 |
| `x-math-inequalities-h05` | 2 |
| `x-math-inequalities-h06` | 2 |
| `x-math-inequalities-h07` | 2 |
| `x-math-inequalities-h08` | 2 |
| `x-math-inequalities-h09` | 2 |
| `x-math-inequalities-h10` | 2 |
| `x-math-inequalities-h11` | 2 |
| `x-math-inequalities-h12` | 2 |
| `x-math-inequalities-h13` | 2 |
| `x-math-inequalities-h14` | 2 |
| `x-math-inequalities-h15` | 2 |
| `x-math-linear-equations-one-h01` | 2 |
| `x-math-linear-equations-one-h02` | 2 |
| `x-math-linear-equations-one-h03` | 2 |
| `x-math-linear-equations-one-h04` | 2 |
| `x-math-linear-equations-one-h05` | 2 |
| `x-math-linear-equations-one-h06` | 2 |
| `x-math-linear-equations-one-h07` | 2 |
| `x-math-linear-equations-one-h08` | 2 |
| `x-math-linear-equations-one-h09` | 2 |
| `x-math-linear-equations-one-h10` | 2 |
| `x-math-linear-equations-one-h11` | 2 |
| `x-math-linear-equations-one-h12` | 2 |
| `x-math-linear-equations-one-h13` | 2 |
| `x-math-linear-equations-one-h14` | 2 |
| `x-math-linear-equations-one-h15` | 2 |
| `x-math-linear-equations-two-h01` | 2 |
| `x-math-linear-equations-two-h02` | 2 |
| `x-math-linear-equations-two-h03` | 2 |
| `x-math-linear-equations-two-h04` | 2 |
| `x-math-linear-equations-two-h05` | 2 |
| `x-math-linear-equations-two-h06` | 2 |
| `x-math-linear-equations-two-h07` | 2 |
| `x-math-linear-equations-two-h08` | 2 |
| `x-math-linear-equations-two-h09` | 2 |
| `x-math-linear-equations-two-h10` | 2 |
| `x-math-linear-equations-two-h11` | 2 |
| `x-math-linear-equations-two-h12` | 2 |
| `x-math-linear-equations-two-h13` | 2 |
| `x-math-linear-equations-two-h14` | 2 |
| `x-math-linear-equations-two-h15` | 2 |
| `x-math-linear-functions-h01` | 2 |
| `x-math-linear-functions-h02` | 2 |
| `x-math-linear-functions-h03` | 2 |
| `x-math-linear-functions-h04` | 2 |
| `x-math-linear-functions-h05` | 2 |
| `x-math-linear-functions-h06` | 2 |
| `x-math-linear-functions-h07` | 1 |
| `x-math-linear-functions-h08` | 1 |
| `x-math-linear-functions-h09` | 2 |
| `x-math-linear-functions-h10` | 2 |
| `x-math-linear-functions-h11` | 2 |
| `x-math-linear-functions-h12` | 2 |
| `x-math-linear-functions-h13` | 2 |
| `x-math-linear-functions-h14` | 2 |
| `x-math-linear-functions-h15` | 2 |
| `x-math-lines-angles-triangles-h01` | 2 |
| `x-math-lines-angles-triangles-h02` | 2 |
| `x-math-lines-angles-triangles-h03` | 2 |
| `x-math-lines-angles-triangles-h04` | 1 |
| `x-math-lines-angles-triangles-h05` | 1 |
| `x-math-lines-angles-triangles-h06` | 1 |
| `x-math-lines-angles-triangles-h07` | 2 |
| `x-math-lines-angles-triangles-h08` | 2 |
| `x-math-lines-angles-triangles-h09` | 2 |
| `x-math-lines-angles-triangles-h10` | 2 |
| `x-math-lines-angles-triangles-h11` | 2 |
| `x-math-lines-angles-triangles-h12` | 2 |
| `x-math-lines-angles-triangles-h13` | 2 |
| `x-math-lines-angles-triangles-h14` | 2 |
| `x-math-lines-angles-triangles-h15` | 2 |
| `x-math-nonlinear-equations-h01` | 2 |
| `x-math-nonlinear-equations-h02` | 2 |
| `x-math-nonlinear-equations-h03` | 2 |
| `x-math-nonlinear-equations-h04` | 2 |
| `x-math-nonlinear-equations-h05` | 3 |
| `x-math-nonlinear-equations-h06` | 2 |
| `x-math-nonlinear-equations-h07` | 2 |
| `x-math-nonlinear-equations-h08` | 2 |
| `x-math-nonlinear-equations-h09` | 2 |
| `x-math-nonlinear-equations-h10` | 2 |
| `x-math-nonlinear-equations-h11` | 2 |
| `x-math-nonlinear-equations-h12` | 2 |
| `x-math-nonlinear-equations-h13` | 2 |
| `x-math-nonlinear-equations-h14` | 2 |
| `x-math-nonlinear-equations-h15` | 2 |
| `x-math-nonlinear-functions-h01` | 2 |
| `x-math-nonlinear-functions-h02` | 2 |
| `x-math-nonlinear-functions-h03` | 1 |
| `x-math-nonlinear-functions-h04` | 2 |
| `x-math-nonlinear-functions-h05` | 1 |
| `x-math-nonlinear-functions-h06` | 2 |
| `x-math-nonlinear-functions-h07` | 2 |
| `x-math-nonlinear-functions-h08` | 2 |
| `x-math-nonlinear-functions-h09` | 2 |
| `x-math-nonlinear-functions-h10` | 2 |
| `x-math-nonlinear-functions-h11` | 2 |
| `x-math-nonlinear-functions-h12` | 1 |
| `x-math-nonlinear-functions-h13` | 2 |
| `x-math-nonlinear-functions-h14` | 2 |
| `x-math-nonlinear-functions-h15` | 2 |
| `x-math-one-variable-data-h01` | 2 |
| `x-math-one-variable-data-h02` | 2 |
| `x-math-one-variable-data-h03` | 1 |
| `x-math-one-variable-data-h04` | 2 |
| `x-math-one-variable-data-h05` | 2 |
| `x-math-one-variable-data-h06` | 2 |
| `x-math-one-variable-data-h07` | 2 |
| `x-math-one-variable-data-h08` | 1 |
| `x-math-one-variable-data-h09` | 1 |
| `x-math-one-variable-data-h10` | 1 |
| `x-math-one-variable-data-h11` | 2 |
| `x-math-one-variable-data-h12` | 2 |
| `x-math-one-variable-data-h13` | 1 |
| `x-math-one-variable-data-h14` | 2 |
| `x-math-one-variable-data-h15` | 2 |
| `x-math-percentages-h01` | 2 |
| `x-math-percentages-h02` | 2 |
| `x-math-percentages-h03` | 2 |
| `x-math-percentages-h04` | 2 |
| `x-math-percentages-h05` | 2 |
| `x-math-percentages-h06` | 2 |
| `x-math-percentages-h07` | 2 |
| `x-math-percentages-h08` | 1 |
| `x-math-percentages-h09` | 2 |
| `x-math-percentages-h10` | 2 |
| `x-math-percentages-h11` | 2 |
| `x-math-percentages-h12` | 2 |
| `x-math-percentages-h13` | 2 |
| `x-math-percentages-h14` | 1 |
| `x-math-percentages-h15` | 2 |
| `x-math-probability-h01` | 2 |
| `x-math-probability-h02` | 2 |
| `x-math-probability-h03` | 2 |
| `x-math-probability-h04` | 2 |
| `x-math-probability-h05` | 2 |
| `x-math-probability-h06` | 3 |
| `x-math-probability-h07` | 3 |
| `x-math-probability-h08` | 2 |
| `x-math-probability-h09` | 2 |
| `x-math-probability-h10` | 2 |
| `x-math-probability-h11` | 2 |
| `x-math-probability-h12` | 2 |
| `x-math-probability-h13` | 2 |
| `x-math-probability-h14` | 2 |
| `x-math-probability-h15` | 2 |
| `x-math-ratios-rates-h01` | 2 |
| `x-math-ratios-rates-h02` | 2 |
| `x-math-ratios-rates-h03` | 2 |
| `x-math-ratios-rates-h04` | 1 |
| `x-math-ratios-rates-h05` | 2 |
| `x-math-ratios-rates-h06` | 2 |
| `x-math-ratios-rates-h07` | 2 |
| `x-math-ratios-rates-h08` | 2 |
| `x-math-ratios-rates-h09` | 2 |
| `x-math-ratios-rates-h10` | 2 |
| `x-math-ratios-rates-h11` | 2 |
| `x-math-ratios-rates-h12` | 2 |
| `x-math-ratios-rates-h13` | 2 |
| `x-math-ratios-rates-h14` | 2 |
| `x-math-ratios-rates-h15` | 2 |
| `x-math-right-triangles-h01` | 2 |
| `x-math-right-triangles-h02` | 2 |
| `x-math-right-triangles-h03` | 2 |
| `x-math-right-triangles-h04` | 2 |
| `x-math-right-triangles-h05` | 2 |
| `x-math-right-triangles-h06` | 2 |
| `x-math-right-triangles-h07` | 2 |
| `x-math-right-triangles-h08` | 2 |
| `x-math-right-triangles-h09` | 1 |
| `x-math-right-triangles-h10` | 2 |
| `x-math-right-triangles-h11` | 2 |
| `x-math-right-triangles-h12` | 2 |
| `x-math-right-triangles-h13` | 3 |
| `x-math-right-triangles-h14` | 2 |
| `x-math-right-triangles-h15` | 2 |
| `x-math-sample-statistics-h01` | 2 |
| `x-math-sample-statistics-h02` | 1 |
| `x-math-sample-statistics-h03` | 2 |
| `x-math-sample-statistics-h04` | 2 |
| `x-math-sample-statistics-h05` | 1 |
| `x-math-sample-statistics-h06` | 2 |
| `x-math-sample-statistics-h07` | 1 |
| `x-math-sample-statistics-h08` | 2 |
| `x-math-sample-statistics-h09` | 2 |
| `x-math-sample-statistics-h10` | 2 |
| `x-math-sample-statistics-h11` | 1 |
| `x-math-sample-statistics-h12` | 2 |
| `x-math-sample-statistics-h13` | 1 |
| `x-math-sample-statistics-h14` | 1 |
| `x-math-sample-statistics-h15` | 2 |
| `x-math-statistical-claims-h01` | 2 |
| `x-math-statistical-claims-h02` | 2 |
| `x-math-statistical-claims-h03` | 2 |
| `x-math-statistical-claims-h04` | 2 |
| `x-math-statistical-claims-h05` | 2 |
| `x-math-statistical-claims-h06` | 2 |
| `x-math-statistical-claims-h07` | 2 |
| `x-math-statistical-claims-h08` | 2 |
| `x-math-statistical-claims-h09` | 2 |
| `x-math-statistical-claims-h10` | 2 |
| `x-math-statistical-claims-h11` | 2 |
| `x-math-statistical-claims-h12` | 2 |
| `x-math-statistical-claims-h13` | 2 |
| `x-math-statistical-claims-h14` | 2 |
| `x-math-statistical-claims-h15` | 2 |
| `x-math-systems-h01` | 2 |
| `x-math-systems-h02` | 2 |
| `x-math-systems-h03` | 2 |
| `x-math-systems-h04` | 2 |
| `x-math-systems-h05` | 2 |
| `x-math-systems-h06` | 2 |
| `x-math-systems-h07` | 2 |
| `x-math-systems-h08` | 2 |
| `x-math-systems-h09` | 2 |
| `x-math-systems-h10` | 2 |
| `x-math-systems-h11` | 2 |
| `x-math-systems-h12` | 3 |
| `x-math-systems-h13` | 2 |
| `x-math-systems-h14` | 2 |
| `x-math-systems-h15` | 2 |
| `x-math-two-variable-data-h01` | 1 |
| `x-math-two-variable-data-h02` | 2 |
| `x-math-two-variable-data-h03` | 1 |
| `x-math-two-variable-data-h04` | 2 |
| `x-math-two-variable-data-h05` | 2 |
| `x-math-two-variable-data-h06` | 2 |
| `x-math-two-variable-data-h07` | 1 |
| `x-math-two-variable-data-h08` | 2 |
| `x-math-two-variable-data-h09` | 2 |
| `x-math-two-variable-data-h10` | 1 |
| `x-math-two-variable-data-h11` | 2 |
| `x-math-two-variable-data-h12` | 2 |
| `x-math-two-variable-data-h13` | 1 |
| `x-math-two-variable-data-h14` | 2 |
| `x-math-two-variable-data-h15` | 1 |

## Первичные источники формата

- [SAT Reading and Writing, College Board](https://satsuite.collegeboard.org/sat/whats-on-the-test/reading-writing): диапазон 25–150 слов и домены чтения.
- [IELTS Academic Reading format](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-reading): три раздела, 40 вопросов, 60 минут и суммарный объём текста.
