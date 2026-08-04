// Ukrainian mirror of resources.data.ts. Link titles/URLs, platform names/URLs stay untranslated
// (they identify external resources; several titles literally end in "EN" marking the linked
// article as English-language — translating the title would misrepresent that).
import type { BestPracticeGroup, Platform, CheatSection } from "./resources.data.js";

export const BEST_PRACTICES_UK: BestPracticeGroup[] = [
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
    group: "Node.js / Бекенд",
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
    group: "React / Фронтенд",
    links: [
      {
        t: "Thinking in React EN",
        u: "https://react.dev/learn/thinking-in-react",
      },
      {
        t: "Bulletproof React (architecture) EN",
        u: "https://github.com/alan2207/bulletproof-react",
      },
      {
        t: "web.dev — performance/PWA EN",
        u: "https://web.dev/learn/",
      },
    ],
  },
  {
    group: "Архітектура, бази даних, системний дизайн",
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

export const PLATFORMS_UK: Platform[] = [
  {
    group: "🧩 Алгоритми та задачі",
    name: "LeetCode",
    url: "https://leetcode.com/",
    note: "Головний ресурс для алгоритмічних співбесід, є JS",
  },
  {
    group: "🧩 Алгоритми та задачі",
    name: "Codewars",
    url: "https://www.codewars.com/",
    note: "Гейміфіковані завдання-«kata», багато JS/TS",
  },
  {
    group: "🧩 Алгоритми та задачі",
    name: "Exercism",
    url: "https://exercism.org/tracks/javascript",
    note: "Треки JS/TS + безкоштовний фідбек від менторів",
  },
  {
    group: "🧩 Алгоритми та задачі",
    name: "NeetCode",
    url: "https://neetcode.io/practice",
    note: "Структурована дорожня карта + відеорозбори",
  },
  {
    group: "🧩 Алгоритми та задачі",
    name: "Frontend Mentor",
    url: "https://www.frontendmentor.io/",
    note: "Реальні фронтенд/верстка завдання (практика React/Vue)",
  },
  {
    group: "🎤 Пробні співбесіди (жива розмова)",
    name: "Pramp / Exponent",
    url: "https://www.tryexponent.com/practice",
    note: "Peer-to-peer: ви з іншим інженером по черзі проводите співбесіду одне одному",
  },
  {
    group: "🎤 Пробні співбесіди (жива розмова)",
    name: "interviewing.io",
    url: "https://interviewing.io/",
    note: "Анонімні пробні співбесіди з інженерами з топових компаній",
  },
  {
    group: "💻 Онлайн-редактори (репетиція кодингу «в стилі співбесіди»)",
    name: "StackBlitz",
    url: "https://stackblitz.com/",
    note: "Повноцінні проєкти Node/React/Vue/Angular прямо в браузері",
  },
  {
    group: "💻 Онлайн-редактори (репетиція кодингу «в стилі співбесіди»)",
    name: "CodeSandbox",
    url: "https://codesandbox.io/",
    note: "Швидкі фронтенд/full-stack пісочниці (чудово для практики React)",
  },
  {
    group: "💻 Онлайн-редактори (репетиція кодингу «в стилі співбесіди»)",
    name: "TS Playground",
    url: "https://www.typescriptlang.org/play",
    note: "Перевірка типів TypeScript",
  },
  {
    group: "💻 Онлайн-редактори (репетиція кодингу «в стилі співбесіди»)",
    name: "DB Fiddle",
    url: "https://www.db-fiddle.com/",
    note: "Практика SQL-запитів (PostgreSQL/MySQL) онлайн",
  },
];

export const CHEAT_UK: CheatSection[] = [
  {
    title: "JavaScript в одному рядку",
    items: [
      "Event loop: синхронний код → мікрозадачі (Promise) → 1 макрозадача (setTimeout)",
      "Замикання (closure): функція пам'ятає свої зовнішні змінні",
      "let/const мають блокову область видимості + TDZ; var — функціональну область видимості",
      "Завжди використовуйте ===; x == null ловить одразу null і undefined",
      "Promise.all виконується паралельно і відхиляється (reject) на першій помилці; allSettled ніколи не відхиляється",
    ],
  },
  {
    title: "TypeScript",
    items: [
      "interface — об'єкти/declaration merging; type — union-и/utility types",
      "unknown безпечніший за any; never означає недосяжний код",
      "Generics + extends для обмежень",
    ],
  },
  {
    title: "Node / Nest",
    items: [
      "Однопотоковий + пул потоків libuv; CPU-важка робота → worker_threads",
      "DI = залежності інжектуються через конструктор, легко мокати",
      "Guards (авторизація) · Pipes (валідація) · Interceptors · Filters (помилки)",
    ],
  },
  {
    title: "React",
    items: [
      "Virtual DOM + diffing; key для списків",
      "useEffect: deps = коли повторно спрацьовує; return = cleanup",
      "useMemo кешує значення; useCallback кешує функцію",
      "Hooks — тільки на верхньому рівні, у незмінному порядку",
    ],
  },
  {
    title: "Бази даних",
    items: [
      "SQL — консистентність/зв'язки; NoSQL — гнучкість/масштабованість",
      "Індекс = швидше читання, повільніший запис; перевіряти через EXPLAIN",
      "N+1 → eager load / JOIN",
      "ACID, транзакції для платежів",
    ],
  },
  {
    title: "Системний дизайн",
    items: [
      "Профілювання → кеш (Redis/CDN) → репліки → черга → шардинг",
      "Черга = розв'язування залежностей + згладжування сплесків трафіку",
    ],
  },
  {
    title: "Питання, які варто поставити їм (підготуйте свої!)",
    items: ["Який стек і чому? Як виглядає команда?", "Як тестуєте і деплоїте? Чи є технічний борг?", "Які наступні етапи співбесіди?"],
  },
];

export const CHECKLIST_UK: string[] = [
  "React: hooks, re-render-и, TanStack Query — переписав 1-2 своїх компоненти з Vue на React",
  "React: зробив міні-проєкт (CRUD + fetch) на React + TypeScript",
  "Next.js: вивчив основи SSR/SSG, app router",
  "SQL: пройшов SQLBolt + PostgreSQL Exercises",
  "SQL: можу пояснити індекси, транзакції, N+1, SQL vs NoSQL",
  "SQL: зробив застосунок на Nest + Prisma/TypeORM з PostgreSQL",
  "TypeScript: generics, utility types, пройшов 5+ type-challenges",
  "JS core: event loop, closures, async — можу впевнено пояснити",
  "Node/Nest: освіжив DI, guards, pipes, обробку помилок, черги",
  "Docker: написав Dockerfile (multi-stage) + docker-compose",
  "AWS: зіставив сервіси з еквівалентами Azure, вивчив S3/Lambda/RDS/SQS",
  "Алгоритми: NeetCode 75 або 30+ задач на LeetCode",
  "System Design: розібрав 3+ типових дизайни (масштабування, кеш, MQ)",
  "Питання: пройшов усі Q&A в розділі 10, можу відповісти своїми словами",
  "Behavioral: підготував 3 STAR-історії + відповідь про свій AI-воркфлоу",
  "Mock: провів 2+ пробні співбесіди на Pramp/interviewing.io",
  "Портфоліо: пет-проєкт TaskFlow (React+Nest+PostgreSQL+Docker) на GitHub",
];
