// Resources from the guide: best practices, practice platforms, cheat sheet, checklist.
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
    group: "Architecture, Databases, System Design",
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
    group: "Interview Preparation",
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
    group: "🧩 Algorithms & Problems",
    name: "LeetCode",
    url: "https://leetcode.com/",
    note: "The go-to for algorithmic interviews, has JS",
  },
  {
    group: "🧩 Algorithms & Problems",
    name: "Codewars",
    url: "https://www.codewars.com/",
    note: 'Gamified "kata" challenges, lots of JS/TS',
  },
  {
    group: "🧩 Algorithms & Problems",
    name: "Exercism",
    url: "https://exercism.org/tracks/javascript",
    note: "JS/TS tracks + free mentor feedback",
  },
  {
    group: "🧩 Algorithms & Problems",
    name: "NeetCode",
    url: "https://neetcode.io/practice",
    note: "Structured roadmap + video walkthroughs",
  },
  {
    group: "🧩 Algorithms & Problems",
    name: "Frontend Mentor",
    url: "https://www.frontendmentor.io/",
    note: "Real front-end/markup challenges (React/Vue practice)",
  },
  {
    group: "🎤 Mock Interviews (live conversation)",
    name: "Pramp / Exponent",
    url: "https://www.tryexponent.com/practice",
    note: "Peer-to-peer: you and another engineer take turns interviewing each other",
  },
  {
    group: "🎤 Mock Interviews (live conversation)",
    name: "interviewing.io",
    url: "https://interviewing.io/",
    note: "Anonymous mock interviews with engineers from top companies",
  },
  {
    group: '💻 Online Editors (rehearse "interview-style" coding)',
    name: "StackBlitz",
    url: "https://stackblitz.com/",
    note: "Full Node/React/Vue/Angular projects right in the browser",
  },
  {
    group: '💻 Online Editors (rehearse "interview-style" coding)',
    name: "CodeSandbox",
    url: "https://codesandbox.io/",
    note: "Quick front-end/full-stack sandboxes (great for React practice)",
  },
  {
    group: '💻 Online Editors (rehearse "interview-style" coding)',
    name: "TS Playground",
    url: "https://www.typescriptlang.org/play",
    note: "Check TypeScript types",
  },
  {
    group: '💻 Online Editors (rehearse "interview-style" coding)',
    name: "DB Fiddle",
    url: "https://www.db-fiddle.com/",
    note: "Practice SQL queries (PostgreSQL/MySQL) online",
  },
];

export interface CheatSection {
  title: string;
  items: string[];
}

export const CHEAT: CheatSection[] = [
  {
    title: "JavaScript in one line",
    items: [
      "Event loop: sync → microtasks (Promise) → 1 macrotask (setTimeout)",
      "Closure: a function remembers its outer variables",
      "let/const are block-scoped + TDZ; var is function-scoped",
      "Always use ===; x == null catches both null and undefined",
      "Promise.all runs in parallel and rejects on the first error; allSettled never rejects",
    ],
  },
  {
    title: "TypeScript",
    items: [
      "interface — objects/declaration merging; type — unions/utility types",
      "unknown is safer than any; never means unreachable",
      "Generics + extends for constraints",
    ],
  },
  {
    title: "Node / Nest",
    items: [
      "Single-threaded + libuv thread pool; CPU-heavy work → worker_threads",
      "DI = dependencies injected via the constructor, easy to mock",
      "Guards (auth) · Pipes (validation) · Interceptors · Filters (errors)",
    ],
  },
  {
    title: "React",
    items: [
      "Virtual DOM + diffing; key for lists",
      "useEffect: deps = when it reruns; return = cleanup",
      "useMemo caches a value; useCallback caches a function",
      "Hooks — only at the top level, in a consistent order",
    ],
  },
  {
    title: "Databases",
    items: [
      "SQL — consistency/relations; NoSQL — flexibility/scale",
      "Index = faster reads, slower writes; check with EXPLAIN",
      "N+1 → eager load / JOIN",
      "ACID, transactions for payments",
    ],
  },
  {
    title: "System design",
    items: ["Profile → cache (Redis/CDN) → replicas → queue → sharding", "Queue = decoupling + smoothing traffic spikes"],
  },
  {
    title: "Questions to ask them (bring your own!)",
    items: [
      "What's the stack and why? What does the team look like?",
      "How do you test and deploy? Any tech debt?",
      "What are the next interview stages?",
    ],
  },
];

export const CHECKLIST: string[] = [
  "React: hooks, re-renders, TanStack Query — rewrote 1-2 of my Vue components in React",
  "React: built a mini project (CRUD + fetch) with React + TypeScript",
  "Next.js: learned SSR/SSG, app router (basics)",
  "SQL: completed SQLBolt + PostgreSQL Exercises",
  "SQL: can explain indexes, transactions, N+1, SQL vs NoSQL",
  "SQL: built a Nest + Prisma/TypeORM app with PostgreSQL",
  "TypeScript: generics, utility types, completed 5+ type-challenges",
  "JS core: event loop, closures, async — can explain confidently",
  "Node/Nest: refreshed DI, guards, pipes, error handling, queues",
  "Docker: wrote a Dockerfile (multi-stage) + docker-compose",
  "AWS: mapped services to Azure equivalents, learned S3/Lambda/RDS/SQS",
  "Algorithms: NeetCode 75 or 30+ LeetCode problems",
  "System Design: worked through 3+ common designs (scaling, cache, MQ)",
  "Questions: went through all Q&A in section 10, can answer in my own words",
  "Behavioral: prepared 3 STAR stories + an answer about my AI workflow",
  "Mock: did 2+ mock interviews on Pramp/interviewing.io",
  "Portfolio: TaskFlow pet project (React+Nest+PostgreSQL+Docker) on GitHub",
];
