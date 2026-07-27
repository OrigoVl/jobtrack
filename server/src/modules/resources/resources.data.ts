// Ресурси з гайду: best practices, майданчики, шпаргалка, чек-лист.
export interface Link {
  t: string;
  u: string;
}

export interface BestPracticeGroup {
  group: string;
  links: Link[];
}

export const BEST_PRACTICES: BestPracticeGroup[] = [
  {
    group: "JavaScript / TypeScript",
    links: [
      {
        t: "Clean Code JavaScript EN",
        u: "https://github.com/ryanmcdermott/clean-code-javascript",
      },
      {
        t: "Airbnb JS Style Guide EN",
        u: "https://github.com/airbnb/javascript",
      },
      {
        t: "Google TypeScript Style Guide EN",
        u: "https://google.github.io/styleguide/tsguide.html",
      },
    ],
  },
  {
    group: "Node.js / Backend",
    links: [
      {
        t: "Node.js Best Practices EN",
        u: "https://github.com/goldbergyoni/nodebestpractices",
      },
      {
        t: "NestJS Security EN",
        u: "https://docs.nestjs.com/techniques/security",
      },
      {
        t: "The Twelve-Factor App EN",
        u: "https://12factor.net/",
      },
      {
        t: "JS Testing Best Practices EN",
        u: "https://github.com/goldbergyoni/javascript-testing-best-practices",
      },
    ],
  },
  {
    group: "React / Frontend",
    links: [
      {
        t: "Thinking in React EN",
        u: "https://react.dev/learn/thinking-in-react",
      },
      {
        t: "Bulletproof React (архітектура) EN",
        u: "https://github.com/alan2207/bulletproof-react",
      },
      {
        t: "web.dev — performance/PWA EN",
        u: "https://web.dev/learn/",
      },
    ],
  },
  {
    group: "Архітектура, БД, дизайн систем",
    links: [
      {
        t: "System Design Primer EN",
        u: "https://github.com/donnemartin/system-design-primer",
      },
      {
        t: "System Design 101 EN",
        u: "https://github.com/ByteByteGoHq/system-design-101",
      },
      {
        t: "Use The Index, Luke (SQL) EN",
        u: "https://use-the-index-luke.com/",
      },
      {
        t: "roadmap.sh — Full Stack EN",
        u: "https://roadmap.sh/full-stack",
      },
      {
        t: "Design Patterns (awesome) EN",
        u: "https://github.com/DovAmir/awesome-design-patterns",
      },
    ],
  },
  {
    group: "Підготовка до співбесід",
    links: [
      {
        t: "Tech Interview Handbook EN",
        u: "https://www.techinterviewhandbook.org/",
      },
      {
        t: "Front-End Interview Handbook EN",
        u: "https://github.com/yangshun/front-end-interview-handbook",
      },
      {
        t: "NeetCode Roadmap EN",
        u: "https://neetcode.io/roadmap",
      },
    ],
  },
];

export interface Platform {
  group: string;
  name: string;
  url: string;
  note: string;
}

export const PLATFORMS: Platform[] = [
  {
    group: "🧩 Алгоритми та задачі",
    name: "LeetCode",
    url: "https://leetcode.com/",
    note: "Головна для алгоритмічних співбесід, є JS",
  },
  {
    group: "🧩 Алгоритми та задачі",
    name: "Codewars",
    url: "https://www.codewars.com/",
    note: "Гейміфіковані «ката», багато JS/TS",
  },
  {
    group: "🧩 Алгоритми та задачі",
    name: "Exercism",
    url: "https://exercism.org/tracks/javascript",
    note: "JS/TS треки + безкоштовний ментор-фідбек",
  },
  {
    group: "🧩 Алгоритми та задачі",
    name: "NeetCode",
    url: "https://neetcode.io/practice",
    note: "Структурований roadmap + відео-розбори",
  },
  {
    group: "🧩 Алгоритми та задачі",
    name: "Frontend Mentor",
    url: "https://www.frontendmentor.io/",
    note: "Реальні фронт/верстка челенджі (React/Vue практика)",
  },
  {
    group: "🎤 Mock-інтерв'ю (живий діалог)",
    name: "Pramp / Exponent",
    url: "https://www.tryexponent.com/practice",
    note: "Peer-to-peer: ти й інший інженер по черзі інтерв'юєте одне одного",
  },
  {
    group: "🎤 Mock-інтерв'ю (живий діалог)",
    name: "interviewing.io",
    url: "https://interviewing.io/",
    note: "Анонімні mock з інженерами топ-компаній",
  },
  {
    group: "💻 Онлайн-редактори (репетирувати «як на співбесіді»)",
    name: "StackBlitz",
    url: "https://stackblitz.com/",
    note: "Повноцінні Node/React/Vue/Angular проєкти в браузері",
  },
  {
    group: "💻 Онлайн-редактори (репетирувати «як на співбесіді»)",
    name: "CodeSandbox",
    url: "https://codesandbox.io/",
    note: "Швидкі фронт/фулстек пісочниці (ідеально для React-практики)",
  },
  {
    group: "💻 Онлайн-редактори (репетирувати «як на співбесіді»)",
    name: "TS Playground",
    url: "https://www.typescriptlang.org/play",
    note: "Перевірити типи TypeScript",
  },
  {
    group: "💻 Онлайн-редактори (репетирувати «як на співбесіді»)",
    name: "DB Fiddle",
    url: "https://www.db-fiddle.com/",
    note: "Тренувати SQL-запити (PostgreSQL/MySQL) онлайн",
  },
];

