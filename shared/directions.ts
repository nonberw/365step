// One catalogue shared by the registration, server and all navigation surfaces.
export type DirectionId = string;
export type LearningLocale = "ru" | "kk" | "en";
export interface DirectionModule { id: string; title: string; order: number }
export interface DirectionSource { id: string; title: string; url: string; mode: "external"; language: string; checkedAt: string }
export interface Direction { id: DirectionId; title: string; titles: Record<LearningLocale,string>; emoji: string; group: string; description: string; aliases: string; specialties: string[]; modules: DirectionModule[]; sources: DirectionSource[]; tools: {to:string;label:string}[] }
export interface LearningProfile { directionId: DirectionId|null; specializationId: string|null; version: number; updatedAt?: number }
export const EMPTY_LEARNING_PROFILE: LearningProfile = {directionId:null,specializationId:null,version:0};
export const DIRECTIONS: Direction[] = [
  {
    "id": "it",
    "title": "IT и компьютерные науки",
    "titles": {
      "ru": "IT и компьютерные науки",
      "en": "Computer science",
      "kk": "Ақпараттық технологиялар"
    },
    "emoji": "💻",
    "group": "Технологии",
    "description": "Программирование, ИИ, кибербезопасность, информационные системы",
    "aliases": "программист разработчик айти software",
    "specialties": [
      "Программирование",
      "ИИ",
      "кибербезопасность",
      "информационные системы"
    ],
    "modules": [
      {
        "id": "it-01",
        "title": "Algo Arena",
        "order": 1
      },
      {
        "id": "it-02",
        "title": "Web-студия",
        "order": 2
      },
      {
        "id": "it-03",
        "title": "Data & AI",
        "order": 3
      },
      {
        "id": "it-04",
        "title": "CyberLab",
        "order": 4
      },
      {
        "id": "it-05",
        "title": "App Factory",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "cs50",
        "title": "Harvard CS50",
        "url": "https://cs50.harvard.edu/x/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "mit",
        "title": "MIT OpenCourseWare",
        "url": "https://ocw.mit.edu/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": [
      {
        "to": "/coding",
        "label": "Задачи"
      },
      {
        "to": "/coding/lessons",
        "label": "Уроки с кодом"
      },
      {
        "to": "/coding/blitz",
        "label": "Bug Blitz"
      }
    ]
  },
  {
    "id": "engineering",
    "title": "Инженерия и робототехника",
    "titles": {
      "ru": "Инженерия и робототехника",
      "en": "Engineering and robotics",
      "kk": "Инженерия және робототехника"
    },
    "emoji": "⚙️",
    "group": "Технологии",
    "description": "Механика, электроника, энергетика, автоматизация и робототехника",
    "aliases": "инженер робот машиностроение электротехника",
    "specialties": [
      "Механика",
      "электроника",
      "энергетика",
      "автоматизация и робототехника"
    ],
    "modules": [
      {
        "id": "engineering-01",
        "title": "РобоЛаб",
        "order": 1
      },
      {
        "id": "engineering-02",
        "title": "CAD-студия",
        "order": 2
      },
      {
        "id": "engineering-03",
        "title": "Электроника и IoT",
        "order": 3
      },
      {
        "id": "engineering-04",
        "title": "АэроЛаб",
        "order": 4
      },
      {
        "id": "engineering-05",
        "title": "Энергия и механика",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "mit",
        "title": "MIT OpenCourseWare",
        "url": "https://ocw.mit.edu/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "freecad",
        "title": "FreeCAD",
        "url": "https://www.freecad.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": [
      {
        "to": "/engineering/robot",
        "label": "Конструктор роботов"
      },
      {
        "to": "/engineering/cad/box",
        "label": "CAD"
      },
      {
        "to": "/engineering/arduino/blink",
        "label": "Arduino"
      },
      {
        "to": "/engineering/drone",
        "label": "Дроны"
      },
      {
        "to": "/engineering/cad-studio",
        "label": "ИИ-конструктор"
      }
    ]
  },
  {
    "id": "architecture",
    "title": "Архитектура, строительство и урбанистика",
    "titles": {
      "ru": "Архитектура, строительство и урбанистика",
      "en": "Architecture and urban planning",
      "kk": "Сәулет және қала құрылысы"
    },
    "emoji": "🏙️",
    "group": "Технологии",
    "description": "Здания, строительные конструкции, проектирование городской среды",
    "aliases": "архитектор строитель урбанист строительство",
    "specialties": [
      "Здания",
      "строительные конструкции",
      "проектирование городской среды"
    ],
    "modules": [
      {
        "id": "architecture-01",
        "title": "Арх-студия",
        "order": 1
      },
      {
        "id": "architecture-02",
        "title": "Город будущего",
        "order": 2
      },
      {
        "id": "architecture-03",
        "title": "Конструкции в деле",
        "order": 3
      },
      {
        "id": "architecture-04",
        "title": "BIM-практика",
        "order": 4
      },
      {
        "id": "architecture-05",
        "title": "Зелёное строительство",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "civil",
        "title": "MIT: Civil Engineering Design",
        "url": "https://ocw.mit.edu/courses/1-012-introduction-to-civil-engineering-design-spring-2002/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "yale",
        "title": "Open Yale Courses",
        "url": "https://oyc.yale.edu/courses",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "transport",
    "title": "Транспорт и логистика",
    "titles": {
      "ru": "Транспорт и логистика",
      "en": "Transport and logistics",
      "kk": "Көлік және логистика"
    },
    "emoji": "🚆",
    "group": "Технологии",
    "description": "Транспортные системы, цепочки поставок, авиация",
    "aliases": "пилот логист авиация транспорт",
    "specialties": [
      "Транспортные системы",
      "цепочки поставок",
      "авиация"
    ],
    "modules": [
      {
        "id": "transport-01",
        "title": "Supply Chain Lab",
        "order": 1
      },
      {
        "id": "transport-02",
        "title": "Маршрутный интеллект",
        "order": 2
      },
      {
        "id": "transport-03",
        "title": "Транспортные системы",
        "order": 3
      },
      {
        "id": "transport-04",
        "title": "Авиационный трек",
        "order": 4
      },
      {
        "id": "transport-05",
        "title": "Операционный центр",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "transport",
        "title": "MIT Transportation",
        "url": "https://www.ocw.mit.edu/collections/transportation/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "sumo",
        "title": "Eclipse SUMO",
        "url": "https://eclipse.dev/sumo/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "safety",
    "title": "Безопасность и управление рисками",
    "titles": {
      "ru": "Безопасность и управление рисками",
      "en": "Safety and risk management",
      "kk": "Қауіпсіздік және тәуекелдерді басқару"
    },
    "emoji": "🛡️",
    "group": "Технологии",
    "description": "Охрана труда, пожарная безопасность, ЧС и устойчивость",
    "aliases": "пожарный спасатель безопасность чрезвычайные ситуации",
    "specialties": [
      "Охрана труда",
      "пожарная безопасность",
      "ЧС и устойчивость"
    ],
    "modules": [
      {
        "id": "safety-01",
        "title": "RiskLab",
        "order": 1
      },
      {
        "id": "safety-02",
        "title": "Безопасная среда",
        "order": 2
      },
      {
        "id": "safety-03",
        "title": "ЧС: сценарный центр",
        "order": 3
      },
      {
        "id": "safety-04",
        "title": "Устойчивая инфраструктура",
        "order": 4
      },
      {
        "id": "safety-05",
        "title": "Человеческий фактор",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "osha",
        "title": "OSHA eTools",
        "url": "https://www.osha.gov/apps-and-etools",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "undrr",
        "title": "UNDRR: disaster risk reduction",
        "url": "https://www.undrr.org/our-work/training",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "business",
    "title": "Бизнес, менеджмент и предпринимательство",
    "titles": {
      "ru": "Бизнес, менеджмент и предпринимательство",
      "en": "Business and management",
      "kk": "Бизнес және менеджмент"
    },
    "emoji": "🚀",
    "group": "Бизнес и общество",
    "description": "Предпринимательство, управление командами, продуктами и проектами",
    "aliases": "предприниматель бизнесмен менеджер стартап hr",
    "specialties": [
      "Предпринимательство",
      "управление командами",
      "продуктами и проектами"
    ],
    "modules": [
      {
        "id": "business-01",
        "title": "Стартап-гараж",
        "order": 1
      },
      {
        "id": "business-02",
        "title": "CEO-симулятор",
        "order": 2
      },
      {
        "id": "business-03",
        "title": "Product Lab",
        "order": 3
      },
      {
        "id": "business-04",
        "title": "Команда и лидерство",
        "order": 4
      },
      {
        "id": "business-05",
        "title": "Переговорная",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "sloan",
        "title": "MIT Sloan: cases and simulations",
        "url": "https://mitsloan.mit.edu/teaching-resources-library",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "hp",
        "title": "HP LIFE",
        "url": "https://www.hplife.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "finance",
    "title": "Финансы, учёт и аудит",
    "titles": {
      "ru": "Финансы, учёт и аудит",
      "en": "Finance and accounting",
      "kk": "Қаржы және есеп"
    },
    "emoji": "💰",
    "group": "Бизнес и общество",
    "description": "Корпоративные финансы, банковское дело, аудит, бухгалтерия, финтех",
    "aliases": "финансист бухгалтер аудитор банкир инвестиции",
    "specialties": [
      "Корпоративные финансы",
      "банковское дело",
      "аудит",
      "бухгалтерия",
      "финтех"
    ],
    "modules": [
      {
        "id": "finance-01",
        "title": "Инвест-трек",
        "order": 1
      },
      {
        "id": "finance-02",
        "title": "Финмодель",
        "order": 2
      },
      {
        "id": "finance-03",
        "title": "Учёт без хаоса",
        "order": 3
      },
      {
        "id": "finance-04",
        "title": "Аудит и риски",
        "order": 4
      },
      {
        "id": "finance-05",
        "title": "FinTech Lab",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "yale",
        "title": "Open Yale Courses",
        "url": "https://oyc.yale.edu/courses",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "openlearn",
        "title": "OpenLearn: free courses",
        "url": "https://www.open.edu/openlearn/free-courses/full-catalogue",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "economics",
    "title": "Экономика и аналитика",
    "titles": {
      "ru": "Экономика и аналитика",
      "en": "Economics and analytics",
      "kk": "Экономика және талдау"
    },
    "emoji": "📊",
    "group": "Бизнес и общество",
    "description": "Микроэкономика, макроэкономика, эконометрика, бизнес-аналитика",
    "aliases": "экономист аналитик эконометрика",
    "specialties": [
      "Микроэкономика",
      "макроэкономика",
      "эконометрика",
      "бизнес-аналитика"
    ],
    "modules": [
      {
        "id": "economics-01",
        "title": "Экономика решений",
        "order": 1
      },
      {
        "id": "economics-02",
        "title": "Макрорадар",
        "order": 2
      },
      {
        "id": "economics-03",
        "title": "Data Detective",
        "order": 3
      },
      {
        "id": "economics-04",
        "title": "Экспериментальная экономика",
        "order": 4
      },
      {
        "id": "economics-05",
        "title": "Прогнозная мастерская",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "core",
        "title": "CORE Econ",
        "url": "https://www.core-econ.org/ebooks/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "owid",
        "title": "Our World in Data",
        "url": "https://ourworldindata.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "marketing",
    "title": "Маркетинг, PR, журналистика и медиа",
    "titles": {
      "ru": "Маркетинг, PR, журналистика и медиа",
      "en": "Marketing and media",
      "kk": "Маркетинг және медиа"
    },
    "emoji": "📣",
    "group": "Бизнес и общество",
    "description": "Маркетинг, реклама, PR, журналистика и медиапроизводство",
    "aliases": "маркетолог журналист реклама пиар pr smm",
    "specialties": [
      "Маркетинг",
      "реклама",
      "PR",
      "журналистика и медиапроизводство"
    ],
    "modules": [
      {
        "id": "marketing-01",
        "title": "Growth Hacking",
        "order": 1
      },
      {
        "id": "marketing-02",
        "title": "Бренд-студия",
        "order": 2
      },
      {
        "id": "marketing-03",
        "title": "МедиаЛаб",
        "order": 3
      },
      {
        "id": "marketing-04",
        "title": "PR и репутация",
        "order": 4
      },
      {
        "id": "marketing-05",
        "title": "Редакция и фактчекинг",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "hubspot",
        "title": "HubSpot Academy",
        "url": "https://www.hubspot.com/RESOURCES/courses/marketing",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "openlearn",
        "title": "OpenLearn: free courses",
        "url": "https://www.open.edu/openlearn/free-courses/full-catalogue",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "international",
    "title": "Международные отношения, политика и госуправление",
    "titles": {
      "ru": "Международные отношения, политика и госуправление",
      "en": "International relations and politics",
      "kk": "Халықаралық қатынастар және саясат"
    },
    "emoji": "🌍",
    "group": "Бизнес и общество",
    "description": "Дипломатия, политология, публичная политика и госуправление",
    "aliases": "дипломат политолог международник государственная служба",
    "specialties": [
      "Дипломатия",
      "политология",
      "публичная политика и госуправление"
    ],
    "modules": [
      {
        "id": "international-01",
        "title": "Дипломатический клуб",
        "order": 1
      },
      {
        "id": "international-02",
        "title": "Геополитический радар",
        "order": 2
      },
      {
        "id": "international-03",
        "title": "Policy Lab",
        "order": 3
      },
      {
        "id": "international-04",
        "title": "Модель ООН",
        "order": 4
      },
      {
        "id": "international-05",
        "title": "Государство в действии",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "yale",
        "title": "Open Yale Courses",
        "url": "https://oyc.yale.edu/courses",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "owid",
        "title": "Our World in Data",
        "url": "https://ourworldindata.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "law",
    "title": "Юриспруденция",
    "titles": {
      "ru": "Юриспруденция",
      "en": "Law",
      "kk": "Құқықтану"
    },
    "emoji": "⚖️",
    "group": "Бизнес и общество",
    "description": "Гражданское, конституционное, уголовное, международное и цифровое право",
    "aliases": "юрист адвокат прокурор судья право",
    "specialties": [
      "Гражданское",
      "конституционное",
      "уголовное",
      "международное и цифровое право"
    ],
    "modules": [
      {
        "id": "law-01",
        "title": "Legal Lab",
        "order": 1
      },
      {
        "id": "law-02",
        "title": "Судебные дебаты",
        "order": 2
      },
      {
        "id": "law-03",
        "title": "Конструктор договоров",
        "order": 3
      },
      {
        "id": "law-04",
        "title": "Права и общество",
        "order": 4
      },
      {
        "id": "law-05",
        "title": "Digital Law",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "adilet",
        "title": "Әділет — законодательство РК",
        "url": "https://adilet.zan.kz/rus",
        "mode": "external",
        "language": "ru/kk",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "openlearn",
        "title": "OpenLearn: free courses",
        "url": "https://www.open.edu/openlearn/free-courses/full-catalogue",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "linguistics",
    "title": "Лингвистика, филология и перевод",
    "titles": {
      "ru": "Лингвистика, филология и перевод",
      "en": "Languages and linguistics",
      "kk": "Тілдер және лингвистика"
    },
    "emoji": "🗣️",
    "group": "Человек и образование",
    "description": "Языки, филология, перевод и прикладная лингвистика",
    "aliases": "переводчик лингвист филолог языки литература",
    "specialties": [
      "Языки",
      "филология",
      "перевод и прикладная лингвистика"
    ],
    "modules": [
      {
        "id": "linguistics-01",
        "title": "Language Lab",
        "order": 1
      },
      {
        "id": "linguistics-02",
        "title": "Переводческая студия",
        "order": 2
      },
      {
        "id": "linguistics-03",
        "title": "Текст под микроскопом",
        "order": 3
      },
      {
        "id": "linguistics-04",
        "title": "Межкультурный диалог",
        "order": 4
      },
      {
        "id": "linguistics-05",
        "title": "Корпусная мастерская",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "ling",
        "title": "MIT: Introduction to Linguistics",
        "url": "https://ocw.mit.edu/courses/24-900-introduction-to-linguistics-spring-2022/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "cambridge",
        "title": "Cambridge English: Activities",
        "url": "https://www.cambridgeenglish.org/learning-english/activities-for-learners/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "humanities",
    "title": "История, философия и культурное наследие",
    "titles": {
      "ru": "История, философия и культурное наследие",
      "en": "History and humanities",
      "kk": "Тарих және гуманитарлық ғылымдар"
    },
    "emoji": "🏛️",
    "group": "Человек и образование",
    "description": "История, археология, философия, религиоведение и культурное наследие",
    "aliases": "историк философ археолог культуролог религиоведение",
    "specialties": [
      "История",
      "археология",
      "философия",
      "религиоведение и культурное наследие"
    ],
    "modules": [
      {
        "id": "humanities-01",
        "title": "Исторический детектив",
        "order": 1
      },
      {
        "id": "humanities-02",
        "title": "Философский клуб",
        "order": 2
      },
      {
        "id": "humanities-03",
        "title": "АрхеоЛаб",
        "order": 3
      },
      {
        "id": "humanities-04",
        "title": "Культурный код",
        "order": 4
      },
      {
        "id": "humanities-05",
        "title": "Аргумент и логика",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "yale",
        "title": "Open Yale Courses",
        "url": "https://oyc.yale.edu/courses",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "openlearn",
        "title": "OpenLearn: free courses",
        "url": "https://www.open.edu/openlearn/free-courses/full-catalogue",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "psychology",
    "title": "Психология и когнитивные науки",
    "titles": {
      "ru": "Психология и когнитивные науки",
      "en": "Psychology and cognitive science",
      "kk": "Психология және когнитивтік ғылымдар"
    },
    "emoji": "🧠",
    "group": "Человек и образование",
    "description": "Познание, развитие, поведение и исследовательские методы",
    "aliases": "психолог когнитивист психология",
    "specialties": [
      "Познание",
      "развитие",
      "поведение и исследовательские методы"
    ],
    "modules": [
      {
        "id": "psychology-01",
        "title": "MindLab",
        "order": 1
      },
      {
        "id": "psychology-02",
        "title": "Когнитивный эксперимент",
        "order": 2
      },
      {
        "id": "psychology-03",
        "title": "Психология развития",
        "order": 3
      },
      {
        "id": "psychology-04",
        "title": "Люди и поведение",
        "order": 4
      },
      {
        "id": "psychology-05",
        "title": "Исследовательская этика",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "noba",
        "title": "Noba Psychology",
        "url": "https://nobaproject.com/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "yale",
        "title": "Open Yale Courses",
        "url": "https://oyc.yale.edu/courses",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "society",
    "title": "Социология, антропология и социальная работа",
    "titles": {
      "ru": "Социология, антропология и социальная работа",
      "en": "Sociology and social work",
      "kk": "Әлеуметтану және әлеуметтік жұмыс"
    },
    "emoji": "🤝",
    "group": "Человек и образование",
    "description": "Социология, антропология, общественные исследования и социальные проекты",
    "aliases": "социолог антрополог социальный работник общество",
    "specialties": [
      "Социология",
      "антропология",
      "общественные исследования и социальные проекты"
    ],
    "modules": [
      {
        "id": "society-01",
        "title": "Общество в данных",
        "order": 1
      },
      {
        "id": "society-02",
        "title": "Полевой дневник",
        "order": 2
      },
      {
        "id": "society-03",
        "title": "Социальный эксперимент",
        "order": 3
      },
      {
        "id": "society-04",
        "title": "Город и сообщества",
        "order": 4
      },
      {
        "id": "society-05",
        "title": "Impact Lab",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "yale",
        "title": "Open Yale Courses",
        "url": "https://oyc.yale.edu/courses",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "owid",
        "title": "Our World in Data",
        "url": "https://ourworldindata.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "education",
    "title": "Педагогика и образовательные технологии",
    "titles": {
      "ru": "Педагогика и образовательные технологии",
      "en": "Education and learning technology",
      "kk": "Педагогика және білім беру технологиялары"
    },
    "emoji": "🎓",
    "group": "Человек и образование",
    "description": "Преподавание, дошкольное и специальное образование, EdTech",
    "aliases": "учитель педагог воспитатель дефектолог методист",
    "specialties": [
      "Преподавание",
      "дошкольное и специальное образование",
      "EdTech"
    ],
    "modules": [
      {
        "id": "education-01",
        "title": "Учительская лаборатория",
        "order": 1
      },
      {
        "id": "education-02",
        "title": "Дизайн урока",
        "order": 2
      },
      {
        "id": "education-03",
        "title": "EdTech Studio",
        "order": 3
      },
      {
        "id": "education-04",
        "title": "Инклюзивная практика",
        "order": 4
      },
      {
        "id": "education-05",
        "title": "Оценивание без догадок",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "unesco",
        "title": "UNESCO Global Teacher Campus",
        "url": "https://www.unesco.org/en/global-education-coalition/teacher-campus?hub=132423",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "openlearn",
        "title": "OpenLearn: free courses",
        "url": "https://www.open.edu/openlearn/free-courses/full-catalogue",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "medicine",
    "title": "Медицина, биомедицина и фармация",
    "titles": {
      "ru": "Медицина, биомедицина и фармация",
      "en": "Medicine and pharmacy",
      "kk": "Медицина және фармация"
    },
    "emoji": "🩺",
    "group": "Наука и здоровье",
    "description": "Медицина, стоматология, биомедицина, фармация и общественное здоровье",
    "aliases": "врач стоматолог фармацевт медсестра биомедик",
    "specialties": [
      "Медицина",
      "стоматология",
      "биомедицина",
      "фармация и общественное здоровье"
    ],
    "modules": [
      {
        "id": "medicine-01",
        "title": "Анатомия 360",
        "order": 1
      },
      {
        "id": "medicine-02",
        "title": "Биомед-лаборатория",
        "order": 2
      },
      {
        "id": "medicine-03",
        "title": "Фарма: молекулы и механизмы",
        "order": 3
      },
      {
        "id": "medicine-04",
        "title": "Общественное здоровье",
        "order": 4
      },
      {
        "id": "medicine-05",
        "title": "Медицинское мышление",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "ncbi",
        "title": "NCBI Bookshelf",
        "url": "https://www.ncbi.nlm.nih.gov/books/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "who",
        "title": "OpenWHO",
        "url": "https://openwho.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "biology",
    "title": "Биология и биотехнологии",
    "titles": {
      "ru": "Биология и биотехнологии",
      "en": "Biology and biotechnology",
      "kk": "Биология және биотехнология"
    },
    "emoji": "🧬",
    "group": "Наука и здоровье",
    "description": "Генетика, клеточная биология, микробиология, биотехнологии",
    "aliases": "биолог генетик биотехнолог биоинформатик",
    "specialties": [
      "Генетика",
      "клеточная биология",
      "микробиология",
      "биотехнологии"
    ],
    "modules": [
      {
        "id": "biology-01",
        "title": "Genome Lab",
        "order": 1
      },
      {
        "id": "biology-02",
        "title": "Клетка в действии",
        "order": 2
      },
      {
        "id": "biology-03",
        "title": "Биоинженерный трек",
        "order": 3
      },
      {
        "id": "biology-04",
        "title": "Эволюционный детектив",
        "order": 4
      },
      {
        "id": "biology-05",
        "title": "BioData Studio",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "hhmi",
        "title": "HHMI BioInteractive",
        "url": "https://www.biointeractive.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "yale",
        "title": "Open Yale Courses",
        "url": "https://oyc.yale.edu/courses",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "chemistry",
    "title": "Химия и материаловедение",
    "titles": {
      "ru": "Химия и материаловедение",
      "en": "Chemistry and materials",
      "kk": "Химия және материалтану"
    },
    "emoji": "🧪",
    "group": "Наука и здоровье",
    "description": "Химические процессы, аналитика, органика и материалы",
    "aliases": "химик материаловед химия",
    "specialties": [
      "Химические процессы",
      "аналитика",
      "органика и материалы"
    ],
    "modules": [
      {
        "id": "chemistry-01",
        "title": "Молекулярная мастерская",
        "order": 1
      },
      {
        "id": "chemistry-02",
        "title": "Реакционный движок",
        "order": 2
      },
      {
        "id": "chemistry-03",
        "title": "Аналитическая лаборатория",
        "order": 3
      },
      {
        "id": "chemistry-04",
        "title": "Материалы будущего",
        "order": 4
      },
      {
        "id": "chemistry-05",
        "title": "Зелёная химия",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "chem",
        "title": "ChemCollective",
        "url": "https://chemcollective.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "phet",
        "title": "PhET",
        "url": "https://phet.colorado.edu/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "physics",
    "title": "Физика и астрономия",
    "titles": {
      "ru": "Физика и астрономия",
      "en": "Physics and astronomy",
      "kk": "Физика және астрономия"
    },
    "emoji": "🔭",
    "group": "Наука и здоровье",
    "description": "Механика, электромагнетизм, оптика, современная физика и космос",
    "aliases": "физик астроном астрофизик",
    "specialties": [
      "Механика",
      "электромагнетизм",
      "оптика",
      "современная физика и космос"
    ],
    "modules": [
      {
        "id": "physics-01",
        "title": "Физика в моделях",
        "order": 1
      },
      {
        "id": "physics-02",
        "title": "Электромагнитный полигон",
        "order": 2
      },
      {
        "id": "physics-03",
        "title": "Квантовый старт",
        "order": 3
      },
      {
        "id": "physics-04",
        "title": "Космическая обсерватория",
        "order": 4
      },
      {
        "id": "physics-05",
        "title": "Эксперимент и погрешность",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "yale",
        "title": "Open Yale Courses",
        "url": "https://oyc.yale.edu/courses",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "phet",
        "title": "PhET",
        "url": "https://phet.colorado.edu/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "mathematics",
    "title": "Математика, статистика и исследование операций",
    "titles": {
      "ru": "Математика, статистика и исследование операций",
      "en": "Mathematics and statistics",
      "kk": "Математика және статистика"
    },
    "emoji": "📐",
    "group": "Наука и здоровье",
    "description": "Доказательства, моделирование, вероятность, статистика и оптимизация",
    "aliases": "математик статистик исследование операций",
    "specialties": [
      "Доказательства",
      "моделирование",
      "вероятность",
      "статистика и оптимизация"
    ],
    "modules": [
      {
        "id": "mathematics-01",
        "title": "Доказательная мастерская",
        "order": 1
      },
      {
        "id": "mathematics-02",
        "title": "Math Modeling",
        "order": 2
      },
      {
        "id": "mathematics-03",
        "title": "Вероятностный движок",
        "order": 3
      },
      {
        "id": "mathematics-04",
        "title": "Статистика в деле",
        "order": 4
      },
      {
        "id": "mathematics-05",
        "title": "Оптимизация решений",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "linear",
        "title": "MIT: Linear Algebra",
        "url": "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "openintro",
        "title": "OpenIntro Statistics",
        "url": "https://www.openintro.org/book/os/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "earth",
    "title": "Науки о Земле, география и экология",
    "titles": {
      "ru": "Науки о Земле, география и экология",
      "en": "Earth and environmental science",
      "kk": "Жер туралы ғылымдар және экология"
    },
    "emoji": "🌱",
    "group": "Наука и здоровье",
    "description": "География, геология, климат, геоинформатика и природопользование",
    "aliases": "географ геолог эколог климатолог геодезист gis",
    "specialties": [
      "География",
      "геология",
      "климат",
      "геоинформатика и природопользование"
    ],
    "modules": [
      {
        "id": "earth-01",
        "title": "Планета в данных",
        "order": 1
      },
      {
        "id": "earth-02",
        "title": "GeoLab",
        "order": 2
      },
      {
        "id": "earth-03",
        "title": "Климатический радар",
        "order": 3
      },
      {
        "id": "earth-04",
        "title": "GIS-мастерская",
        "order": 4
      },
      {
        "id": "earth-05",
        "title": "Экологический аудит",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "qgis",
        "title": "QGIS Training Manual",
        "url": "https://docs.qgis.org/3.44/en/docs/training_manual/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "owid",
        "title": "Our World in Data",
        "url": "https://ourworldindata.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "agriculture",
    "title": "Агронауки, ветеринария и пищевые технологии",
    "titles": {
      "ru": "Агронауки, ветеринария и пищевые технологии",
      "en": "Agriculture and food science",
      "kk": "Аграрлық ғылымдар және тағам технологиялары"
    },
    "emoji": "🌾",
    "group": "Наука и здоровье",
    "description": "Агрономия, ветеринария, лесное хозяйство и пищевые технологии",
    "aliases": "агроном ветеринар животновод лесник пищевой технолог аквакультура",
    "specialties": [
      "Агрономия",
      "ветеринария",
      "лесное хозяйство и пищевые технологии"
    ],
    "modules": [
      {
        "id": "agriculture-01",
        "title": "AgroTech Lab",
        "order": 1
      },
      {
        "id": "agriculture-02",
        "title": "Ветеринарный старт",
        "order": 2
      },
      {
        "id": "agriculture-03",
        "title": "Food Science",
        "order": 3
      },
      {
        "id": "agriculture-04",
        "title": "Лес и водные системы",
        "order": 4
      },
      {
        "id": "agriculture-05",
        "title": "Устойчивое хозяйство",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "fao",
        "title": "FAO elearning Academy",
        "url": "https://elearning.fao.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "hhmi",
        "title": "HHMI BioInteractive",
        "url": "https://www.biointeractive.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "design",
    "title": "Дизайн и визуальные искусства",
    "titles": {
      "ru": "Дизайн и визуальные искусства",
      "en": "Design and visual arts",
      "kk": "Дизайн және бейнелеу өнері"
    },
    "emoji": "🎨",
    "group": "Творчество и сервис",
    "description": "Графический, цифровой, промышленный, интерьерный и fashion-дизайн",
    "aliases": "дизайнер художник ux ui мода интерьер",
    "specialties": [
      "Графический",
      "цифровой",
      "промышленный",
      "интерьерный и fashion-дизайн"
    ],
    "modules": [
      {
        "id": "design-01",
        "title": "Визуальная лаборатория",
        "order": 1
      },
      {
        "id": "design-02",
        "title": "UX/UI Studio",
        "order": 2
      },
      {
        "id": "design-03",
        "title": "3D и предметный дизайн",
        "order": 3
      },
      {
        "id": "design-04",
        "title": "Материал и форма",
        "order": 4
      },
      {
        "id": "design-05",
        "title": "Портфолио-ателье",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "blender",
        "title": "Blender Manual",
        "url": "https://www.blender.org/support/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "inkscape",
        "title": "Inkscape: learning",
        "url": "https://inkscape.org/learn/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "arts",
    "title": "Музыка, кино, сценические искусства и арт-индустрия",
    "titles": {
      "ru": "Музыка, кино, сценические искусства и арт-индустрия",
      "en": "Music and performing arts",
      "kk": "Музыка және сахна өнері"
    },
    "emoji": "🎬",
    "group": "Творчество и сервис",
    "description": "Музыка, кино, сценические искусства и продюсирование",
    "aliases": "музыкант актер режиссер продюсер звукорежиссер кино",
    "specialties": [
      "Музыка",
      "кино",
      "сценические искусства и продюсирование"
    ],
    "modules": [
      {
        "id": "arts-01",
        "title": "SoundLab",
        "order": 1
      },
      {
        "id": "arts-02",
        "title": "Киноцех",
        "order": 2
      },
      {
        "id": "arts-03",
        "title": "Сценическая мастерская",
        "order": 3
      },
      {
        "id": "arts-04",
        "title": "Арт-продюсирование",
        "order": 4
      },
      {
        "id": "arts-05",
        "title": "Творческое прослушивание",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "ableton",
        "title": "Ableton Learning Music",
        "url": "https://learningmusic.ableton.com/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "music",
        "title": "musictheory.net",
        "url": "https://www.musictheory.net/lessons",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "hospitality",
    "title": "Туризм, гостеприимство и сервис",
    "titles": {
      "ru": "Туризм, гостеприимство и сервис",
      "en": "Tourism and hospitality",
      "kk": "Туризм және қонақжайлылық"
    },
    "emoji": "🧳",
    "group": "Творчество и сервис",
    "description": "Туризм, гостиничное и ресторанное дело, мероприятия и сервис",
    "aliases": "отель ресторан туроператор туризм event сервис",
    "specialties": [
      "Туризм",
      "гостиничное и ресторанное дело",
      "мероприятия и сервис"
    ],
    "modules": [
      {
        "id": "hospitality-01",
        "title": "Travel Designer",
        "order": 1
      },
      {
        "id": "hospitality-02",
        "title": "Hospitality Lab",
        "order": 2
      },
      {
        "id": "hospitality-03",
        "title": "Event Factory",
        "order": 3
      },
      {
        "id": "hospitality-04",
        "title": "Сервисный интеллект",
        "order": 4
      },
      {
        "id": "hospitality-05",
        "title": "Туризм без следа",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "openlearn",
        "title": "OpenLearn: free courses",
        "url": "https://www.open.edu/openlearn/free-courses/full-catalogue",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "hp",
        "title": "HP LIFE",
        "url": "https://www.hplife.org/",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  },
  {
    "id": "sport",
    "title": "Спорт, физическая культура и реабилитационные науки",
    "titles": {
      "ru": "Спорт, физическая культура и реабилитационные науки",
      "en": "Sport and movement science",
      "kk": "Спорт және қозғалыс ғылымдары"
    },
    "emoji": "🏃",
    "group": "Творчество и сервис",
    "description": "Тренерство, спортивная наука, адаптивная физкультура и реабилитационные науки",
    "aliases": "спортсмен тренер реабилитолог физкультура биомеханика",
    "specialties": [
      "Тренерство",
      "спортивная наука",
      "адаптивная физкультура и реабилитационные науки"
    ],
    "modules": [
      {
        "id": "sport-01",
        "title": "Performance Lab",
        "order": 1
      },
      {
        "id": "sport-02",
        "title": "Биомеханика движения",
        "order": 2
      },
      {
        "id": "sport-03",
        "title": "Тренерская мастерская",
        "order": 3
      },
      {
        "id": "sport-04",
        "title": "Спортивная аналитика",
        "order": 4
      },
      {
        "id": "sport-05",
        "title": "Движение и восстановление",
        "order": 5
      }
    ],
    "sources": [
      {
        "id": "sport",
        "title": "OpenLearn Sport and Fitness",
        "url": "https://www.open.edu/openlearn/sport-fitness-hub",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      },
      {
        "id": "coach",
        "title": "OpenLearn: Coaching and Psychology",
        "url": "https://www.open.edu/openlearn/mod/oucontent/view.php?id=65514",
        "mode": "external",
        "language": "en",
        "checkedAt": "2026-11-03"
      }
    ],
    "tools": []
  }
];
export function getDirection(id: unknown): Direction|undefined { return typeof id === "string" ? DIRECTIONS.find(d=>d.id===id) : undefined; }
export function validateDirectionId(id: unknown): string { const d=getDirection(id); if(!d) throw new Error("Выберите одно направление из каталога"); return d.id; }
export function findDirections(query: string): Direction[] { const q=query.trim().toLocaleLowerCase().replace(/ё/g,"е"); return DIRECTIONS.filter(d=>[d.title,...Object.values(d.titles),d.description,d.aliases,...d.modules.map(m=>m.title)].join(" ").toLocaleLowerCase().replace(/ё/g,"е").includes(q)); }
export function directionModule(id: string) { for(const direction of DIRECTIONS) { const module=direction.modules.find(m=>m.id===id); if(module)return {direction,module}; } return undefined; }
