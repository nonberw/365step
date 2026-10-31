import type { Difficulty, SatDomain, SatQuestion } from "./types";
import { BANK365 } from "./bank365";

// Original practice items written for 365step, in the Digital SAT format.
// None of them are copied from College Board or third-party question banks.
// Math items come from seeded generators, so the bank is large and repeatable;
// Claude "Remix" adds more on demand.

// ---------- deterministic randomness ----------

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)]!;

/** Puts the right answer among distractors at a random position; returns choices + answer index. */
function mc(r: () => number, right: string, wrong: string[]): { choices: string[]; answer: number } {
  const unique = [...new Set(wrong.filter((w) => w !== right))].slice(0, 3);
  let k = 1;
  while (unique.length < 3) unique.push(`${right}${"′".repeat(k++)}`);
  const pos = int(r, 0, 3);
  const choices = [...unique];
  choices.splice(pos, 0, right);
  return { choices, answer: pos };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// ---------- Reading & Writing: hand-written ----------

type RW = Omit<SatQuestion, "section" | "source">;

const RW_ITEMS: RW[] = [
  // Information and Ideas
  {
    id: "rw-ii-01",
    domain: "Information and Ideas",
    skill: "Central Ideas and Details",
    difficulty: 1,
    passage:
      "In 2023 a group of students in Almaty began recording the number of birds that visited a small park near their school every morning. Over six months they noticed that the number of sparrows rose whenever the city gardeners left fallen leaves on the ground instead of removing them. The leaves, it turned out, sheltered insects that the sparrows fed on.",
    stem: "Which choice best states the main idea of the text?",
    choices: [
      "Leaving fallen leaves in the park appears to have supported the sparrow population by providing food.",
      "City gardeners in Almaty prefer to remove leaves from parks every autumn.",
      "Students can count birds more accurately in the morning than in the evening.",
      "Sparrows are the most common bird species in Almaty's parks.",
    ],
    answer: 0,
    explanation:
      "Текст связывает две вещи: листья оставили на земле — воробьёв стало больше, потому что в листьях жили насекомые. Ответ A передаёт именно эту причинно-следственную связь. B и C не следуют из текста, D — слишком широкое утверждение.",
  },
  {
    id: "rw-ii-02",
    domain: "Information and Ideas",
    skill: "Command of Evidence (Textual)",
    difficulty: 2,
    passage:
      "Engineer Aliya Nurlanovna claims that rooftop gardens can lower the temperature inside school buildings during summer. To test the claim, her team compared two identical classrooms on the top floor of a school, one beneath a planted roof and one beneath a bare concrete roof.",
    stem: "Which finding, if true, would most directly support Nurlanovna's claim?",
    choices: [
      "The classroom beneath the planted roof had more students enrolled than the other classroom.",
      "On hot afternoons, the classroom beneath the planted roof was on average 3 °C cooler than the other classroom.",
      "The plants on the roof required watering twice a week during summer.",
      "Both classrooms were equally warm during the winter months.",
    ],
    answer: 1,
    explanation:
      "Утверждение — про температуру летом. Прямо его подтверждает только B: под садом на крыше в жару было прохладнее. A и C не про температуру, D — про зиму.",
  },
  {
    id: "rw-ii-03",
    domain: "Information and Ideas",
    skill: "Command of Evidence (Quantitative)",
    difficulty: 2,
    passage:
      "A researcher surveyed 200 students about how they prepared for a mathematics olympiad. Of the students who practised with past problems for at least 30 minutes a day, 64% reached the final round. Of the students who practised less than 30 minutes a day, 21% reached the final round.",
    stem: "Which choice most effectively uses the data to complete the researcher's conclusion? The data suggest that ______",
    choices: [
      "most students who took part in the survey reached the final round.",
      "daily practice of at least 30 minutes was associated with a higher rate of reaching the final round.",
      "students who practised less than 30 minutes a day did not enjoy mathematics.",
      "the olympiad's final round was easier than its first round.",
    ],
    answer: 1,
    explanation:
      "Данные сравнивают две группы: 64% против 21%. Корректный вывод — о связи практики с результатом (B). A неверно (мы не знаем общий процент), C и D не следуют из чисел.",
  },
  {
    id: "rw-ii-04",
    domain: "Information and Ideas",
    skill: "Inferences",
    difficulty: 3,
    passage:
      "Early maps of the Silk Road often exaggerated the size of trading cities. Historians once assumed this was simple error, but recent studies of merchants' letters show that the mapmakers relied heavily on the descriptions of traders, who had reasons to make their destinations sound important to future partners. Thus, the exaggerated maps ______",
    stem: "Which choice most logically completes the text?",
    choices: [
      "may reflect the commercial interests of the traders whose accounts the mapmakers used.",
      "prove that the trading cities were actually larger than modern estimates suggest.",
      "were drawn by mapmakers who had personally visited every city.",
      "show that historians have always understood the purpose of early maps.",
    ],
    answer: 0,
    explanation:
      "Логика: картографы опирались на рассказы торговцев, а торговцам было выгодно преувеличивать. Значит, преувеличения отражают интересы торговцев (A). B противоречит идее преувеличения, C — тексту, D — слову «once assumed».",
  },
  {
    id: "rw-ii-05",
    domain: "Information and Ideas",
    skill: "Central Ideas and Details",
    difficulty: 2,
    passage:
      "The following text is adapted from a 2024 school newspaper article. When the robotics club received a donation of old laptops, the members did not simply throw away the ones that would not start. Instead, they took the broken machines apart, sorted the screws, fans and batteries into labelled boxes, and used the parts to repair four of the laptops. The rest of the parts became materials for their next robot.",
    stem: "According to the text, what did the robotics club do with the laptops that would not start?",
    choices: [
      "They returned them to the person who donated them.",
      "They sold them to buy new robot parts.",
      "They disassembled them and reused the parts.",
      "They displayed them as examples of old technology.",
    ],
    answer: 2,
    explanation: "Текст прямо говорит: разобрали, рассортировали детали и использовали их для ремонта и для робота — ответ C.",
  },
  {
    id: "rw-ii-06",
    domain: "Information and Ideas",
    skill: "Inferences",
    difficulty: 1,
    passage:
      "Snow leopards live high in the mountains of Central Asia, including the Tien Shan near Almaty. Because they are rarely seen, scientists place motion-activated cameras along mountain paths. The cameras take a photo only when something moves in front of them.",
    stem: "Based on the text, why do scientists most likely use motion-activated cameras?",
    choices: [
      "Because snow leopards are attracted to the sound of cameras.",
      "Because the animals are difficult to observe directly.",
      "Because cameras are cheaper than mountain trips.",
      "Because snow leopards only move at night.",
    ],
    answer: 1,
    explanation: "Ключевая фраза — «rarely seen»: животных трудно увидеть лично, поэтому нужны камеры (B). Остальное в тексте не сказано.",
  },
  {
    id: "rw-ii-07",
    domain: "Information and Ideas",
    skill: "Command of Evidence (Quantitative)",
    difficulty: 3,
    passage:
      "A city tracked the share of commuters using public transport. In 2019 the share was 38%. After new bus lanes opened in 2021, the share rose to 44% in 2022, while the total number of commuters stayed nearly the same. A council member argued that the bus lanes increased the number of people taking public transport.",
    stem: "Which additional finding would most weaken the council member's argument?",
    choices: [
      "Ticket prices for public transport were cut by half in early 2022.",
      "The new bus lanes were painted red to make them visible.",
      "Most commuters in 2022 lived more than 5 km from their workplace.",
      "Several other cities also opened bus lanes in 2021.",
    ],
    answer: 0,
    explanation:
      "Чтобы ослабить вывод «рост из-за выделенных полос», нужна другая причина роста в то же время. Снижение цены билетов вдвое в 2022 году — именно такая альтернатива (A).",
  },
  // Craft and Structure
  {
    id: "rw-cs-01",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: 1,
    passage:
      "Although the young chess player had lost her first two games, she remained ______, studying her mistakes each evening and returning to the board the next morning with new ideas.",
    stem: "Which choice completes the text with the most logical and precise word or phrase?",
    choices: ["indifferent", "determined", "reluctant", "confused"],
    answer: 1,
    explanation: "Она проиграла, но разбирала ошибки и возвращалась с новыми идеями — это упорство, «determined» (B).",
  },
  {
    id: "rw-cs-02",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: 2,
    passage:
      "The new museum in Astana was designed to be ______: its galleries can be rearranged in a single afternoon, allowing the curators to host exhibitions of very different sizes.",
    stem: "Which choice completes the text with the most logical and precise word or phrase?",
    choices: ["fragile", "adaptable", "ornamental", "permanent"],
    answer: 1,
    explanation: "Залы можно быстро перестроить под выставки разного размера — значит, музей гибкий, «adaptable» (B). «Permanent» — противоположность.",
  },
  {
    id: "rw-cs-03",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: 3,
    passage:
      "Critics had expected the composer's final symphony to be grand and dramatic, yet the work is strikingly ______, built from a few quiet themes that return again and again with only slight changes.",
    stem: "Which choice completes the text with the most logical and precise word or phrase?",
    choices: ["restrained", "chaotic", "triumphant", "derivative"],
    answer: 0,
    explanation: "Контраст с «grand and dramatic» и описание «quiet themes» указывают на сдержанность — «restrained» (A).",
  },
  {
    id: "rw-cs-04",
    domain: "Craft and Structure",
    skill: "Text Structure and Purpose",
    difficulty: 2,
    passage:
      "Many people believe that deserts are empty places. The Altyn-Emel National Park in Kazakhstan suggests otherwise. Its sand dunes are home to beetles, lizards and small mammals that hide during the heat of the day and become active at night. Even the famous 'singing dune' supports a hidden community of plants whose roots hold the sand in place.",
    stem: "Which choice best describes the overall structure of the text?",
    choices: [
      "It describes a common belief and then presents an example that challenges it.",
      "It explains how sand dunes form and then predicts how they will change.",
      "It compares two national parks and recommends one of them.",
      "It tells the history of a park and then describes its founders.",
    ],
    answer: 0,
    explanation: "Сначала распространённое мнение («пустыни пусты»), затем пример, который его опровергает. Это A.",
  },
  {
    id: "rw-cs-05",
    domain: "Craft and Structure",
    skill: "Text Structure and Purpose",
    difficulty: 3,
    passage:
      "In her essay, the scientist admits that her first experiment failed completely. She then describes, step by step, the small changes she made in each later attempt, before revealing that the final version produced a result no one had predicted.",
    stem: "What is the main purpose of describing the failed first experiment?",
    choices: [
      "To argue that the scientist's final result is unreliable.",
      "To establish a starting point that shows how much the research developed.",
      "To criticise other scientists who repeated the experiment.",
      "To explain why the scientist stopped doing experiments.",
    ],
    answer: 1,
    explanation: "Неудача — точка отсчёта, от которой видно развитие исследования до неожиданного результата (B).",
  },
  {
    id: "rw-cs-06",
    domain: "Craft and Structure",
    skill: "Cross-Text Connections",
    difficulty: 3,
    passage:
      "Text 1: Some educators argue that students should use calculators only after they have mastered mental arithmetic, because early reliance on devices weakens number sense.\nText 2: A 2022 study found that students who used calculators to explore patterns in large numbers developed stronger intuition about place value than students who did not.",
    stem: "Based on the texts, how would the authors of the study in Text 2 most likely respond to the educators in Text 1?",
    choices: [
      "By agreeing that calculators should never be used in schools.",
      "By noting that calculators, used in certain ways, may strengthen rather than weaken number sense.",
      "By arguing that mental arithmetic is more important than place value.",
      "By claiming that their study did not involve calculators.",
    ],
    answer: 1,
    explanation: "Text 2 показывает, что калькулятор может укреплять понимание чисел — это прямо возражает Text 1 (B).",
  },
  {
    id: "rw-cs-07",
    domain: "Craft and Structure",
    skill: "Words in Context",
    difficulty: 2,
    passage:
      "The team's first prototype was ______: it worked for only a few seconds before the battery overheated, so the engineers spent the next week redesigning the power system.",
    stem: "Which choice completes the text with the most logical and precise word or phrase?",
    choices: ["flawless", "flawed", "expensive", "familiar"],
    answer: 1,
    explanation: "Прототип работал несколько секунд и перегревался — у него были недостатки, «flawed» (B).",
  },
  // Expression of Ideas
  {
    id: "rw-ei-01",
    domain: "Expression of Ideas",
    skill: "Transitions",
    difficulty: 1,
    passage:
      "The school library extended its opening hours until 8 p.m. ______, more students began using it to prepare for exams in the evening.",
    stem: "Which choice completes the text with the most logical transition?",
    choices: ["However", "As a result", "For example", "In contrast"],
    answer: 1,
    explanation: "Продление часов работы — причина, больше учеников вечером — следствие. Нужен «As a result» (B).",
  },
  {
    id: "rw-ei-02",
    domain: "Expression of Ideas",
    skill: "Transitions",
    difficulty: 2,
    passage:
      "Electric buses produce no exhaust in the city. ______, the electricity that charges them may still come from power plants that burn coal.",
    stem: "Which choice completes the text with the most logical transition?",
    choices: ["Similarly", "Therefore", "Nevertheless", "Specifically"],
    answer: 2,
    explanation: "Вторая мысль ограничивает первую (плюс автобусов, но есть оговорка) — нужен контраст «Nevertheless» (C).",
  },
  {
    id: "rw-ei-03",
    domain: "Expression of Ideas",
    skill: "Rhetorical Synthesis",
    difficulty: 2,
    passage:
      "While researching a topic, a student has taken the following notes:\n• The Charyn Canyon is located about 200 km east of Almaty.\n• It is roughly 154 km long.\n• Its rock formations are estimated to be about 12 million years old.\n• Visitors often compare it to the Grand Canyon in the United States.",
    stem: "The student wants to emphasise the age of the canyon's rock formations. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
    choices: [
      "The Charyn Canyon, located about 200 km east of Almaty, is roughly 154 km long.",
      "Visitors often compare the Charyn Canyon to the Grand Canyon in the United States.",
      "The rock formations of the Charyn Canyon are estimated to be about 12 million years old.",
      "The Charyn Canyon is a popular destination for visitors from Almaty.",
    ],
    answer: 2,
    explanation: "Цель — подчеркнуть возраст пород. Это делает только C. D к тому же не опирается на заметки.",
  },
  {
    id: "rw-ei-04",
    domain: "Expression of Ideas",
    skill: "Rhetorical Synthesis",
    difficulty: 3,
    passage:
      "While researching a topic, a student has taken the following notes:\n• Abai Kunanbayev was a 19th-century Kazakh poet and thinker.\n• He translated works by Pushkin and Lermontov into Kazakh.\n• His 'Book of Words' contains 45 short philosophical texts.\n• He encouraged Kazakh youth to study science and languages.",
    stem: "The student wants to explain Abai's role in connecting Kazakh culture with other literary traditions. Which choice most effectively uses relevant information from the notes?",
    choices: [
      "Abai Kunanbayev wrote the 'Book of Words', which contains 45 short philosophical texts.",
      "By translating Pushkin and Lermontov into Kazakh, Abai Kunanbayev brought Russian literature to Kazakh readers.",
      "Abai Kunanbayev was a 19th-century poet who lived in Kazakhstan.",
      "Abai Kunanbayev encouraged young people to study.",
    ],
    answer: 1,
    explanation: "Связь с другими литературными традициями — это переводы Пушкина и Лермонтова (B).",
  },
  {
    id: "rw-ei-05",
    domain: "Expression of Ideas",
    skill: "Transitions",
    difficulty: 3,
    passage:
      "Early versions of the language-learning app gave every user the same lessons. The newest version, ______, adjusts the difficulty of each exercise based on the user's previous answers.",
    stem: "Which choice completes the text with the most logical transition?",
    choices: ["by contrast", "for instance", "in addition", "likewise"],
    answer: 0,
    explanation: "Новая версия противопоставляется старой (одинаковые уроки → адаптивные) — «by contrast» (A).",
  },
  {
    id: "rw-ei-06",
    domain: "Expression of Ideas",
    skill: "Transitions",
    difficulty: 1,
    passage:
      "To prepare for the science fair, Daniyar first chose a question to investigate. ______, he designed an experiment to test his hypothesis.",
    stem: "Which choice completes the text with the most logical transition?",
    choices: ["Next", "Instead", "Otherwise", "Despite this"],
    answer: 0,
    explanation: "Описывается последовательность шагов: сначала вопрос, затем эксперимент — «Next» (A).",
  },
  {
    id: "rw-ei-07",
    domain: "Expression of Ideas",
    skill: "Rhetorical Synthesis",
    difficulty: 2,
    passage:
      "While researching a topic, a student has taken the following notes:\n• Solar panels convert sunlight into electricity.\n• Kazakhstan's southern regions receive about 2,500–3,000 hours of sunshine per year.\n• Several solar power stations have opened near Shymkent since 2019.",
    stem: "The student wants to explain why southern Kazakhstan is well suited to solar power. Which choice most effectively uses relevant information from the notes?",
    choices: [
      "Solar panels convert sunlight into electricity.",
      "With about 2,500–3,000 hours of sunshine per year, southern Kazakhstan gets plenty of the sunlight solar panels need.",
      "Several solar power stations have opened near Shymkent.",
      "Solar power stations have opened since 2019.",
    ],
    answer: 1,
    explanation: "Объяснить «почему подходит» помогает количество солнечных часов (B). Остальные варианты не дают причины.",
  },
  // Standard English Conventions
  {
    id: "rw-sec-01",
    domain: "Standard English Conventions",
    skill: "Boundaries",
    difficulty: 1,
    passage: "The students finished building the weather station on Friday ______ on Monday they began collecting their first measurements.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: ["Friday,", "Friday;", "Friday", "Friday, and,"],
    answer: 1,
    explanation: "Два независимых предложения нельзя соединить запятой (comma splice). Точка с запятой корректно их разделяет (B).",
  },
  {
    id: "rw-sec-02",
    domain: "Standard English Conventions",
    skill: "Form, Structure, and Sense",
    difficulty: 1,
    passage: "Each of the robots built by the club ______ a different sensor to detect obstacles.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: ["use", "uses", "are using", "have used"],
    answer: 1,
    explanation: "Подлежащее — «Each» (единственное число), поэтому глагол «uses» (B).",
  },
  {
    id: "rw-sec-03",
    domain: "Standard English Conventions",
    skill: "Boundaries",
    difficulty: 2,
    passage: "The expedition carried three essential items ______ a satellite phone, a water filter, and a first-aid kit.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: ["items,", "items:", "items;", "items and"],
    answer: 1,
    explanation: "Двоеточие вводит список после законченного предложения (B).",
  },
  {
    id: "rw-sec-04",
    domain: "Standard English Conventions",
    skill: "Form, Structure, and Sense",
    difficulty: 2,
    passage: "Walking through the old city at sunset, ______",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: [
      "the minarets glowed orange against the sky, the tourists noticed.",
      "the tourists noticed the minarets glowing orange against the sky.",
      "orange was the colour of the minarets for the tourists.",
      "the sky made the minarets glow orange for the tourists.",
    ],
    answer: 1,
    explanation: "Оборот «Walking through…» должен относиться к тем, кто шёл, — к туристам. Иначе получается «висящий модификатор» (B).",
  },
  {
    id: "rw-sec-05",
    domain: "Standard English Conventions",
    skill: "Boundaries",
    difficulty: 3,
    passage: "The physicist Lise Meitner ______ helped explain nuclear fission in 1938, was later honoured when element 109 was named meitnerium.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: ["Meitner who", "Meitner, who", "Meitner; who", "Meitner. Who"],
    answer: 1,
    explanation: "Придаточное «who helped…» — не ограничительное, его выделяют запятыми с двух сторон; вторая запятая уже стоит после 1938 (B).",
  },
  {
    id: "rw-sec-06",
    domain: "Standard English Conventions",
    skill: "Form, Structure, and Sense",
    difficulty: 3,
    passage: "Neither the coach nor the players ______ expected the final match to end in a draw.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: ["has", "have", "was", "is"],
    answer: 1,
    explanation: "В конструкции «neither…nor» глагол согласуется с ближайшим подлежащим — «players» (мн. ч.), значит «have» (B).",
  },
  {
    id: "rw-sec-07",
    domain: "Standard English Conventions",
    skill: "Form, Structure, and Sense",
    difficulty: 2,
    passage: "The museum's collection of ancient coins, which ______ found along the Silk Road, is displayed on the second floor.",
    stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
    choices: ["was", "were", "is", "has been"],
    answer: 1,
    explanation: "«Which» здесь относится к монетам (coins), найдены были монеты — множественное число, «were» (B).",
  },
];

// ---------- Reading & Writing: generated grammar items ----------

const SUBJECTS: [string, boolean][] = [
  ["The list of finalists", false],
  ["The students in the robotics club", true],
  ["A collection of old maps", false],
  ["The teachers at the new campus", true],
  ["One of the experiments", false],
  ["The results of the survey", true],
  ["The team of engineers", false],
  ["Several members of the debate team", true],
];
const PREDICATES: [string, string, string][] = [
  ["is", "are", "displayed in the main hall."],
  ["was", "were", "published in the school newspaper last week."],
  ["has", "have", "surprised many visitors."],
  ["needs", "need", "more time to prepare."],
];

function grammarItems(): RW[] {
  const r = rng(77);
  const out: RW[] = [];
  let n = 0;
  for (const [subject, plural] of SUBJECTS) {
    for (const [sing, plur, tail] of PREDICATES.slice(0, 2)) {
      n++;
      const right = plural ? plur : sing;
      const wrong = plural ? sing : plur;
      const { choices, answer } = mc(r, right, [wrong, plural ? "being" : "been", plural ? "has been being" : "to be"]);
      out.push({
        id: `rw-gen-sva-${String(n).padStart(2, "0")}`,
        domain: "Standard English Conventions",
        skill: "Subject-Verb Agreement",
        difficulty: subject.startsWith("One of") || subject.startsWith("A collection") || subject.startsWith("The list") ? 2 : 1,
        passage: `${subject} ______ ${tail}`,
        stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
        choices,
        answer,
        explanation: `Главное слово подлежащего — «${subject.replace(/^(The|A|One of the|Several members of the)\s/, "").split(" ")[0]}»${plural ? " (множественное число)" : " (единственное число)"}. Слова между подлежащим и глаголом не меняют число, поэтому нужно «${right}».`,
      });
    }
  }
  return out;
}

// ---------- Reading & Writing: generated transitions and boundaries ----------

type Rel = "result" | "contrast" | "example" | "addition" | "sequence";
const REL: Record<Rel, { right: string; ru: string }> = {
  result: { right: "As a result", ru: "следствие" },
  contrast: { right: "However", ru: "контраст" },
  example: { right: "For example", ru: "пример" },
  addition: { right: "In addition", ru: "добавление" },
  sequence: { right: "Next", ru: "последовательность шагов" },
};
const TRANSITION_PAIRS: [string, string, Rel][] = [
  ["The city added three new bus lines to the university district.", "the average commute for students fell by twelve minutes.", "result"],
  ["Many people assume that deserts have no wildlife.", "the dunes of Altyn-Emel are home to beetles, lizards and foxes.", "contrast"],
  ["Some apps adapt to each learner's level.", "one language app changes the difficulty after every answer.", "example"],
  ["The robotics club meets twice a week.", "members can use the lab on Saturdays to finish their projects.", "addition"],
  ["To build the weather station, the students first wrote down what they wanted to measure.", "they chose sensors for temperature, humidity and wind.", "sequence"],
  ["The solar panels were cleaned after the dust storm.", "the school's electricity output rose by nearly a fifth.", "result"],
  ["Paper maps are still popular with hikers.", "most tourists now rely on phone navigation in the mountains.", "contrast"],
  ["Several Kazakh scientists have worked at international space agencies.", "one engineer from Almaty helped design a satellite camera.", "example"],
  ["The museum offers free entry on Sundays.", "it runs evening lectures for students every Thursday.", "addition"],
  ["The chemist measured 50 ml of the solution.", "she slowly added the indicator and watched the colour change.", "sequence"],
  ["The library extended its opening hours until 8 p.m.", "more students began preparing for exams there.", "result"],
  ["Electric buses produce no exhaust in the city.", "the electricity that charges them may come from coal plants.", "contrast"],
];

function transitionItems(): RW[] {
  const r = rng(91);
  const all = Object.values(REL).map((x) => x.right);
  return TRANSITION_PAIRS.map(([a, b, rel], i) => {
    const right = REL[rel].right;
    const { choices, answer } = mc(r, right, all.filter((x) => x !== right).sort(() => r() - 0.5));
    return {
      id: `rw-gen-tr-${String(i + 1).padStart(2, "0")}`,
      domain: "Expression of Ideas" as const,
      skill: "Transitions",
      difficulty: (rel === "contrast" || rel === "example" ? 2 : 1) as Difficulty,
      passage: `${a} ______, ${b}`,
      stem: "Which choice completes the text with the most logical transition?",
      choices,
      answer,
      explanation: `Связь между предложениями — ${REL[rel].ru}. Поэтому подходит «${right}».`,
    };
  });
}

const BOUNDARY_ITEMS: [string, string, string, "semicolon" | "colon"][] = [
  ["The team tested the drone over the lake on", "Tuesday", "the battery lasted twice as long as expected.", "semicolon"],
  ["Our class visited the planetarium in", "Astana", "the next week we built a model of the solar system.", "semicolon"],
  ["The recipe for baursak needs only four", "ingredients", "flour, milk, yeast and a little sugar.", "colon"],
  ["The olympiad had three", "rounds", "a written test, a lab task and an oral defence.", "colon"],
  ["The volunteers planted two hundred trees along the", "river", "by spring most of them had new leaves.", "semicolon"],
  ["The report explained the main", "problem", "the school's old servers could not handle so many users.", "colon"],
  ["Snow leopards are rarely seen in the", "wild", "scientists track them with motion-activated cameras.", "semicolon"],
  ["The debate club chose its", "topic", "should homework be optional for senior students?", "colon"],
];

function boundaryItems(): RW[] {
  const r = rng(57);
  return BOUNDARY_ITEMS.map(([lead, word, tail, kind], i) => {
    const right = kind === "semicolon" ? `${word};` : `${word}:`;
    const { choices, answer } = mc(r, right, [`${word},`, `${word}`, kind === "semicolon" ? `${word}, and,` : `${word};`]);
    return {
      id: `rw-gen-bd-${String(i + 1).padStart(2, "0")}`,
      domain: "Standard English Conventions" as const,
      skill: "Boundaries",
      difficulty: (kind === "colon" ? 2 : 1) as Difficulty,
      passage: `${lead} ______ ${tail}`,
      stem: "Which choice completes the text so that it conforms to the conventions of Standard English?",
      choices,
      answer,
      explanation:
        kind === "semicolon"
          ? "Обе части — законченные предложения. Запятой их соединить нельзя (comma splice), точка с запятой — можно."
          : "Перед пропуском законченное предложение, после него — список или пояснение. Такой фрагмент вводится двоеточием.",
    };
  });
}

// ---------- Math generators ----------

type Gen = { key: string; domain: SatDomain; skill: string; make: (r: () => number) => Omit<RW, "id" | "domain" | "skill"> };

const GENS: Gen[] = [
  {
    key: "lin",
    domain: "Algebra",
    skill: "Linear equations in one variable",
    make: (r) => {
      const a = int(r, 2, 9);
      const x = int(r, -6, 12);
      const b = int(r, -15, 20);
      const c = a * x + b;
      return {
        difficulty: 1,
        stem: `If $${a}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${c}$, what is the value of $x$?`,
        answer: String(x),
        explanation: `Перенесём ${b}: $${a}x = ${c - b}$. Делим на ${a}: $x = ${x}$.`,
      };
    },
  },
  {
    key: "slope",
    domain: "Algebra",
    skill: "Linear functions",
    make: (r) => {
      const x1 = int(r, -4, 3);
      const dx = int(r, 1, 5);
      const m = pick(r, [-3, -2, -1, 1, 2, 3, 4, 0.5]);
      const y1 = int(r, -5, 6);
      const x2 = x1 + dx * (m === 0.5 ? 2 : 1);
      const y2 = y1 + m * (x2 - x1);
      const { choices, answer } = mc(r, fmt(m), [fmt(-m), fmt(1 / m), fmt(m + 1), fmt(m * 2)]);
      return {
        difficulty: 1,
        stem: `A line passes through the points $(${x1}, ${y1})$ and $(${x2}, ${fmt(y2)})$. What is the slope of the line?`,
        choices,
        answer,
        explanation: `Наклон = $\\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${fmt(y2)} - (${y1})}{${x2} - (${x1})} = ${fmt(m)}$.`,
      };
    },
  },
  {
    key: "cost",
    domain: "Algebra",
    skill: "Linear models",
    make: (r) => {
      const fee = pick(r, [500, 800, 1000, 1500, 2000]);
      const rate = pick(r, [150, 200, 250, 300, 350]);
      const total = fee + rate * int(r, 4, 15);
      const n = (total - fee) / rate;
      return {
        difficulty: 2,
        stem: `A taxi in Almaty charges a fixed fee of ${fee} tenge plus ${rate} tenge per kilometre. A ride cost ${total} tenge in total. How many kilometres long was the ride?`,
        answer: String(n),
        explanation: `Модель: $${fee} + ${rate}k = ${total}$. Тогда $${rate}k = ${total - fee}$, $k = ${n}$.`,
      };
    },
  },
  {
    key: "sys",
    domain: "Algebra",
    skill: "Systems of linear equations",
    make: (r) => {
      const x = int(r, -3, 9);
      const y = int(r, -3, 9);
      const a = int(r, 1, 4);
      const b = int(r, 1, 4);
      const s1 = x + y;
      const s2 = a * x - b * y;
      const { choices, answer } = mc(r, String(x), [String(y), String(s1), String(x + 1), String(-x)]);
      return {
        difficulty: 2,
        stem: `$x + y = ${s1}$\n$${a === 1 ? "" : a}x - ${b === 1 ? "" : b}y = ${s2}$\nIf $(x, y)$ is the solution to the system of equations above, what is the value of $x$?`,
        choices,
        answer,
        explanation: `Из первого: $y = ${s1} - x$. Подставим: $${a}x - ${b}(${s1} - x) = ${s2}$ → $${a + b}x = ${s2 + b * s1}$ → $x = ${x}$.`,
      };
    },
  },
  {
    key: "nosol",
    domain: "Algebra",
    skill: "Systems of linear equations",
    make: (r) => {
      const a = int(r, 2, 6);
      const b = int(r, 2, 7);
      const k = int(r, 2, 4);
      const c = int(r, 3, 12);
      const right = String(a * k);
      const { choices, answer } = mc(r, right, [String(a), String(b * k), String(a + k), String(a * k + 1)]);
      return {
        difficulty: 3,
        stem: `$${a}x + ${b}y = ${c}$\n$px + ${b * k}y = ${c * k + 1}$\nIn the system of equations above, $p$ is a constant. For what value of $p$ does the system have no solution?`,
        choices,
        answer,
        explanation: `Нет решений, когда прямые параллельны: коэффициенты пропорциональны, а свободные члены — нет. Второе уравнение должно быть первым, умноженным на ${k}: $p = ${a} \\cdot ${k} = ${right}$, а ${c * k + 1} ≠ ${c * k}$.`,
      };
    },
  },
  {
    key: "fval",
    domain: "Advanced Math",
    skill: "Nonlinear functions",
    make: (r) => {
      const a = int(r, 1, 5);
      const b = int(r, -9, 9);
      const k = int(r, -4, 5);
      const val = a * k * k + b;
      return {
        difficulty: 1,
        stem: `The function $f$ is defined by $f(x) = ${a === 1 ? "" : a}x^2 ${b >= 0 ? "+" : "-"} ${Math.abs(b)}$. What is the value of $f(${k})$?`,
        answer: String(val),
        explanation: `$f(${k}) = ${a} \\cdot (${k})^2 ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${a * k * k} ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = ${val}$.`,
      };
    },
  },
  {
    key: "quad",
    domain: "Advanced Math",
    skill: "Nonlinear equations",
    make: (r) => {
      const p = int(r, 1, 9);
      const q = int(r, -9, -1);
      const b = -(p + q);
      const c = p * q;
      return {
        difficulty: 2,
        stem: `$x^2 ${b >= 0 ? "+" : "-"} ${Math.abs(b)}x ${c >= 0 ? "+" : "-"} ${Math.abs(c)} = 0$\nWhat is the positive solution to the equation above?`,
        answer: String(p),
        explanation: `Разложим на множители: $(x - ${p})(x ${q >= 0 ? "-" : "+"} ${Math.abs(q)}) = 0$. Корни: ${p} и ${q}. Положительный — ${p}.`,
      };
    },
  },
  {
    key: "growth",
    domain: "Advanced Math",
    skill: "Exponential models",
    make: (r) => {
      const p0 = pick(r, [1000, 2000, 5000, 8000]);
      const pct = pick(r, [5, 10, 20, 25]);
      const t = int(r, 2, 3);
      const right = `$${p0}(${fmt(1 + pct / 100)})^{${t}}$`;
      const { choices, answer } = mc(r, right, [`$${p0}(${fmt(pct / 100)})^{${t}}$`, `$${p0} + ${pct}\\cdot ${t}$`, `$${p0}(${fmt(1 + pct / 100)}) \\cdot ${t}$`, `$${p0}(${fmt(1 - pct / 100)})^{${t}}$`]);
      return {
        difficulty: 2,
        stem: `A school app had ${p0} users at launch. The number of users grows by ${pct}% each month. Which expression gives the number of users after ${t} months?`,
        choices,
        answer,
        explanation: `Рост на ${pct}% в месяц — умножение на ${fmt(1 + pct / 100)} каждый месяц. За ${t} месяца: ${right.replace(/\$/g, "")}.`,
      };
    },
  },
  {
    key: "vertex",
    domain: "Advanced Math",
    skill: "Quadratic functions",
    make: (r) => {
      const h = int(r, -5, 6);
      const k = int(r, -8, 8);
      const b = -2 * h;
      const c = h * h + k;
      const { choices, answer } = mc(r, String(k), [String(c), String(h), String(-k), String(k + h)]);
      return {
        difficulty: 3,
        stem: `The graph of $y = x^2 ${b >= 0 ? "+" : "-"} ${Math.abs(b)}x ${c >= 0 ? "+" : "-"} ${Math.abs(c)}$ is a parabola. What is the minimum value of $y$?`,
        choices,
        answer,
        explanation: `Вершина при $x = -\\frac{b}{2a} = ${h}$. Подставим: $y = ${h}^2 ${b >= 0 ? "+" : "-"} ${Math.abs(b)}\\cdot ${h} + ${c} = ${k}$. Ветви вверх, значит это минимум.`,
      };
    },
  },
  {
    key: "pct",
    domain: "Problem-Solving and Data Analysis",
    skill: "Percentages",
    make: (r) => {
      const price = pick(r, [12000, 15000, 20000, 24000, 30000]);
      const d = pick(r, [10, 15, 20, 25, 30]);
      const right = price * (1 - d / 100);
      const { choices, answer } = mc(r, `${right} tenge`, [`${price - d * 10} tenge`, `${price * (d / 100)} tenge`, `${price * (1 + d / 100)} tenge`, `${right + 1000} tenge`]);
      return {
        difficulty: 1,
        stem: `A pair of headphones costs ${price} tenge. During a sale, the price is reduced by ${d}%. What is the sale price?`,
        choices,
        answer,
        explanation: `Скидка ${d}% — значит платим ${100 - d}%: $${price} \\cdot ${fmt(1 - d / 100)} = ${right}$ тенге.`,
      };
    },
  },
  {
    key: "mean",
    domain: "Problem-Solving and Data Analysis",
    skill: "One-variable data",
    make: (r) => {
      const n = int(r, 4, 6);
      const target = int(r, 70, 90);
      const vals = Array.from({ length: n - 1 }, () => int(r, target - 12, target + 12));
      const last = target * n - vals.reduce((s, v) => s + v, 0);
      return {
        difficulty: 2,
        stem: `A student's scores on ${n - 1} tests were ${vals.join(", ")}. What score does the student need on test ${n} so that the mean of all ${n} scores is exactly ${target}?`,
        answer: String(last),
        explanation: `Сумма всех ${n} оценок должна быть $${target} \\cdot ${n} = ${target * n}$. Уже есть $${vals.reduce((s, v) => s + v, 0)}$. Нужно $${target * n} - ${vals.reduce((s, v) => s + v, 0)} = ${last}$.`,
      };
    },
  },
  {
    key: "prob",
    domain: "Problem-Solving and Data Analysis",
    skill: "Probability",
    make: (r) => {
      const a = int(r, 8, 30);
      const b = int(r, 8, 30);
      const c = int(r, 8, 30);
      const d = int(r, 8, 30);
      const total = a + b + c + d;
      const g = (x: number, y: number): number => (y === 0 ? x : g(y, x % y));
      const k = g(a + c, total);
      const right = `$\\frac{${(a + c) / k}}{${total / k}}$`;
      const { choices, answer } = mc(r, right, [`$\\frac{${a}}{${total}}$`, `$\\frac{${a + b}}{${total}}$`, `$\\frac{${c}}{${a + c}}$`, `$\\frac{${b + d}}{${total}}$`]);
      return {
        difficulty: 2,
        stem: `A survey asked students whether they prefer SAT or IELTS preparation in the morning or in the evening.\n| | Morning | Evening |\n|---|---|---|\n| SAT | ${a} | ${b} |\n| IELTS | ${c} | ${d} |\nIf one student is chosen at random, what is the probability that the student prefers the morning?`,
        choices,
        answer,
        explanation: `Утро выбрали $${a} + ${c} = ${a + c}$ человек из $${total}$. Вероятность ${right.replace(/\$/g, "")}.`,
      };
    },
  },
  {
    key: "ratio",
    domain: "Problem-Solving and Data Analysis",
    skill: "Ratios, rates, and units",
    make: (r) => {
      const speed = pick(r, [40, 45, 60, 72, 90]);
      const minutes = pick(r, [20, 30, 40, 50]);
      const km = (speed * minutes) / 60;
      return {
        difficulty: 1,
        stem: `A bus travels at a constant speed of ${speed} kilometres per hour. How many kilometres does it travel in ${minutes} minutes?`,
        answer: fmt(km),
        explanation: `${minutes} минут = ${fmt(minutes / 60)} часа. Расстояние: $${speed} \\cdot ${fmt(minutes / 60)} = ${fmt(km)}$ км.`,
      };
    },
  },
  {
    key: "circle",
    domain: "Geometry and Trigonometry",
    skill: "Circles",
    make: (r) => {
      const rad = int(r, 2, 12);
      const right = `$${rad * rad}\\pi$`;
      const { choices, answer } = mc(r, right, [`$${2 * rad}\\pi$`, `$${rad}\\pi$`, `$${4 * rad * rad}\\pi$`, `$${rad * rad}$`]);
      return {
        difficulty: 1,
        stem: `A circle has a radius of ${rad}. What is the area of the circle?`,
        choices,
        answer,
        explanation: `Площадь круга $\\pi r^2 = \\pi \\cdot ${rad}^2 = ${rad * rad}\\pi$.`,
      };
    },
  },
  {
    key: "pyth",
    domain: "Geometry and Trigonometry",
    skill: "Right triangles",
    make: (r) => {
      const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15]]) as number[];
      const k = int(r, 1, 3);
      return {
        difficulty: 2,
        stem: `A right triangle has legs of length ${a * k} and ${b * k}. What is the length of the hypotenuse?`,
        answer: String(c * k),
        explanation: `По теореме Пифагора: $\\sqrt{${a * k}^2 + ${b * k}^2} = \\sqrt{${(a * k) ** 2 + (b * k) ** 2}} = ${c * k}$.`,
      };
    },
  },
  {
    key: "trig",
    domain: "Geometry and Trigonometry",
    skill: "Right triangle trigonometry",
    make: (r) => {
      const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]) as number[];
      const right = `$\\frac{${a}}{${c}}$`;
      const { choices, answer } = mc(r, right, [`$\\frac{${b}}{${c}}$`, `$\\frac{${a}}{${b}}$`, `$\\frac{${c}}{${a}}$`, `$\\frac{${b}}{${a}}$`]);
      return {
        difficulty: 3,
        stem: `In right triangle $ABC$, angle $C$ is the right angle, $BC = ${a}$, $AC = ${b}$, and $AB = ${c}$. What is the value of $\\sin A$?`,
        choices,
        answer,
        explanation: `$\\sin A$ = противолежащий катет / гипотенуза. Против угла A лежит BC = ${a}, гипотенуза AB = ${c}: ${right.replace(/\$/g, "")}.`,
      };
    },
  },
];