export interface CheatSection {
  title: string;
  items: string[];
}

export const CHEAT: CheatSection[] = [
  {
    title: "JavaScript одним рядком",
    items: [
      "Event loop: sync → мікротаски (Promise) → 1 макротаска (setTimeout)",
      "Closure: функція пам'ятає зовнішні змінні",
      "let/const — блокові + TDZ; var — функційна",
      "Завжди ===; x == null ловить null+undefined",
      "Promise.all — паралельно, падає на першій помилці; allSettled — не падає",
    ],
  },
  {
    title: "TypeScript",
    items: [
      "interface — об'єкти/merge; type — union/utility",
      "unknown безпечніший за any; never — недосяжне",
      "Generics + extends для обмежень",
    ],
  },
  {
    title: "Node / Nest",
    items: [
      "Single-thread + libuv thread pool; CPU-важке → worker_threads",
      "DI = залежності через конструктор, легко мокати",
      "Guards (auth) · Pipes (валідація) · Interceptors · Filters (помилки)",
    ],
  },
  {
    title: "React",
    items: [
      "Virtual DOM + diff; key для списків",
      "useEffect: deps = коли перезапуск; return = cleanup",
      "useMemo кешує значення; useCallback — функцію",
      "Хуки — лише на верхньому рівні, сталий порядок",
    ],
  },
  {
    title: "Бази даних",
    items: [
      "SQL — консистентність/зв'язки; NoSQL — гнучкість/масштаб",
      "Індекс = швидше читання, повільніший запис; перевір EXPLAIN",
      "N+1 → eager load / JOIN",
      "ACID, транзакції для платежів",
    ],
  },
  {
    title: "System design",
    items: ["Профілюй → кеш (Redis/CDN) → репліки → черга → шардинг", "Черга = decouple + згладжування піків"],
  },
  {
    title: "Питання ДО них (постав сам!)",
    items: ["Який стек і чому саме він? Як виглядає команда?", "Як тестуєте й деплоїте? Технічний борг?", "Етапи співбесіди далі?"],
  },
];

export const CHECKLIST: string[] = [
  "React: hooks, ре-рендери, TanStack Query — переписав 1–2 своїх Vue-компоненти на React",
  "React: зібрав міні-проєкт (CRUD + fetch) на React + TypeScript",
  "Next.js: розібрав SSR/SSG, app router (базово)",
  "SQL: пройшов SQLBolt + PostgreSQL Exercises",
  "SQL: вмію пояснити індекси, транзакції, N+1, SQL vs NoSQL",
  "SQL: зробив Nest + Prisma/TypeORM з PostgreSQL",
  "TypeScript: generics, utility types, пройшов 5+ type-challenges",
  "JS core: event loop, closures, async — проговорюю впевнено",
  "Node/Nest: освіжив DI, guards, pipes, обробку помилок, черги",
  "Docker: написав Dockerfile (multi-stage) + docker-compose",
  "AWS: зіставив сервіси з Azure, розібрав S3/Lambda/RDS/SQS",
  "Алгоритми: NeetCode 75 або 30+ задач LeetCode",
  "System Design: розібрав 3+ типові дизайни (scaling, cache, MQ)",
  "Питання: пройшов усі QA з розділу 10, відповідаю своїми словами",
  "Behavioral: підготував 3 STAR-історії + відповідь про AI-workflow",
  "Mock: провів 2+ mock-інтерв'ю на Pramp/interviewing.io",
  "Портфоліо: pet-проєкт TaskFlow (React+Nest+PostgreSQL+Docker) на GitHub",
];
