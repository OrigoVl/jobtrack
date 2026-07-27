import { CARDS, DRILLS } from "../study/content.js";

export interface Resource {
  t: string;
  u: string;
  /** Позначає посилання, згенеровані й провалідовані LLM (на відміну від курованих статичних). */
  ai?: boolean;
}

export interface KbEntry {
  cat: string | null;
  learn: string[];
  resources: Resource[];
}

// База знань: технологія -> що вчити + ресурси. + мапа на категорії карток/дрилів.
const R = (t: string, u: string): Resource => ({ t, u });
export const KB: Record<string, KbEntry> = {
  React: {
    cat: "React",
    learn: [
      "Hooks (useState/useEffect+cleanup, useMemo/useCallback/useRef)",
      "Ре-рендери, React.memo, key, reconciliation",
      "Стан: Context, Zustand/Redux Toolkit",
      "Дані: TanStack Query",
      "Основи Next.js (SSR/CSR)",
    ],
    resources: [
      R("React.dev — офіційний тур", "https://react.dev/learn"),
      R("TanStack Query", "https://tanstack.com/query/latest"),
      R("React Interview Questions", "https://github.com/sudheerj/reactjs-interview-questions"),
      R("Next.js Learn", "https://nextjs.org/learn"),
    ],
  },
  "Next.js": {
    cat: "React",
    learn: ["App Router, серверні компоненти", "SSR/SSG/ISR", "Data fetching, route handlers"],
    resources: [R("Next.js Learn", "https://nextjs.org/learn")],
  },
  TypeScript: {
    cat: "TypeScript",
    learn: [
      "interface vs type, union/intersection, narrowing",
      "Generics + extends",
      "Utility types (Partial/Pick/Omit/Record/ReturnType)",
      "unknown/never, discriminated unions",
      "Декоратори (для NestJS)",
    ],
    resources: [
      R("TS Handbook", "https://www.typescriptlang.org/docs/handbook/intro.html"),
      R("Total TypeScript", "https://www.totaltypescript.com/tutorials"),
      R("Type Challenges", "https://github.com/type-challenges/type-challenges"),
    ],
  },
  PostgreSQL: {
    cat: "SQL",
    learn: [
      "SELECT/JOIN/GROUP BY, підзапити, віконні функції",
      "Індекси (B-tree), EXPLAIN ANALYZE",
      "Транзакції/ACID, рівні ізоляції",
      "N+1 проблема, нормалізація",
      "ORM: Prisma / TypeORM",
    ],
    resources: [
      R("SQLBolt (інтерактивно)", "https://sqlbolt.com/"),
      R("PostgreSQL Exercises", "https://pgexercises.com/"),
      R("Use The Index, Luke", "https://use-the-index-luke.com/"),
      R("Prisma Docs", "https://www.prisma.io/docs"),
    ],
  },
  SQL: {
    cat: "SQL",
    learn: ["JOIN-и, агрегати, GROUP BY", "Індекси й EXPLAIN", "Транзакції, N+1"],
    resources: [R("SQLBolt", "https://sqlbolt.com/"), R("PostgreSQL Exercises", "https://pgexercises.com/")],
  },
  MySQL: {
    cat: "SQL",
    learn: ["JOIN, індекси, оптимізація запитів", "Транзакції, реплікація"],
    resources: [R("SQLBolt", "https://sqlbolt.com/")],
  },
  "Node.js": {
    cat: "Node.js",
    learn: [
      "Event loop (libuv), фази, thread pool",
      "Streams, backpressure, worker_threads",
      "Обробка помилок в async, graceful shutdown",
      "Безпека (helmet, rate limiting)",
    ],
    resources: [
      R("Node.js Learn", "https://nodejs.org/en/learn"),
      R("Node Best Practices", "https://github.com/goldbergyoni/nodebestpractices"),
    ],
  },
  NestJS: {
    cat: "NestJS",
    learn: [
      "Модулі, DI, provider scopes",
      "Guards / Pipes / Interceptors / Filters (порядок)",
      "DTO + class-validator",
      "JWT/Passport, TypeORM/Prisma",
    ],
    resources: [R("NestJS Docs", "https://docs.nestjs.com/"), R("NestJS Courses", "https://courses.nestjs.com/")],
  },
  Express: {
    cat: "Node.js",
    learn: ["Роутинг, middleware, error-handling", "Структура застосунку, валідація"],
    resources: [R("Express Guide", "https://expressjs.com/en/guide/routing.html")],
  },
  Docker: {
    cat: "Docker",
    learn: ["Dockerfile, шари й кеш, multi-stage", "docker-compose, volumes, networks", "Image vs container"],
    resources: [R("Docker Curriculum", "https://docker-curriculum.com/"), R("Docker Get Started", "https://docs.docker.com/get-started/")],
  },
  AWS: {
    cat: "System Design",
    learn: ["EC2/S3/Lambda/RDS/SQS (мапа з Azure)", "IAM, основи мереж", "Serverless базово"],
    resources: [R("AWS Skill Builder", "https://explore.skillbuilder.aws/")],
  },
  Kafka: {
    cat: "System Design",
    learn: ["Продюсер/консюмер, топіки, партиції", "Event-driven, гарантії доставки", "Kafka vs RabbitMQ"],
    resources: [R("System Design 101", "https://github.com/ByteByteGoHq/system-design-101")],
  },
  WebSockets: {
    cat: "Node.js",
    learn: ["ws/Socket.IO, Nest Gateway", "Реалтайм, presence", "Масштабування через Redis pub/sub"],
    resources: [R("Socket.IO Docs", "https://socket.io/docs/v4/")],
  },
  GraphQL: {
    cat: "API",
    learn: ["Схема, resolvers, queries/mutations", "Apollo, кешування", "REST vs GraphQL, N+1 (dataloader)"],
    resources: [R("GraphQL.org", "https://graphql.org/learn/")],
  },
  Redis: {
    cat: "System Design",
    learn: ["Кеш (cache-aside), TTL", "Pub/sub, черги, лідерборди", "Rate limiting"],
    resources: [R("Redis University", "https://redis.io/learn/")],
  },
  Jest: {
    cat: "Testing",
    learn: ["Піраміда тестів: unit/integration/e2e", "mocks/spies/stubs", "Supertest (API), coverage"],
    resources: [
      R("Jest Docs", "https://jestjs.io/docs/getting-started"),
      R("JS Testing Best Practices", "https://github.com/goldbergyoni/javascript-testing-best-practices"),
    ],
  },
  "AI/LLM": {
    cat: "AI",
    learn: [
      "LLM API: streaming, tool calling, JSON-відповіді",
      "RAG: ембединги + векторний пошук (pgvector)",
      "Prompt engineering, боротьба з галюцинаціями",
    ],
    resources: [
      R("OpenAI Docs", "https://platform.openai.com/docs/guides/text-generation"),
      R("Anthropic Docs", "https://docs.claude.com/en/docs/build-with-claude/overview"),
    ],
  },
  Angular: {
    cat: "TypeScript",
    learn: ["Компоненти, модулі, standalone", "RxJS та Observables", "DI, signals, reactive forms"],
    resources: [R("Angular.dev", "https://angular.dev/tutorials"), R("RxJS Docs", "https://rxjs.dev/guide/overview")],
  },
  RxJS: {
    cat: "TypeScript",
    learn: ["Observables, operators (map/switchMap/merge)", "Subjects, обробка помилок"],
    resources: [R("RxJS Docs", "https://rxjs.dev/guide/overview")],
  },
  "REST API": {
    cat: "API",
    learn: ["Методи, статус-коди, версіонування", "Ідемпотентність, пагінація", "OpenAPI/Swagger"],
    resources: [R("REST API Tutorial", "https://restfulapi.net/")],
  },
  Python: {
    cat: "System Design",
    learn: ["Синтаксис, типи, віртуальні оточення", "FastAPI/Django базово"],
    resources: [R("Python Docs", "https://docs.python.org/3/tutorial/")],
  },
  Go: {
    cat: "System Design",
    learn: ["Синтаксис, горутини, канали", "Стандартна бібліотека"],
    resources: [R("A Tour of Go", "https://go.dev/tour/")],
  },
  Kubernetes: {
    cat: "System Design",
    learn: ["Pods/Deployments/Services", "kubectl, конфіги"],
    resources: [R("Kubernetes Basics", "https://kubernetes.io/docs/tutorials/kubernetes-basics/")],
  },
  Vue: {
    cat: "Vue",
    learn: [
      "Composition API (ref/reactive/computed/watch)",
      "Компоненти: props/emit, slots, provide/inject",
      "Pinia (стан) + Vue Router",
      "Реактивність під капотом, lifecycle-хуки",
    ],
    resources: [
      R("Vue.js Docs", "https://vuejs.org/guide/introduction.html"),
      R("Vue School", "https://vueschool.io/"),
      R("Pinia", "https://pinia.vuejs.org/"),
    ],
  },
  Nuxt: {
    cat: "Vue",
    learn: ["Файловий роутинг, layouts", "SSR/SSG, useAsyncData/useFetch", "Nitro-сервер, модулі"],
    resources: [R("Nuxt Docs", "https://nuxt.com/docs")],
  },
  TailwindCSS: {
    cat: "HTML/CSS",
    learn: ["Utility-first, responsive-префікси", "Кастомізація theme, @apply", "Dark mode, компонування класів"],
    resources: [R("Tailwind Docs", "https://tailwindcss.com/docs")],
  },
  "HTML/CSS": {
    cat: "HTML/CSS",
    learn: ["Семантика й доступність (a11y, ARIA)", "Flexbox, Grid, responsive", "Специфічність, box model, позиціювання"],
    resources: [
      R("MDN HTML", "https://developer.mozilla.org/en-US/docs/Web/HTML"),
      R("Guide to Flexbox", "https://css-tricks.com/snippets/css/a-guide-to-flexbox/"),
      R("web.dev Learn CSS", "https://web.dev/learn/css"),
    ],
  },
  MongoDB: {
    cat: "Databases",
    learn: [
      "Документна модель, колекції, індекси",
      "Aggregation pipeline",
      "Схема-дизайн: вбудовування vs $lookup",
      "Транзакції, реплікасети",
    ],
    resources: [R("MongoDB University", "https://learn.mongodb.com/"), R("MongoDB Docs", "https://www.mongodb.com/docs/manual/")],
  },
  Prisma: {
    cat: "SQL",
    learn: ["Схема, міграції, генерація клієнта", "Relations, транзакції", "N+1 та include/select"],
    resources: [R("Prisma Docs", "https://www.prisma.io/docs")],
  },
  Azure: {
    cat: "System Design",
    learn: ["App Service, Functions, Blob Storage", "Cosmos DB, Service Bus", "IAM/RBAC, основи мереж"],
    resources: [R("Microsoft Learn — Azure", "https://learn.microsoft.com/en-us/training/azure/")],
  },
  GCP: {
    cat: "System Design",
    learn: ["Cloud Run, Functions, Compute Engine", "Cloud Storage, Pub/Sub", "IAM базово"],
    resources: [R("Google Cloud Skills Boost", "https://www.cloudskillsboost.google/")],
  },
  "CI/CD": {
    cat: "Git/Testing",
    learn: ["Pipeline: build → test → deploy", "GitHub Actions (workflows, secrets, matrix)", "Кешування й артефакти"],
    resources: [
      R("GitHub Actions Docs", "https://docs.github.com/en/actions"),
      R("CI/CD концепції", "https://about.gitlab.com/topics/ci-cd/"),
    ],
  },
  Playwright: {
    cat: "Git/Testing",
    learn: ["E2E: локатори, auto-wait", "Фікстури, паралелізм", "Trace viewer, CI-інтеграція"],
    resources: [R("Playwright Docs", "https://playwright.dev/docs/intro")],
  },
  Git: {
    cat: "Git/Testing",
    learn: ["merge vs rebase, cherry-pick", "Стратегії гілкування, вирішення конфліктів", "reset/revert, reflog, bisect"],
    resources: [R("Pro Git (книга)", "https://git-scm.com/book/en/v2"), R("Learn Git Branching", "https://learngitbranching.js.org/")],
  },
};

const GENERIC: KbEntry = { cat: null, learn: ["Основи та практика на реальних задачах"], resources: [R("roadmap.sh", "https://roadmap.sh/")] };

export function catFor(tech: string): string | null {
  return (KB[tech] || GENERIC).cat;
}

export interface KnowledgeBase {
  learn: string[];
  resources: Resource[];
  drills: { q: string; lvl: string }[];
  cards: { q: string }[];
}

export function kbFor(tech: string): KnowledgeBase {
  const base = KB[tech] || GENERIC;
  const cat = base.cat;
  const drills = cat ? DRILLS.filter((d) => d.cat === cat).map((d) => ({ q: d.q, lvl: d.lvl })) : [];
  const cards = cat ? CARDS.filter((c) => c.cat === cat).map((c) => ({ q: c.q })) : [];
  return { learn: base.learn, resources: base.resources, drills, cards };
}
