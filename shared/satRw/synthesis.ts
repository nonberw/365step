import { EI, type Item, type Options } from "./build";
import { READING_ITEMS } from "./reading";
type Row = [family:string, goal:string, options:Options];
const rows: Row[] = [
["wick","explain how heat and liquid transport work together in a candle",[
["Heat melts the fuel, and capillary action in the wick carries that liquid toward the region where it can vaporize.","Предложение связывает оба процесса и их последовательность."],
["A candle contains a wick surrounded by fuel that initially takes a solid form.","Состав назван, но взаимодействие процессов не объяснено."],
["Water enters a towel in a familiar example of liquid absorption.","Аналогия не связывает тепло и доставку топлива."],
["A piece of string can be placed beside material used as candle fuel.","Расположение не объясняет поддержание горения."]]],
["hollow-flame","describe the evidence that a flame's interior is not uniform",[
["Ignitable vapor can be drawn from the dark center through a tube, revealing a region unlike the visibly burning exterior.","Называется опыт, результат и его значение."],
["A distant observer can see the outline of a burning candle.","Внешний вид не показывает внутреннее различие."],
["The lecturer uses a narrow tube during a demonstration involving a candle.","Без результата не раскрывается, какое свидетельство получено."],
["A continuous-looking outline may be described by more than one observer.","Согласие наблюдателей не является нужным экспериментальным свидетельством."]]],
["soot","explain why brightness alone is not proof of complete combustion",[
["Particles that contribute to a flame's light can be collected as soot before their combustion is complete.","Связаны источник яркости и незавершённость процесса."],
["A cold plate is a useful object to bring into a candle demonstration.","Инструмент назван без объяснения нужной связи."],
["A candle's luminous region is visibly brighter than its dark region.","Разница яркости не отвечает на вопрос полноты горения."],
["Soot is a dark deposit that can be inspected after the experiment.","Определение осадка не показывает, почему свет не доказывает полноту."]]],
["water-product","distinguish a reaction product from a substance stored in advance",[
["The collected water is formed during combustion rather than merely released as liquid previously stored in the candle.","Прямо противопоставлены образование продукта и высвобождение запаса."],
["Water can be collected while a candle burns during the demonstration.","Оба объяснения совместимы с самим фактом сбора."],
["A candle often feels dry before it is lit by the lecturer.","Сухость поверхности не формулирует различие механизмов."],
["The spectator watches a familiar object undergo a visible change.","Общее описание не различает происхождение воды."]]],
["air-supply","identify the relevant causal condition behind extinction in a closed vessel",[
["The closed vessel prevents replenishment of the air components that continued combustion requires.","Назван механизм прекращения, а не только внешнее условие."],
["The candle has a visible flame before it eventually goes out.","Ход наблюдения не объясняет причину."],
["A closed vessel has a boundary surrounding the candle.","Геометрическое описание не выделяет материальную причину."],
["Observers may use vessels of several shapes in demonstrations.","Разнообразие приборов не определяет условие горения."]]],
["breath","state both the usefulness and the limit of Faraday's analogy",[
["Respiration and candle combustion can be compared through chemical transformations without claiming that animals literally contain candle flames.","Сохранены предмет сравнения и граница переноса."],
["Faraday discusses both living animals and an ordinary household candle.","Темы перечислены, но значение и предел аналогии не раскрыты."],
["Animals and candles have obvious differences in their outward appearance.","Одна граница без химического основания не выполняет обе цели."],
["Carbon dioxide is mentioned in the discussion of material transformations.","Называние продукта не объясняет ограничение аналогии."]]],
["double-vision","connect an inward conflict to an external social condition",[
["A person's conflicted self-awareness can reflect the pressure of a society's devaluing judgments.","В одном утверждении связаны внутренний опыт и внешний источник."],
["A person may have more than one interest at the same time.","Нерелевантная множественность интересов не раскрывает механизм."],
["Du Bois describes a difficult experience of self-awareness.","Не названо социальное условие."],
["A society may form judgments about people living within it.","Не показано, как оценки связаны с внутренним конфликтом."]]],
["veil","emphasize why physical proximity does not ensure understanding",[
["People can encounter a group frequently while refusing to hear that group's accounts of its own experience.","Показана близость одновременно с интерпретационным барьером."],
["The metaphor of a veil appears in Du Bois's discussion.","Название образа не раскрывает различие видимости и понимания."],
["Groups can occupy neighboring places in a community.","Соседство само по себе не объясняет недостаток понимания."],
["Readers can find written descriptions of social experiences.","Возможность чтения не подчёркивает нужное ограничение."]]],
["sorrow-song","explain the songs' value without treating them as literal chronicles",[
["The songs preserve collective hopes and grief even when their lines do not correspond to individually documented events.","Выразительная ценность сохраняется без требования буквальной хроники."],
["Some songs contain words as well as melodies.","Признак не объясняет историческую ценность."],
["Du Bois discusses songs in a work that also considers history.","Соседство тем не синтезирует нужный аргумент."],
["An event chronicle can record when a particular occurrence happened.","О песнях и другом виде знания ничего не сказано."]]],
["education-horizon","acknowledge economic preparation while broadening the standard of educational value",[
["Education can prepare people for work while also developing judgment and participation in intellectual life.","Одна функция признана и дополнена другими."],
["Immediate earnings can be considered when evaluating occupational preparation.","Экономический критерий сохранён, но стандарт не расширен."],
["Intellectual traditions contain ideas that people may study in school.","Не признана задача подготовки к работе."],
["Schools may include courses of different lengths.","Длительность не относится к двум требуемым аспектам."]]],
["rural-school","identify a limitation of measuring progress by new buildings alone",[
["More buildings need not show whether different residents gained opportunities or continued to bear serious burdens.","Показан человеческий аспект, который счёт построек пропускает."],
["Buildings can be counted at two different points in time.","Это описывает метод, не ограничивает его."],
["The narrator returns to a community where he once taught.","Факт возвращения не формулирует слабость показателя."],
["A rural community can change its visible appearance.","Видимые перемены не равны обсуждению их неполноты."]]],
["book-learning","explain an unintended effect of attempts to prevent literacy",[
["The reasons given for stopping Douglass's instruction help him recognize why literacy matters to the maintenance of power.","Запрет непреднамеренно раскрывает значимость навыка."],
["Douglass is initially denied continued access to reading instruction.","Ограничение названо, но неожиданный эффект отсутствует."],
["Reading involves learning to interpret written words.","Определение не связано с последствиями запрета."],
["People can express opposition to another person's education.","Общая возможность не показывает открытия ученика."]]],
["songs-misread","contrast outsiders' interpretation of singing with the alternative meaning",[
["Outsiders hear proof of contentment in singing that can instead express the singers' suffering.","Два противоположных истолкования соединены в одной фразе."],
["Several people may hear the same song being performed.","Множественность слушателей не раскрывает разницу смыслов."],
["Douglass describes songs in his narrative.","Не названа ни одна из сравниваемых трактовок."],
["The songs are audible to people outside the group of performers.","Доступность звука не показывает ошибку его толкования."]]],
["education-reason","expose a circular justification for restrictive education",[
["A system can cultivate dependence and then cite the resulting dependence as proof that its restrictions are necessary.","Система обосновывает себя собственным результатом."],
["Education can be organized in different ways for different groups.","Различия не равны круговой аргументации."],
["Some defenders of a system make claims about natural ability.","Без роли воспитания логический круг не показан."],
["A learner can develop judgment through practice.","Это альтернативный тезис, а не синтез ошибочного оправдания."]]],
["virtue-standard","show why identical compliance can arise from different moral circumstances",[
["The same cooperative act may result from reasoned acceptance or from an inability to refuse, so its outward form does not settle its moral basis.","Сопоставлены разные основания одинакового действия."],
["Cooperative behavior can be observed by another person.","Наблюдаемость не различает основания."],
["Reason is important in Wollstonecraft's account of virtue.","Не показана неоднозначность внешне одинакового подчинения."],
["A request can be made before someone responds to it.","Хронология не определяет моральное обстоятельство."]]],
["exercise-mind","explain why present weakness need not establish fixed incapacity",[
["A capacity deprived of exercise may remain weak because of its conditions, leaving its potential under different conditions unresolved.","Текущее состояние не отделено от влияния отсутствия практики."],
["A body can become stronger through activity.","Одна телесная аналогия не раскрывает вывод о способности суждения."],
["People sometimes describe a capacity as weak.","Исходная оценка не объясняет её ограниченность."],
["Intellectual and bodily development are not physically identical processes.","Граница аналогии не отвечает на вопрос потенциала."]]],
["pier-glass","explain how the mirror image illustrates a mistaken self-centered interpretation",[
["Just as light makes independently placed scratches seem centered on its reflection, a private viewpoint can make unrelated events seem organized around oneself.","Сходство структуры перенесено с оптического образа на социальное суждение."],
["A polished surface can contain fine scratches.","Деталь образа не раскрывает его интерпретационного применения."],
["A candle can be placed close to a reflective surface.","Расположение прибора не объясняет ошибку личного центра."],
["People often have concerns about events in their communities.","Не показано, как перспектива искажает организацию событий."]]],
["key-mythologies","contrast scholarly ambition with methodological adequacy",[
["A project may promise to organize a vast subject while failing to test its assumptions against relevant scholarship.","Масштаб обещания сопоставлен с недостатком метода."],
["Casaubon plans a work concerned with mythology.","Тема названа, но различие критериев не выражено."],
["New scholarship can appear while an older project is being developed.","Само сосуществование не показывает реакции проекта на знания."],
["An author can choose a comprehensive title for a work.","Заголовок не противопоставлен методологической проверке."]]],
["lydgate-network","show that scientific purpose operates through social conditions",[
["Lydgate's scientific aims depend partly on local cooperation and institutions that influence what he can put into practice.","Соединены интеллектуальная цель и условия реализации."],
["Lydgate is a physician with an interest in scientific inquiry.","Социальное посредничество отсутствует."],
["Local communities contain institutions and relationships.","Не показана связь с профессиональной целью."],
["Medical knowledge can include many specialized terms.","Словарь не объясняет развитие карьеры."]]],
["dorothea-cottages","recognize a generous motive without treating it as sufficient for practical success",[
["Dorothea's concern for residents gives her plan a worthy aim, but its success still depends on informed attention to their conditions.","Признание мотива сочетается с требованием практического знания."],
["Dorothea is interested in making changes to cottages.","Недостаточно для оценки мотива и его пределов."],
["A dwelling can be assessed by its visual appearance.","Требуется практическое благополучие, а не один внешний вид."],
["Plans may be discussed before any construction begins.","Хронология не показывает отношения мотива и успеха."]]],
["variation-use","distinguish generating a trait from making it more common",[
["A breeder can spread an unexpectedly appearing trait by selecting its carriers without having caused the trait to originate.","Различены первоначальное появление и дальнейшее распространение."],
["Breeders can choose which organisms reproduce.","Выбор назван, но происхождение варианта не сопоставлено."],
["Organisms in a population may differ in several characteristics.","Наличие вариаций не раскрывает два причинных процесса."],
["A useful trait can attract a breeder's attention.","Внимание не равно ни возникновению, ни распространению."]]],
["struggle-broad","illustrate Darwin's use of struggle beyond direct combat",[
["A plant's dependence on scarce moisture is part of the struggle for existence even when no visible fight takes place.","Нефизическая зависимость служит конкретным примером."],
["Two animals can engage in a direct physical fight.","Это узкий буквальный случай, а цель — выйти за его пределы."],
["Darwin uses the phrase struggle for existence in his argument.","Термин назван без требуемого примера."],
["A plant can have roots, stems, and leaves.","Морфологический перечень не иллюстрирует зависимость выживания."]]],
["geological-record","qualify a conclusion drawn from a missing fossil",[
["The absence of an intermediate may reflect an incomplete record, so its meaning depends partly on preservation and collection opportunities.","Сила отрицательного свидетельства ограничена состоянием записи."],
["A collector has not found the proposed intermediate.","Исходный факт повторён без оговорки."],
["Fossils can be stored in collections after discovery.","Музейное хранение не объясняет пробел в записи."],
["A proposed organism might have lived in an earlier period.","Возможность существования не оценивает отсутствие находки."]]],
["classification-affinity","explain why a conspicuous resemblance may be a poor guide to ancestry",[
["Similar demands can produce similar structures in distinct lineages, so visual resemblance alone may not distinguish shared descent from independent adaptation.","Указана альтернативная причина сходства и её следствие для вывода."],
["A conspicuous structure is easy for an observer to notice.","Заметность не объясняет ненадёжность генеалогического вывода."],
["Organisms may be grouped in a classification.","Общее описание не отвечает на причинный вопрос."],
["Some characters have functions that an observer does not immediately understand.","Это не объясняет ограниченность именно заметного сходства."]]],
["island-dispersal","distinguish habitat suitability from historical access",[
["A species may be able to survive on an island yet remain absent because the ocean prevented it from arriving.","Сохранена пригодность среды при барьере расселения."],
["Islands can differ in their average temperature.","Климатические различия не показывают разницу двух условий."],
["The sea lies between an island and some other habitats.","Географическое положение без последствия для прибытия недостаточно."],
["A species is absent from an island studied by an observer.","Отсутствие повторено без различения возможных причин."]]],
["price-value","contrast practical usefulness with exchange value",[
["Something essential to life may command little in exchange, while a less practically useful object commands much more.","Два критерия сопоставлены через расходящийся порядок."],
["Objects can be exchanged by people who value them.","Два значения ценности не различены."],
["Smith discusses value when considering economic activity.","Название темы не синтезирует контраст."],
["Useful objects can matter in ordinary life.","Отсутствует сравнение с обменной ценностью."]]],
["unintended-tools","explain how specialization can create opportunities for unplanned invention",[
["Repeated work on one operation can reveal a shortcut that the person who divided the tasks never anticipated.","Устойчивое внимание связано с конкретным непредвиденным улучшением."],
["An organizer can divide production into separate operations.","Условия названы, но изобретение не показано."],
["A machine can be used in more than one workplace.","Не раскрывает происхождение нового приёма."],
["Workers and organizers can have different job titles.","Должности не объясняют механизм открытия."]]],
["invisible-cooperation","reveal complexity concealed by an ordinary finished object's appearance",[
["An everyday article may embody many occupations and exchanges despite appearing simple to its final user.","Прямо связаны видимая простота и скрытая сложность."],
["A user can hold or inspect a finished article.","Осмотр не сообщает об участниках производства."],
["Some occupations have names familiar to buyers.","Знакомство с названиями не раскрывает цепь кооперации."],
["An article can reach a final user after production.","Хронология не показывает сложность сотрудничества."]]],
["habit-reasons","state why refuting a weak substitute does not show understanding of a dispute",[
["A convenient objection may omit the reasons informed opponents actually give, leaving the real disagreement unanswered.","Недостаток подмены связан с потерей реального основания позиции."],
["A reader can memorize arguments for a preferred conclusion.","Память не объясняет несостоятельность подмены."],
["People on different sides of a dispute can write about it.","Наличие авторов не показывает качество рассматриваемого возражения."],
["Some arguments are easier to repeat than others.","Беглость речи не является нужным критерием понимания."]]],
["choice-faculties","emphasize a benefit of choice that does not depend on an unusual outcome",[
["Examining alternatives can develop judgment even when the chosen practice is the same one custom recommends.","Ценность процесса сохраняется при обычном результате."],
["A person can adopt a practice no one else follows.","Необычный итог не выполняет поставленную цель."],
["Customary behavior is visible to other members of a community.","Наблюдаемость не указывает на развитие суждения."],
["Two people may perform identical outward actions.","Без различия процесса само совпадение недостаточно."]]],
["despot-custom","present historical experience as evidence without making it final authority",[
["A long-standing practice merits examination of its past results while remaining open to evidence for improvement.","История учитывается и не закрывает пересмотр."],
["A practice has existed for many generations.","Длительность не формулирует способ её критического использования."],
["People can disagree about whether a practice is traditional.","Спор о ярлыке не раскрывает отношение опыта и авторитета."],
["An alternative practice has a different name.","Название не является свидетельством улучшения."]]],
["cost-life","extend the assessment of ownership beyond purchase price",[
["The cost of a possession includes the work, maintenance, and continuing commitments it demands from its owner's life.","Оценка охватывает время и труд помимо суммы покупки."],
["A buyer pays a stated amount when acquiring an object.","Повторяется только исходная денежная мера."],
["A receipt can display a price using written numerals.","Формат записи не расширяет понятие стоимости."],
["Possessions may differ in appearance and size.","Не названы дополнительные жизненные затраты."]]],
["ice-observation","contrast repeated belief with a testable inquiry",[
["Instead of relying on a widely repeated account of Walden's depth, Thoreau makes a sounding directed at the claim.","Показаны разные основания суждения: повторение и измерение."],
["Several people tell a story about a local pond.","Второй вид основания отсутствует."],
["Walden is a pond discussed in Thoreau's writing.","Библиографический факт не раскрывает методологический контраст."],
["A pond's surface can be observed in winter.","Видимость поверхности не равна проверке глубины."]]],
["transparent-observer","attribute a new experience of a familiar scene to changed attention",[
["When private preoccupations recede, the unchanged woods can acquire a significance the observer did not previously perceive.","Источник новизны помещён в восприятие при сохранении среды."],
["The observer visits a wooded setting.","Сам факт посещения не объясняет новизну опыта."],
["A landscape may contain familiar physical features.","Не показано изменение внимания."],
["People sometimes experience social concerns.","Не связаны опасения, их ослабление и восприятие места."]]],
["commodity-beauty","show two forms of value attached to the same natural object",[
["A tree can provide useful material and also be valued through an aesthetic encounter with its appearance.","Один объект участвует в практическом и эстетическом отношении."],
["Two distant forests can contain different kinds of trees.","Разные объекты и виды не выполняют цель одного объекта."],
["Nature is the title of a work by Emerson.","Заглавие не раскрывает виды ценности."],
["A tree can supply material for practical use.","Указан лишь один из требуемых аспектов."]]],
["elizabeth-letter","emphasize reassessment of existing evidence rather than simple acceptance of a new speaker",[
["Darcy's letter prompts Elizabeth to revisit earlier details and recognize how her preference for Wickham shaped their interpretation.","Центр на переоценке сведений и собственной установке."],
["Elizabeth reads a letter written by Darcy.","Факт чтения не показывает переоценку."],
["Wickham and Darcy give different accounts.","Различие версий не определяет процесс её суждения."],
["A written account can include statements about previous events.","Общая характеристика письма не связана с нужной переменой."]]],
["free-indirect","explain how social judgments can reveal the people making them",[
["Confident claims about a newcomer's motives may expose a community's expectations about marriage and status rather than establish those motives neutrally.","Суждение интерпретируется как свидетельство об интересах судящих."],
["A newcomer arrives in a community described by a novelist.","Сюжетный факт не объясняет интерпретационное значение."],
["Community members discuss other people's intentions.","Наличие обсуждения не раскрывает его пристрастность."],
["A novel can include statements expressed with confidence.","Уверенность без роли ожиданий не выполняет цель."]]],
["creature-judgment","distinguish linguistic competence from receiving social recognition",[
["The creature learns to understand the family's language, but prejudice can still prevent others from giving him a fair hearing.","Успех обучения сопоставлен с сохраняющимся социальным барьером."],
["The creature observes a family while remaining unseen.","Условия наблюдения не показывают различие компетенции и признания."],
["The family uses words while carrying out daily activities.","Не описан результат для ученика и реакции на него."],
["Language can be learned through repeated attention.","Один навык не раскрывает остаточный барьер."]]],
["unrecorded-kindness","separate meaningful consequences from public fame",[
["A person's small, uncelebrated acts may change others' opportunities even when the person's life never becomes a famous public story.","Последствия сохранены при отсутствии известности."],
["A public record can name widely celebrated people.","Это не показывает последствия без признания."],
["The novel ends with a discussion of Dorothea's life.","Композиционный факт не синтезирует нужный тезис."],
["Some people become known for a single conspicuous achievement.","Публичный успех не раскрывает иной вид влияния."]]],
["bread-gift","show that initiative can operate through limited assistance",[
["By seeking informal reading help during errands, Douglass turns small opportunities for cooperation into part of his own learning strategy.","Самостоятельность показана через активный поиск помощи."],
["Douglass encounters boys while carrying out errands.","Сама встреча не раскрывает инициативу в обучении."],
["Bread can be offered to another person.","Обмен не связан с целью учиться."],
["Formal instruction can be restricted by people in authority.","Ограничение не объясняет использование локальной поддержки."]]],
];

export const SYNTHESIS_ITEMS: Item[] = rows.map(([family,goal,options]) => {
  const base = READING_ITEMS.find(q=>q.family===family)!;
  // All notes are authored summaries. Keep complete sentences rather than
  // extracting clauses that could omit the qualification needed for an answer.
  const notes = base.passage.match(/[^.!?]+[.!?](?:\s|$)/g)!.map(s=>`• ${s.trim()}`).join("\n");
  return {id:`notes-${family}`,family,source:base.source,locator:base.locator,
    passage:`While researching a topic, a student has taken the following notes:\n${notes}`,
    stem:`The student wants to ${goal}. Which choice most effectively uses relevant information from the notes to accomplish this goal?`,
    domain:EI,skill:"Rhetorical Synthesis",difficulty:["education-reason","pier-glass","habit-reasons","classification-affinity","geological-record","elizabeth-letter","sorrow-song","key-mythologies","unrecorded-kindness","exercise-mind"].includes(family)?3:2,options};
});
