import { getCards, getDrills } from "../study/content.js";
import { getLocale } from "../../core/request-context.js";
import { buildKbUk } from "./knowledge-base.uk.js";

// Lazily built (not a top-level constant) — see buildKbUk()'s doc comment for why: it reads `KB`,
// defined further down in this very module, so it can only run once this module has finished
// loading. Memoized since the translated data never changes across requests.
let kbUkCache: ReturnType<typeof buildKbUk> | undefined;
function getKbUk(): ReturnType<typeof buildKbUk> {
  return (kbUkCache ??= buildKbUk());
}

export interface Resource {
  t: string;
  u: string;
  /** Marks links generated and validated by an LLM (as opposed to curated static ones). */
  ai?: boolean;
}

export interface KbEntry {
  cat: string | null;
  learn: string[];
  resources: Resource[];
}

// Knowledge base: technology -> what to learn + resources, plus a mapping to card/drill categories.
const R = (t: string, u: string): Resource => ({ t, u });
export const KB: Record<string, KbEntry> = {
  React: {
    cat: "React",
    learn: [
      "Hooks (useState/useEffect+cleanup, useMemo/useCallback/useRef)",
      "Re-renders, React.memo, keys, reconciliation",
      "State: Context, Zustand/Redux Toolkit",
      "Data fetching: TanStack Query",
      "Next.js basics (SSR/CSR)",
    ],
    resources: [
      R("React.dev — official tour", "https://react.dev/learn"),
      R("TanStack Query", "https://tanstack.com/query/latest"),
      R("React Interview Questions", "https://github.com/sudheerj/reactjs-interview-questions"),
      R("Next.js Learn", "https://nextjs.org/learn"),
    ],
  },
  "Next.js": {
    cat: "React",
    learn: ["App Router, server components", "SSR/SSG/ISR", "Data fetching, route handlers"],
    resources: [R("Next.js Learn", "https://nextjs.org/learn"), R("Next.js Docs", "https://nextjs.org/docs")],
  },
  TypeScript: {
    cat: "TypeScript",
    learn: [
      "interface vs type, union/intersection, narrowing",
      "Generics + extends",
      "Utility types (Partial/Pick/Omit/Record/ReturnType)",
      "unknown/never, discriminated unions",
      "Decorators (for NestJS)",
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
      "SELECT/JOIN/GROUP BY, subqueries, window functions",
      "Indexes (B-tree), EXPLAIN ANALYZE",
      "Transactions/ACID, isolation levels",
      "N+1 problem, normalization",
      "ORM: Prisma / TypeORM",
    ],
    resources: [
      R("SQLBolt (interactive)", "https://sqlbolt.com/"),
      R("PostgreSQL Exercises", "https://pgexercises.com/"),
      R("Use The Index, Luke", "https://use-the-index-luke.com/"),
      R("Prisma Docs", "https://www.prisma.io/docs"),
    ],
  },
  SQL: {
    cat: "SQL",
    learn: ["JOINs, aggregates, GROUP BY", "Indexes and EXPLAIN", "Transactions, N+1"],
    resources: [R("SQLBolt", "https://sqlbolt.com/"), R("PostgreSQL Exercises", "https://pgexercises.com/")],
  },
  MySQL: {
    cat: "SQL",
    learn: ["JOIN, indexes, query optimization", "Transactions, replication"],
    resources: [R("SQLBolt", "https://sqlbolt.com/"), R("MySQL Tutorial", "https://www.mysqltutorial.org/")],
  },
  "Node.js": {
    cat: "Node.js",
    learn: [
      "Event loop (libuv), phases, thread pool",
      "Streams, backpressure, worker_threads",
      "Error handling in async code, graceful shutdown",
      "Security (helmet, rate limiting)",
    ],
    resources: [
      R("Node.js Learn", "https://nodejs.org/en/learn"),
      R("Node Best Practices", "https://github.com/goldbergyoni/nodebestpractices"),
    ],
  },
  NestJS: {
    cat: "NestJS",
    learn: [
      "Modules, DI, provider scopes",
      "Guards / Pipes / Interceptors / Filters (execution order)",
      "DTO + class-validator",
      "JWT/Passport, TypeORM/Prisma",
    ],
    resources: [
      R("NestJS Docs", "https://docs.nestjs.com/"),
      R("NestJS Courses", "https://courses.nestjs.com/"),
      R("NestJS Sample Apps (practice)", "https://github.com/nestjs/nest/tree/master/sample"),
    ],
  },
  Express: {
    cat: "Node.js",
    learn: ["Routing, middleware, error handling", "App structure, validation"],
    resources: [
      R("Express Guide", "https://expressjs.com/en/guide/routing.html"),
      R("MDN — Express/Node tutorial (build-along)", "https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs"),
    ],
  },
  Docker: {
    cat: "Docker",
    learn: ["Dockerfile, layers and caching, multi-stage builds", "docker-compose, volumes, networks", "Image vs container"],
    resources: [
      R("Docker Curriculum", "https://docker-curriculum.com/"),
      R("Docker Get Started", "https://docs.docker.com/get-started/"),
      R("Play with Docker (practice)", "https://labs.play-with-docker.com/"),
    ],
  },
  AWS: {
    cat: "System Design",
    learn: ["EC2/S3/Lambda/RDS/SQS (mapped to Azure equivalents)", "IAM, networking basics", "Serverless fundamentals"],
    resources: [
      R("AWS Skill Builder", "https://explore.skillbuilder.aws/"),
      R("AWS Hands-on Tutorials (practice)", "https://aws.amazon.com/getting-started/hands-on/"),
    ],
  },
  Kafka: {
    cat: "System Design",
    learn: ["Producer/consumer, topics, partitions", "Event-driven architecture, delivery guarantees", "Kafka vs RabbitMQ"],
    resources: [
      R("Confluent Developer — Kafka tutorials", "https://developer.confluent.io/"),
      R("Kafka Quickstart (practice)", "https://kafka.apache.org/quickstart"),
      R("System Design 101", "https://github.com/ByteByteGoHq/system-design-101"),
    ],
  },
  WebSockets: {
    cat: "Node.js",
    learn: ["ws/Socket.IO, Nest Gateway", "Real-time, presence", "Scaling via Redis pub/sub"],
    resources: [
      R("Socket.IO Docs", "https://socket.io/docs/v4/"),
      R("MDN — WebSockets API", "https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API"),
    ],
  },
  GraphQL: {
    cat: "API",
    learn: ["Schema, resolvers, queries/mutations", "Apollo, caching", "REST vs GraphQL, N+1 (dataloader)"],
    resources: [R("GraphQL.org", "https://graphql.org/learn/"), R("How to GraphQL (hands-on tutorials)", "https://www.howtographql.com/")],
  },
  Redis: {
    cat: "System Design",
    learn: ["Caching (cache-aside), TTL", "Pub/sub, queues, leaderboards", "Rate limiting"],
    resources: [R("Redis Dev Hub", "https://redis.io/learn/")],
  },
  Jest: {
    cat: "Testing",
    learn: ["Testing pyramid: unit/integration/e2e", "mocks/spies/stubs", "Supertest (API), coverage"],
    resources: [
      R("Jest Docs", "https://jestjs.io/docs/getting-started"),
      R("JS Testing Best Practices", "https://github.com/goldbergyoni/javascript-testing-best-practices"),
    ],
  },
  "AI/LLM": {
    cat: "AI",
    learn: [
      "LLM API: streaming, tool calling, JSON responses",
      "RAG: embeddings + vector search (pgvector)",
      "Prompt engineering, mitigating hallucinations",
    ],
    resources: [
      R("OpenAI Docs", "https://platform.openai.com/docs/guides/text-generation"),
      R("Anthropic Docs", "https://docs.claude.com/en/docs/build-with-claude/overview"),
      R("Anthropic Prompt Engineering Tutorial (hands-on)", "https://github.com/anthropics/prompt-eng-interactive-tutorial"),
    ],
  },
  Angular: {
    cat: "TypeScript",
    learn: ["Components, modules, standalone components", "RxJS and Observables", "DI, signals, reactive forms"],
    resources: [R("Angular.dev", "https://angular.dev/tutorials"), R("RxJS Docs", "https://rxjs.dev/guide/overview")],
  },
  RxJS: {
    cat: "TypeScript",
    learn: ["Observables, operators (map/switchMap/merge)", "Subjects, error handling"],
    resources: [R("RxJS Docs", "https://rxjs.dev/guide/overview"), R("Learn RxJS", "https://www.learnrxjs.io/")],
  },
  "REST API": {
    cat: "API",
    learn: ["Methods, status codes, versioning", "Idempotency, pagination", "OpenAPI/Swagger"],
    resources: [
      R("REST API Tutorial", "https://restfulapi.net/"),
      R("MDN — HTTP overview", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview"),
    ],
  },
  Python: {
    cat: "System Design",
    learn: ["Syntax, types, virtual environments", "FastAPI/Django basics"],
    resources: [
      R("Python Docs", "https://docs.python.org/3/tutorial/"),
      R("Exercism — Python Track (practice)", "https://exercism.org/tracks/python"),
    ],
  },
  Go: {
    cat: "System Design",
    learn: ["Syntax, goroutines, channels", "Standard library"],
    resources: [R("A Tour of Go", "https://go.dev/tour/"), R("Go by Example", "https://gobyexample.com/")],
  },
  Kubernetes: {
    cat: "System Design",
    learn: ["Pods/Deployments/Services", "kubectl, configs"],
    resources: [
      R("Kubernetes Basics", "https://kubernetes.io/docs/tutorials/kubernetes-basics/"),
      R("Killercoda — Kubernetes Playground (practice)", "https://killercoda.com/kubernetes"),
    ],
  },
  Vue: {
    cat: "Vue",
    learn: [
      "Composition API (ref/reactive/computed/watch)",
      "Components: props/emit, slots, provide/inject",
      "Pinia (state) + Vue Router",
      "Reactivity under the hood, lifecycle hooks",
    ],
    resources: [
      R("Vue.js Docs", "https://vuejs.org/guide/introduction.html"),
      R("Vue School", "https://vueschool.io/"),
      R("Pinia", "https://pinia.vuejs.org/"),
    ],
  },
  Nuxt: {
    cat: "Vue",
    learn: ["File-based routing, layouts", "SSR/SSG, useAsyncData/useFetch", "Nitro server, modules"],
    resources: [R("Nuxt Docs", "https://nuxt.com/docs")],
  },
  TailwindCSS: {
    cat: "HTML/CSS",
    learn: ["Utility-first, responsive prefixes", "Theme customization, @apply", "Dark mode, composing classes"],
    resources: [R("Tailwind Docs", "https://tailwindcss.com/docs"), R("Tailwind Play (practice)", "https://play.tailwindcss.com/")],
  },
  "HTML/CSS": {
    cat: "HTML/CSS",
    learn: ["Semantics and accessibility (a11y, ARIA)", "Flexbox, Grid, responsive design", "Specificity, box model, positioning"],
    resources: [
      R("MDN HTML", "https://developer.mozilla.org/en-US/docs/Web/HTML"),
      R("Guide to Flexbox", "https://css-tricks.com/snippets/css/a-guide-to-flexbox/"),
      R("web.dev Learn CSS", "https://web.dev/learn/css"),
      R("Frontend Mentor (practice)", "https://www.frontendmentor.io/"),
    ],
  },
  MongoDB: {
    cat: "Databases",
    learn: [
      "Document model, collections, indexes",
      "Aggregation pipeline",
      "Schema design: embedding vs $lookup",
      "Transactions, replica sets",
    ],
    resources: [R("MongoDB University", "https://learn.mongodb.com/"), R("MongoDB Docs", "https://www.mongodb.com/docs/manual/")],
  },
  Prisma: {
    cat: "SQL",
    learn: ["Schema, migrations, client generation", "Relations, transactions", "N+1 and include/select"],
    resources: [R("Prisma Docs", "https://www.prisma.io/docs")],
  },
  Azure: {
    cat: "System Design",
    learn: ["App Service, Functions, Blob Storage", "Cosmos DB, Service Bus", "IAM/RBAC, networking basics"],
    resources: [R("Microsoft Learn — Azure", "https://learn.microsoft.com/en-us/training/azure/")],
  },
  GCP: {
    cat: "System Design",
    learn: ["Cloud Run, Functions, Compute Engine", "Cloud Storage, Pub/Sub", "IAM basics"],
    resources: [R("Google Cloud Skills Boost", "https://www.cloudskillsboost.google/")],
  },
  "CI/CD": {
    cat: "Git/Testing",
    learn: ["Pipeline: build → test → deploy", "GitHub Actions (workflows, secrets, matrix)", "Caching and artifacts"],
    resources: [
      R("GitHub Actions Docs", "https://docs.github.com/en/actions"),
      R("CI/CD Concepts", "https://about.gitlab.com/topics/ci-cd/"),
    ],
  },
  Playwright: {
    cat: "Git/Testing",
    learn: ["E2E: locators, auto-wait", "Fixtures, parallelism", "Trace viewer, CI integration"],
    resources: [R("Playwright Docs", "https://playwright.dev/docs/intro")],
  },
  Git: {
    cat: "Git/Testing",
    learn: ["merge vs rebase, cherry-pick", "Branching strategies, conflict resolution", "reset/revert, reflog, bisect"],
    resources: [R("Pro Git (book)", "https://git-scm.com/book/en/v2"), R("Learn Git Branching", "https://learngitbranching.js.org/")],
  },
};

const GENERIC: KbEntry = {
  cat: null,
  learn: ["Fundamentals and practice on real-world tasks"],
  resources: [R("roadmap.sh", "https://roadmap.sh/")],
};

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
  const locale = getLocale();
  const kb = locale === "uk" ? getKbUk() : KB;
  const base = kb[tech] || GENERIC;
  const cat = base.cat;
  const drills = cat
    ? getDrills(locale)
        .filter((d) => d.cat === cat)
        .map((d) => ({ q: d.q, lvl: d.lvl }))
    : [];
  const cards = cat
    ? getCards(locale)
        .filter((c) => c.cat === cat)
        .map((c) => ({ q: c.q }))
    : [];
  return { learn: base.learn, resources: base.resources, drills, cards };
}