const VARIANTS_PER_GEN = 12;

function mathItems(): RW[] {
  const out: RW[] = [];
  GENS.forEach((g, gi) => {
    for (let v = 1; v <= VARIANTS_PER_GEN; v++) {
      const q = g.make(rng(1000 * (gi + 1) + v));
      out.push({ id: `m-${g.key}-${String(v).padStart(2, "0")}`, domain: g.domain, skill: g.skill, ...q });
    }
  });
  return out;
}

export const SAT_BANK: SatQuestion[] = [
  ...RW_ITEMS.map((q) => ({ ...q, section: "rw" as const, source: "bank" as const })),
  ...grammarItems().map((q) => ({ ...q, section: "rw" as const, source: "generated" as const })),
  ...transitionItems().map((q) => ({ ...q, section: "rw" as const, source: "generated" as const })),
  ...boundaryItems().map((q) => ({ ...q, section: "rw" as const, source: "generated" as const })),
  ...mathItems().map((q) => ({ ...q, section: "math" as const, source: "generated" as const })),
  ...BANK365.sat,
];

export const SAT_BY_ID = new Map(SAT_BANK.map((q) => [q.id, q]));

/** A fresh variant of a math generator, used by Blitz to avoid repeats. */
export function freshMath(seed: number): SatQuestion {
  const r = rng(seed);
  const gi = Math.floor(r() * GENS.length);
  const g = GENS[gi]!;
  return { id: `m-${g.key}-x${seed}`, domain: g.domain, skill: g.skill, section: "math", source: "generated", ...g.make(rng(seed * 7 + 3)) };
}

