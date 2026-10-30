import type { VocabUnit } from "./types";

// Original SAT-level vocabulary units: words + a short text that uses them in context.
// The quiz is built from the definitions, so every unit tests itself.

export const VOCAB: VocabUnit[] = [
  {
    id: "v1",
    title: "The Silent Engineers",
    topic: "Наука · природа",
    text:
      "Beavers are often called the silent engineers of the river. Their dams look **rudimentary** from a distance, but a closer look reveals a **meticulous** structure of branches, mud and stones. Ecologists once considered beavers a nuisance; today many regard them as **indispensable** to healthy wetlands. A single dam can **mitigate** floods downstream and create ponds that **sustain** fish, frogs and birds through dry summers. The benefits are not **immediate**, however. It can take years before the new habitat becomes **robust** enough to resist drought. Still, the evidence is **compelling**: where beavers return, the landscape slowly **rejuvenates**, and the rivers become **resilient** again.",
    words: [
      { id: "v1-1", word: "rudimentary", pos: "adj.", definition: "basic and undeveloped", ru: "примитивный, зачаточный", example: "The first robot was rudimentary but it moved.", similar: ["basic", "elementary"] },
      { id: "v1-2", word: "meticulous", pos: "adj.", definition: "showing great attention to detail", ru: "скрупулёзный, тщательный", example: "Her notes were meticulous and easy to review.", similar: ["careful", "precise"] },
      { id: "v1-3", word: "indispensable", pos: "adj.", definition: "absolutely necessary", ru: "незаменимый", example: "A calculator is indispensable in the math section.", similar: ["essential", "vital"] },
      { id: "v1-4", word: "mitigate", pos: "verb", definition: "to make something less severe", ru: "смягчать, уменьшать", example: "Trees mitigate the heat in the city.", similar: ["reduce", "ease"] },
      { id: "v1-5", word: "sustain", pos: "verb", definition: "to keep something going over time", ru: "поддерживать", example: "Small daily practice can sustain progress.", similar: ["maintain", "support"] },
      { id: "v1-6", word: "immediate", pos: "adj.", definition: "happening at once, without delay", ru: "немедленный", example: "The effect of the medicine was immediate.", similar: ["instant", "prompt"] },
      { id: "v1-7", word: "robust", pos: "adj.", definition: "strong and able to withstand difficulties", ru: "крепкий, надёжный", example: "The app needs a robust server.", similar: ["sturdy", "strong"] },
      { id: "v1-8", word: "compelling", pos: "adj.", definition: "convincing and hard to ignore", ru: "убедительный", example: "She gave a compelling argument.", similar: ["convincing", "persuasive"] },
      { id: "v1-9", word: "rejuvenate", pos: "verb", definition: "to make fresh or lively again", ru: "омолаживать, восстанавливать", example: "The new park rejuvenated the district.", similar: ["revive", "restore"] },
      { id: "v1-10", word: "resilient", pos: "adj.", definition: "able to recover quickly from difficulty", ru: "устойчивый, жизнестойкий", example: "Resilient students learn from failed tests.", similar: ["tough", "adaptable"] },
    ],
  },
  {
    id: "v2",
    title: "The Map That Lied",
    topic: "История · Шёлковый путь",
    text:
      "For centuries travellers relied on maps that were, at best, **ambiguous**. A river might appear on one map and **vanish** from the next. Historians now believe that some mapmakers deliberately **embellished** their work, adding imaginary cities to impress wealthy patrons. Others simply **perpetuated** the mistakes of earlier maps they copied. Modern scholars try to **reconcile** these conflicting sources, comparing them with merchants' letters and archaeological finds. The task is **arduous**, but it has yielded **unprecedented** insights into how knowledge travelled along the Silk Road. One historian calls the old maps '**candid** records of what people hoped to find' — a reminder that even **authoritative** documents can tell us more about their authors than about the world, and that a careful reader must remain **skeptical**.",
    words: [
      { id: "v2-1", word: "ambiguous", pos: "adj.", definition: "open to more than one interpretation", ru: "двусмысленный, неясный", example: "The question was ambiguous, so many students misread it.", similar: ["unclear", "vague"] },
      { id: "v2-2", word: "vanish", pos: "verb", definition: "to disappear suddenly", ru: "исчезать", example: "The file seemed to vanish from the folder.", similar: ["disappear", "fade"] },
      { id: "v2-3", word: "embellish", pos: "verb", definition: "to make a story more interesting by adding details that may be untrue", ru: "приукрашивать", example: "He embellished the story of his trip.", similar: ["exaggerate", "decorate"] },
      { id: "v2-4", word: "perpetuate", pos: "verb", definition: "to make something continue for a long time", ru: "увековечивать, продолжать", example: "Copying old notes can perpetuate errors.", similar: ["continue", "preserve"] },
      { id: "v2-5", word: "reconcile", pos: "verb", definition: "to make two different ideas or facts fit together", ru: "согласовывать, примирять", example: "Scientists tried to reconcile the two results.", similar: ["harmonise", "resolve"] },
      { id: "v2-6", word: "arduous", pos: "adj.", definition: "requiring a lot of effort", ru: "трудный, напряжённый", example: "Preparing for the olympiad was arduous.", similar: ["difficult", "demanding"] },
      { id: "v2-7", word: "unprecedented", pos: "adj.", definition: "never done or known before", ru: "беспрецедентный", example: "The school saw unprecedented interest in robotics.", similar: ["new", "unparalleled"] },
      { id: "v2-8", word: "candid", pos: "adj.", definition: "honest and direct", ru: "откровенный", example: "The coach gave candid feedback.", similar: ["frank", "honest"] },
      { id: "v2-9", word: "authoritative", pos: "adj.", definition: "reliable because it comes from an expert source", ru: "авторитетный", example: "Use authoritative sources in your essay.", similar: ["reliable", "official"] },
      { id: "v2-10", word: "skeptical", pos: "adj.", definition: "doubting that something is true", ru: "скептичный", example: "Be skeptical of answers that look too easy.", similar: ["doubtful", "questioning"] },
    ],
  },
  {
    id: "v3",
    title: "Code and Character",
    topic: "Технологии · этика ИИ",
    text:
      "When the school introduced an AI writing assistant, some teachers were **apprehensive**. Would students become **complacent**, letting the machine do their thinking? The first weeks seemed to **validate** those fears: several essays were **superficial**, polished on the surface but empty underneath. The teachers responded not by banning the tool but by changing the task. Students now had to **annotate** every suggestion they accepted and **justify** each change. The result was **remarkable**. Instead of passively copying, students began to **scrutinise** the AI's output, catching its errors and **refining** their own arguments. As one student put it, 'The AI is a tool, not a **substitute** for judgement.'",
    words: [
      { id: "v3-1", word: "apprehensive", pos: "adj.", definition: "worried that something bad will happen", ru: "встревоженный, опасающийся", example: "She felt apprehensive before the exam.", similar: ["anxious", "uneasy"] },
      { id: "v3-2", word: "complacent", pos: "adj.", definition: "too satisfied to make an effort", ru: "самодовольный, расслабленный", example: "Don't become complacent after one good score.", similar: ["smug", "careless"] },
      { id: "v3-3", word: "validate", pos: "verb", definition: "to show that something is true or correct", ru: "подтверждать", example: "The experiment validated her hypothesis.", similar: ["confirm", "prove"] },
      { id: "v3-4", word: "superficial", pos: "adj.", definition: "concerned only with the obvious surface", ru: "поверхностный", example: "His analysis was superficial.", similar: ["shallow", "cursory"] },
      { id: "v3-5", word: "annotate", pos: "verb", definition: "to add notes explaining something", ru: "комментировать, аннотировать", example: "Annotate the passage as you read.", similar: ["comment", "mark up"] },
      { id: "v3-6", word: "justify", pos: "verb", definition: "to give good reasons for something", ru: "обосновывать", example: "Justify your answer with evidence.", similar: ["explain", "defend"] },
      { id: "v3-7", word: "remarkable", pos: "adj.", definition: "unusual and worth noticing", ru: "примечательный", example: "Her progress was remarkable.", similar: ["striking", "notable"] },
      { id: "v3-8", word: "scrutinise", pos: "verb", definition: "to examine very carefully", ru: "тщательно изучать", example: "Scrutinise every answer choice.", similar: ["inspect", "examine"] },
      { id: "v3-9", word: "refine", pos: "verb", definition: "to improve by making small changes", ru: "дорабатывать, улучшать", example: "Refine your prompt to get better code.", similar: ["polish", "improve"] },
      { id: "v3-10", word: "substitute", pos: "noun", definition: "a person or thing used instead of another", ru: "замена", example: "Practice is no substitute for sleep before a test.", similar: ["replacement", "alternative"] },
    ],
  },
  {
    id: "v4",
    title: "The Steppe Orchestra",
    topic: "Культура · музыка",
    text:
      "The dombra has only two strings, yet in skilled hands it can produce an **astonishingly** rich sound. Kazakh musicians have long used it to tell stories, and its **distinctive** rhythm often **evokes** the gallop of horses across the steppe. In recent years young composers have begun to **integrate** the dombra into electronic music, a move some traditionalists find **controversial**. Supporters argue that innovation keeps the instrument **relevant**; critics worry that its **intricate** techniques may be **diluted**. Both sides, however, agree on one point: the dombra's history is too **profound** to be forgotten, and each generation must **cultivate** it in its own way.",
    words: [
      { id: "v4-1", word: "astonishingly", pos: "adv.", definition: "in a very surprising way", ru: "поразительно", example: "The app was astonishingly fast.", similar: ["amazingly", "remarkably"] },
      { id: "v4-2", word: "distinctive", pos: "adj.", definition: "clearly different and easy to recognise", ru: "характерный, отличительный", example: "The school uniform has a distinctive red colour.", similar: ["characteristic", "unique"] },
      { id: "v4-3", word: "evoke", pos: "verb", definition: "to bring a feeling or memory to mind", ru: "вызывать (чувство, образ)", example: "The song evokes memories of summer.", similar: ["suggest", "recall"] },
      { id: "v4-4", word: "integrate", pos: "verb", definition: "to combine things so they work together", ru: "объединять, встраивать", example: "We integrate AI into our coding lessons.", similar: ["combine", "incorporate"] },
      { id: "v4-5", word: "controversial", pos: "adj.", definition: "causing public disagreement", ru: "спорный", example: "The new rule was controversial.", similar: ["disputed", "divisive"] },
      { id: "v4-6", word: "relevant", pos: "adj.", definition: "closely connected to the matter at hand", ru: "актуальный, относящийся к делу", example: "Only include relevant evidence.", similar: ["pertinent", "applicable"] },
      { id: "v4-7", word: "intricate", pos: "adj.", definition: "very detailed and complicated", ru: "сложный, замысловатый", example: "The carpet has an intricate pattern.", similar: ["complex", "elaborate"] },
      { id: "v4-8", word: "dilute", pos: "verb", definition: "to make weaker by mixing with something else", ru: "разбавлять, ослаблять", example: "Too many examples can dilute your argument.", similar: ["weaken", "water down"] },
      { id: "v4-9", word: "profound", pos: "adj.", definition: "very great or deep", ru: "глубокий", example: "The book had a profound effect on her.", similar: ["deep", "significant"] },
      { id: "v4-10", word: "cultivate", pos: "verb", definition: "to develop a skill or quality over time", ru: "развивать, взращивать", example: "Reading daily cultivates vocabulary.", similar: ["develop", "nurture"] },
    ],
  },
];

export const VOCAB_BY_ID = new Map(VOCAB.map((u) => [u.id, u]));
