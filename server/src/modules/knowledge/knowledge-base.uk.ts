import { KB, type KbEntry } from "./knowledge-base.js";

// Ukrainian mirror of knowledge-base.ts: same keys/cat/resources, `learn` bullets translated.
// Wrapped in a function (rather than a top-level const) because knowledge-base.ts imports this
// module's export back — a genuine circular import. Reading `KB.X!.cat` at module-evaluation time
// would run before knowledge-base.ts finishes defining `KB` (whichever of the two loads first
// pauses partway through to load the other), leaving `KB` undefined. Calling this function lazily
// — after both modules have fully loaded — sidesteps that; see knowledge-base.ts's getKbUk().
export function buildKbUk(): Record<string, KbEntry> {
  return {
    React: {
      cat: KB.React!.cat,
      learn: [
        "Hooks (useState/useEffect+очищення, useMemo/useCallback/useRef)",
        "Ре-рендери, React.memo, keys, reconciliation",
        "Стан: Context, Zustand/Redux Toolkit",
        "Отримання даних: TanStack Query",
        "Основи Next.js (SSR/CSR)",
      ],
      resources: KB.React!.resources,
    },
    "Next.js": {
      cat: KB["Next.js"]!.cat,
      learn: ["App Router, серверні компоненти", "SSR/SSG/ISR", "Отримання даних, route handlers"],
      resources: KB["Next.js"]!.resources,
    },
    TypeScript: {
      cat: KB.TypeScript!.cat,
      learn: [
        "interface vs type, union/intersection, звуження типів (narrowing)",
        "Generics + extends",
        "Допоміжні типи (Partial/Pick/Omit/Record/ReturnType)",
        "unknown/never, дискриміновані об'єднання (discriminated unions)",
        "Декоратори (для NestJS)",
      ],
      resources: KB.TypeScript!.resources,
    },
    PostgreSQL: {
      cat: KB.PostgreSQL!.cat,
      learn: [
        "SELECT/JOIN/GROUP BY, підзапити, віконні функції (window functions)",
        "Індекси (B-tree), EXPLAIN ANALYZE",
        "Транзакції/ACID, рівні ізоляції",
        "Проблема N+1, нормалізація",
        "ORM: Prisma / TypeORM",
      ],
      resources: KB.PostgreSQL!.resources,
    },
    SQL: {
      cat: KB.SQL!.cat,
      learn: ["JOIN'и, агрегатні функції, GROUP BY", "Індекси та EXPLAIN", "Транзакції, N+1"],
      resources: KB.SQL!.resources,
    },
    MySQL: {
      cat: KB.MySQL!.cat,
      learn: ["JOIN, індекси, оптимізація запитів", "Транзакції, реплікація"],
      resources: KB.MySQL!.resources,
    },
    "Node.js": {
      cat: KB["Node.js"]!.cat,
      learn: [
        "Event loop (libuv), фази, thread pool",
        "Streams, backpressure, worker_threads",
        "Обробка помилок в асинхронному коді, graceful shutdown",
        "Безпека (helmet, rate limiting)",
      ],
      resources: KB["Node.js"]!.resources,
    },
    NestJS: {
      cat: KB.NestJS!.cat,
      learn: [
        "Модулі, DI, provider scopes",
        "Guards / Pipes / Interceptors / Filters (порядок виконання)",
        "DTO + class-validator",
        "JWT/Passport, TypeORM/Prisma",
      ],
      resources: KB.NestJS!.resources,
    },
    Express: {
      cat: KB.Express!.cat,
      learn: ["Маршрутизація, middleware, обробка помилок", "Структура застосунку, валідація"],
      resources: KB.Express!.resources,
    },
    Docker: {
      cat: KB.Docker!.cat,
      learn: ["Dockerfile, шари та кешування, multi-stage builds", "docker-compose, volumes, networks", "Image vs container"],
      resources: KB.Docker!.resources,
    },
    AWS: {
      cat: KB.AWS!.cat,
      learn: ["EC2/S3/Lambda/RDS/SQS (у порівнянні з еквівалентами Azure)", "IAM, основи мережевої взаємодії", "Основи serverless"],
      resources: KB.AWS!.resources,
    },
    Kafka: {
      cat: KB.Kafka!.cat,
      learn: ["Producer/consumer, topics, partitions", "Event-driven архітектура, гарантії доставки", "Kafka vs RabbitMQ"],
      resources: KB.Kafka!.resources,
    },
    WebSockets: {
      cat: KB.WebSockets!.cat,
      learn: ["ws/Socket.IO, Nest Gateway", "Реальний час (real-time), presence", "Масштабування через Redis pub/sub"],
      resources: KB.WebSockets!.resources,
    },
    GraphQL: {
      cat: KB.GraphQL!.cat,
      learn: ["Schema, resolvers, queries/mutations", "Apollo, кешування", "REST vs GraphQL, N+1 (dataloader)"],
      resources: KB.GraphQL!.resources,
    },
    Redis: {
      cat: KB.Redis!.cat,
      learn: ["Кешування (cache-aside), TTL", "Pub/sub, черги, leaderboards", "Rate limiting"],
      resources: KB.Redis!.resources,
    },
    Jest: {
      cat: KB.Jest!.cat,
      learn: ["Піраміда тестування: unit/integration/e2e", "mocks/spies/stubs", "Supertest (API), покриття тестами (coverage)"],
      resources: KB.Jest!.resources,
    },
    "AI/LLM": {
      cat: KB["AI/LLM"]!.cat,
      learn: [
        "LLM API: streaming, tool calling, JSON-відповіді",
        "RAG: embeddings + векторний пошук (pgvector)",
        "Prompt engineering, зменшення галюцинацій",
      ],
      resources: KB["AI/LLM"]!.resources,
    },
    Angular: {
      cat: KB.Angular!.cat,
      learn: ["Компоненти, модулі, standalone components", "RxJS та Observables", "DI, signals, reactive forms"],
      resources: KB.Angular!.resources,
    },
    RxJS: {
      cat: KB.RxJS!.cat,
      learn: ["Observables, оператори (map/switchMap/merge)", "Subjects, обробка помилок"],
      resources: KB.RxJS!.resources,
    },
    "REST API": {
      cat: KB["REST API"]!.cat,
      learn: ["Методи, коди статусів, версіонування", "Ідемпотентність, пагінація", "OpenAPI/Swagger"],
      resources: KB["REST API"]!.resources,
    },
    Python: {
      cat: KB.Python!.cat,
      learn: ["Синтаксис, типи, віртуальні середовища", "Основи FastAPI/Django"],
      resources: KB.Python!.resources,
    },
    Go: {
      cat: KB.Go!.cat,
      learn: ["Синтаксис, goroutines, channels", "Стандартна бібліотека"],
      resources: KB.Go!.resources,
    },
    Kubernetes: {
      cat: KB.Kubernetes!.cat,
      learn: ["Pods/Deployments/Services", "kubectl, конфігурації"],
      resources: KB.Kubernetes!.resources,
    },
    Vue: {
      cat: KB.Vue!.cat,
      learn: [
        "Composition API (ref/reactive/computed/watch)",
        "Компоненти: props/emit, slots, provide/inject",
        "Pinia (стан) + Vue Router",
        "Реактивність під капотом, lifecycle hooks",
      ],
      resources: KB.Vue!.resources,
    },
    Nuxt: {
      cat: KB.Nuxt!.cat,
      learn: ["Маршрутизація на основі файлів (file-based routing), layouts", "SSR/SSG, useAsyncData/useFetch", "Nitro-сервер, модулі"],
      resources: KB.Nuxt!.resources,
    },
    TailwindCSS: {
      cat: KB.TailwindCSS!.cat,
      learn: ["Utility-first підхід, responsive-префікси", "Кастомізація теми, @apply", "Темна тема (dark mode), композиція класів"],
      resources: KB.TailwindCSS!.resources,
    },
    "HTML/CSS": {
      cat: KB["HTML/CSS"]!.cat,
      learn: [
        "Семантика та доступність (a11y, ARIA)",
        "Flexbox, Grid, адаптивний дизайн (responsive design)",
        "Специфічність (specificity), box model, позиціонування",
      ],
      resources: KB["HTML/CSS"]!.resources,
    },
    MongoDB: {
      cat: KB.MongoDB!.cat,
      learn: [
        "Документна модель, колекції, індекси",
        "Aggregation pipeline",
        "Проєктування схеми: embedding vs $lookup",
        "Транзакції, replica sets",
      ],
      resources: KB.MongoDB!.resources,
    },
    Prisma: {
      cat: KB.Prisma!.cat,
      learn: ["Schema, міграції, генерація client", "Зв'язки (relations), транзакції", "N+1 та include/select"],
      resources: KB.Prisma!.resources,
    },
    Azure: {
      cat: KB.Azure!.cat,
      learn: ["App Service, Functions, Blob Storage", "Cosmos DB, Service Bus", "IAM/RBAC, основи мережевої взаємодії"],
      resources: KB.Azure!.resources,
    },
    GCP: {
      cat: KB.GCP!.cat,
      learn: ["Cloud Run, Functions, Compute Engine", "Cloud Storage, Pub/Sub", "Основи IAM"],
      resources: KB.GCP!.resources,
    },
    "CI/CD": {
      cat: KB["CI/CD"]!.cat,
      learn: ["Пайплайн: build → test → deploy", "GitHub Actions (workflows, secrets, matrix)", "Кешування та артефакти"],
      resources: KB["CI/CD"]!.resources,
    },
    Playwright: {
      cat: KB.Playwright!.cat,
      learn: ["E2E: locators, auto-wait", "Fixtures, паралелізм", "Trace viewer, інтеграція з CI"],
      resources: KB.Playwright!.resources,
    },
    Git: {
      cat: KB.Git!.cat,
      learn: ["merge vs rebase, cherry-pick", "Стратегії гілкування (branching), розв'язання конфліктів", "reset/revert, reflog, bisect"],
      resources: KB.Git!.resources,
    },
  };
}