export function isCorrect(q: SatQuestion, response: unknown): boolean {
  if (q.choices) return Number(response) === q.answer;
  const norm = (v: unknown) => String(v ?? "").trim().replace(",", ".").replace(/\s+/g, "");
  const given = norm(response);
  if (!given) return false;
  const want = norm(q.answer);
  if (given === want) return true;
  // Accept equivalent fractions/decimals for grid-ins, as the real test does.
  const toNum = (s: string) => {
    if (/^-?\d+\/\d+$/.test(s)) {
      const [a, b] = s.split("/").map(Number);
      return b ? a! / b : NaN;
    }
    return Number(s);
  };
  const a = toNum(given);
  const b = toNum(want);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-3;
}

// ---------- scoring ----------

/**
 * Rough Digital SAT section estimate (200–800) from accuracy in both modules,
 * rewarding the harder second module. This is an estimate, not College Board scoring.
 */
export function scaleSection(m1Correct: number, m1Total: number, m2Correct: number, m2Total: number, m2Level: "easy" | "hard") {
  const p1 = m1Total ? m1Correct / m1Total : 0;
  const p2 = m2Total ? m2Correct / m2Total : 0;
  const base = m2Level === "hard" ? 470 : 200;
  const span = m2Level === "hard" ? 330 : 400;
  const raw = base + span * (0.45 * p1 + 0.55 * p2);
  const capped = m2Level === "easy" ? Math.min(raw, 600) : raw;
  return Math.round(capped / 10) * 10;
}

export const DIFFICULTY_OF = (d: Difficulty) => d;
