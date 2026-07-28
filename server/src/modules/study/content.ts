// Full content migrated from the study guide (107 flashcards + 43 drills).
export interface Card {
  id: string;
  cat: string;
  q: string;
  a: string;
  generated?: boolean;
}
export interface DrillItem {
  id: string;
  cat: string;
  lvl: string;
  q: string;
  sol: string;
  exp: string;
  generated?: boolean;
  tech?: string;
}

export const CARDS: Card[] = [
  {
    id: "c0",
    cat: "JavaScript",
    q: "What is the event loop, and how do micro/macro tasks relate to it?",
    a: "The event loop lets single-threaded JS perform non-blocking operations. All synchronous code runs first (the call stack). After each synchronous 'chunk', the engine drains the microtask queue (Promise.then, queueMicrotask, MutationObserver), and only then picks up a single macrotask (setTimeout, setInterval, I/O). So a Promise always resolves before setTimeout(0). Node also adds process.nextTick, which has even higher priority than regular microtasks.",
  },
  {
    id: "c1",
    cat: "JavaScript",
    q: "Explain closures with a practical example.",
    a: "A closure is a function bundled together with references to variables from its enclosing scope, which are 'remembered' even after the outer function has finished executing. Practical uses: private variables (the module pattern), function factories, debounce/throttle (the timer lives in the closure), memoization. A classic pitfall is a for loop using var inside setTimeout: every callback sees the same final value; it's fixed by using let (a fresh binding per iteration).",
  },
  {
    id: "c2",
    cat: "JavaScript",
    q: "What's the difference between var / let / const, hoisting, and the TDZ?",
    a: "var has function scope and is hoisted and initialized as undefined. let/const have block scope and are hoisted too, but remain in the Temporal Dead Zone until their declaration is reached (accessing them earlier throws an error). const forbids reassigning the binding (but an object it holds can still be mutated).",
  },
  {
    id: "c3",
    cat: "JavaScript",
    q: "== vs === ?",
    a: "=== is strict equality with no type coercion. == performs coercion, which leads to counterintuitive cases (0 == '', null == undefined). Rule of thumb: always use ===, except when deliberately checking x == null (which catches both null and undefined).",
  },
  {
    id: "c4",
    cat: "JavaScript",
    q: "How do you run several async requests in parallel?",
    a: "Promise.all([...]) launches everything at once, waits for all of them, and rejects on the first error. Promise.allSettled doesn't reject — it returns the status of every promise. Awaiting one by one inside a loop runs them sequentially (slow). Show that you understand the difference between sequential and parallel execution — this comes up often.",
  },
  {
    id: "c5",
    cat: "TypeScript",
    q: "interface vs type — when do you use which?",
    a: "Both describe a shape. interface supports declaration merging and classic extends, and is convenient for objects/classes and public APIs. type is more flexible: unions, intersections, tuples, mapped/conditional types, primitive aliases. Rule of thumb: objects/contracts — interface; everything else (unions, utility types) — type.",
  },
  {
    id: "c6",
    cat: "TypeScript",
    q: "unknown vs any vs never?",
    a: "any disables type checking (unsafe). unknown is a type-safe 'anything' — you must narrow it before you can do anything with it. never is a type that can never occur (a function that always throws, or an exhausted union in a switch).",
  },
  {
    id: "c7",
    cat: "TypeScript",
    q: "What are generics and why do we need them?",
    a: "Parameterizing by type: you write the code once while preserving the relationship between input and output types without losing type safety. E.g. function first<T>(arr: T[]): T. Constraints via extends (<T extends {id: number}>) let you access fields inside the generic.",
  },
  {
    id: "c8",
    cat: "Node.js",
    q: "Node is single-threaded — how does it handle load?",
    a: "JS code runs on a single thread, but I/O is delegated to libuv's thread pool and async system calls, so waiting doesn't block. CPU-heavy tasks still block the event loop — those get moved to worker_threads or separate services. Horizontal scaling is done via cluster / multiple instances behind a load balancer.",
  },
  {
    id: "c9",
    cat: "Node.js",
    q: "What is DI in NestJS and why does it matter?",
    a: "Dependency Injection — dependencies (services) aren't created manually; they're provided by Nest's IoC container through the constructor. This gives loose coupling, easy mocking in tests, and a single place for configuration. Providers have a scope (singleton by default, request, transient). The @Injectable() decorator makes a class available for injection.",
  },
  {
    id: "c10",
    cat: "Node.js",
    q: "How do you design a reliable REST API?",
    a: "Use the right methods (GET is safe/idempotent, POST creates, PUT/PATCH updates, DELETE removes) and status codes (2xx/4xx/5xx). Versioning (/v1), pagination, input validation (DTOs + class-validator), a consistent error format, idempotency for payments, rate limiting, and documentation via OpenAPI/Swagger.",
  },
  {
    id: "c11",
    cat: "Node.js",
    q: "How do you handle errors in async code?",
    a: "try/catch around await; for Express — a wrapper or express-async-errors, plus centralized error middleware; in Nest — Exception Filters. Don't swallow errors silently, log them with context, and distinguish operational (expected) errors from programmer (bug) errors. Globally, listen for unhandledRejection.",
  },
  {
    id: "c12",
    cat: "React",
    q: "What is the virtual DOM and reconciliation?",
    a: "The virtual DOM is a lightweight in-memory copy of the UI tree. When state changes, React builds a new virtual tree, compares it against the old one (diffing), and applies only the difference to the real DOM. key in lists helps the algorithm match elements up and avoid recreating them unnecessarily.",
  },
  {
    id: "c13",
    cat: "React",
    q: "What are the rules of hooks, and what does the useEffect dependency array do?",
    a: "Hooks can only be called at the top level of a component, in a stable order (never inside conditions/loops). useEffect runs after render; the dependency array determines when it re-runs; the returned function is the cleanup (unsubscribing, clearing timers), which runs before the next effect and on unmount. An empty array [] means 'run once on mount'.",
  },
  {
    id: "c14",
    cat: "React",
    q: "useMemo vs useCallback?",
    a: "useMemo caches the result of a computation; useCallback caches a function (so its reference doesn't change between renders). Both are optimizations for expensive computations, or to avoid breaking React.memo on child components. Don't overuse them — premature optimization hurts too.",
  },
  {
    id: "c15",
    cat: "React",
    q: "React vs Vue — what's the difference? (a common question for fullstack roles)",
    a: "Vue: reactivity is automatic (a Proxy tracks dependencies), templates with directives, more batteries included. React: an explicit flow — you change state via setState, render is a function of state, JSX instead of templates, and the ecosystem is assembled from libraries. What they share: component-based architecture and one-way data flow. Experience with Vue's Composition API transfers almost directly to hooks.",
  },
  {
    id: "c16",
    cat: "Databases",
    q: "SQL vs NoSQL — when do you choose which?",
    a: "SQL (PostgreSQL): a clear schema, relationships, ACID transactions, complex queries/aggregates — finance, orders, anywhere consistency matters. NoSQL (Mongo): flexible schema, horizontal scaling, documents/large volumes with simple queries. Having experience with both is a strong point — show that you pick the tool for the job, not out of habit.",
  },
  {
    id: "c17",
    cat: "Databases",
    q: "Why do we need indexes, and when do they stop helping?",
    a: "An index (usually a B-tree) speeds up lookups/sorting at the cost of storage space and slower writes/updates. It doesn't help on low-selectivity columns (e.g. boolean), on functions applied to a column without a functional index, or when the query reads most of the table anyway. Check with EXPLAIN ANALYZE.",
  },
  {
    id: "c18",
    cat: "Databases",
    q: "What is the N+1 problem?",
    a: "When, for a list of N records, an ORM issues 1 query for the list plus N queries for related data (one per item). Solved with eager loading / JOIN (include in Prisma, relations/QueryBuilder in TypeORM) or a batched query. A classic backend question.",
  },
  {
    id: "c19",
    cat: "System Design",
    q: "How do you scale a web application as load grows?",
    a: "First profile the bottleneck. Then: horizontal scaling of stateless services behind a load balancer; caching (Redis, a CDN for static assets); database optimization (indexes, read replicas, sharding eventually); moving heavy/slow tasks to a queue (Kafka/RabbitMQ) for async processing; monitoring and metrics. Talk through the tradeoffs rather than naming technologies at random.",
  },
  {
    id: "c20",
    cat: "System Design",
    q: "Why use a message queue (Kafka/RabbitMQ)?",
    a: "It decouples services: the producer doesn't wait on the consumer, it smooths out load spikes, provides reliable delivery and retries, and enables event-driven architecture. Kafka is a high-throughput streaming log (analytics, event sourcing); RabbitMQ is a classic task queue with flexible routing.",
  },
  {
    id: "c21",
    cat: "Behavioral",
    q: "Tell me about a decision you pushed through against the team's opinion.",
    a: "STAR format: Situation → Task → Action → Result. Pick a real case (e.g. a template builder, an AI integration, or an Azure/Node architecture decision). Be specific: what you proposed, how you convinced people (data, a POC), and what it delivered in numbers. Avoid vague phrases — interviewers can tell a generic answer immediately.",
  },
  {
    id: "c22",
    cat: "Behavioral",
    q: "Your most painful production incident.",
    a: "Be honest: what happened, what you did in the first 30 minutes (mitigation, rollback, communication), and — most importantly — what process or practice you changed afterward (tests, monitoring, code review, feature flags). This shows maturity, not flawlessness.",
  },
  {
    id: "c23",
    cat: "Behavioral",
    q: "Describe your workday with AI tools.",
    a: "This is your strongest card. Be concrete: which tasks you hand off to Cursor/AI (boilerplate, tests, refactoring, navigating code), what you discard from the output and why (AI code can look correct but miss context/edge cases), where AI speeds you up and where it gets things wrong. Give an example where you caught incorrect AI-generated code in review.",
  },
  {
    id: "c24",
    cat: "Security",
    q: "What is CORS, and why does a request from the frontend 'fail'?",
    a: "CORS is a browser mechanism that restricts requests to a different origin (domain/port/protocol). The server must return headers like Access-Control-Allow-Origin, otherwise the browser blocks the response. For 'complex' requests, a preflight OPTIONS request goes out first. Important: CORS is a browser-side protection, not a server-side one — there are no restrictions from curl/Postman.",
  },
  {
    id: "c25",
    cat: "Security",
    q: "How does JWT work, and where should the token be stored?",
    a: "JWT = header.payload.signature, signed by the server; the server doesn't keep a session (stateless) — it only verifies the signature. The payload isn't encrypted, so no secrets go in it. Storage: an httpOnly cookie (safer against XSS) or in memory; localStorage is vulnerable to XSS. A short-lived access token paired with a longer-lived refresh token is standard.",
  },
  {
    id: "c26",
    cat: "Security",
    q: "Top web threats (OWASP) and how to defend against them?",
    a: "XSS — escape output, use CSP. SQL Injection — parameterized queries/ORM. CSRF — tokens, SameSite cookies. Plus: input validation, rate limiting, HTTPS, helmet in Node, never log secrets, keep dependencies updated (npm audit).",
  },
  {
    id: "c27",
    cat: "Git/Testing",
    q: "merge vs rebase — when do you use which?",
    a: "merge keeps history as-is and adds a merge commit — safe for shared branches. rebase rewrites commits on top of another branch, producing linear history — convenient for cleaning up locally before a PR. Golden rule: never rebase a branch that's already been pushed and is used by others.",
  },
  {
    id: "c28",
    cat: "Git/Testing",
    q: "The testing pyramid — what and how much should you test?",
    a: "Lots of unit tests (fast, isolated logic), fewer integration tests (modules together, DB/API), few e2e tests (full flow, slow, brittle). Mock external dependencies in unit tests. The goal isn't 100% coverage — it's confidence in critical paths. Tools: Jest/Vitest, Supertest (API), Playwright (e2e).",
  },
  {
    id: "c29",
    cat: "Git/Testing",
    q: "Why do we need CI/CD, and what goes into it?",
    a: "CI runs automatically on every push/PR: lint → tests → build → (optionally) a security scan. CD automates deployment. This gives fast feedback and keeps broken code out of main. Example: a GitHub Actions pipeline with install → lint → test → build steps. Some teams deploy 50-60 times a day thanks to strong CI/CD.",
  },
  {
    id: "c30",
    cat: "Git/Testing",
    q: "What is SOLID (briefly)?",
    a: "Single responsibility — one class, one reason to change. Open/closed — open for extension, closed for modification. Liskov — a subtype must be substitutable for its base type without surprises. Interface segregation — several narrow interfaces beat one fat one. Dependency inversion — depend on abstractions, not concretions (this is the foundation of DI in Nest).",
  },
  {
    id: "c31",
    cat: "JavaScript",
    q: "What is hoisting, and how does it differ for var, let, and functions?",
    a: "Hoisting is moving declarations to the top of their scope at compile time. var is hoisted and initialized as undefined (accessing it before the declaration doesn't throw — it just returns undefined). let/const are hoisted too but stay in the TDZ until the declaration line — accessing them earlier throws a ReferenceError. Function declarations are hoisted fully, body included, so they can be called before they appear. Function expressions (const fn = () => {}) follow the rules of the variable that holds them.",
  },
  {
    id: "c32",
    cat: "JavaScript",
    q: "How is the value of this determined?",
    a: "By how the function is called, not where it's declared: (1) a plain call fn() → undefined in strict mode (otherwise the global object); (2) a method call obj.fn() → obj; (3) new Fn() → the newly created object; (4) call/apply/bind → an explicitly supplied this. Arrow functions have no this of their own — they take it lexically from where they were defined, which makes them convenient in callbacks where you don't want to lose context.",
  },
  {
    id: "c33",
    cat: "JavaScript",
    q: "Explain prototypal inheritance and the prototype chain.",
    a: "Every object has an internal [[Prototype]] reference (accessible via __proto__ / Object.getPrototypeOf) to another object. When a property isn't found on the object itself, the engine looks for it up the prototype chain to Object.prototype → null. ES6 classes are syntactic sugar over this: class methods live on Class.prototype, and every instance shares them without duplication.",
  },
  {
    id: "c34",
    cat: "JavaScript",
    q: "What's the difference between call, apply, and bind?",
    a: "All three set this. call(thisArg, a, b) invokes immediately with arguments listed individually. apply(thisArg, [a, b]) does the same but takes arguments as an array. bind(thisArg) doesn't invoke — it returns a new function with this permanently fixed (useful for callbacks/event handlers).",
  },
  {
    id: "c35",
    cat: "JavaScript",
    q: "Debounce vs throttle — when do you use which?",
    a: "Debounce runs a function only after a pause in events (e.g. search: wait until the user stops typing). Throttle runs it at most once every N ms (e.g. scroll/resize: cap the frequency). Debounce = 'after the quiet', throttle = 'no more often than'.",
  },
  {
    id: "c36",
    cat: "JavaScript",
    q: "Shallow vs deep copy? How do you make a deep copy?",
    a: "A shallow copy ({...obj}, Object.assign) copies only the top level — nested objects are still shared by reference. A deep copy fully duplicates everything. Options: the modern structuredClone(obj) (native, supports Map/Set/Date), JSON.parse(JSON.stringify(obj)) (loses functions and undefined, turns Date into a string), or a library (lodash cloneDeep).",
  },
  {
    id: "c37",
    cat: "JavaScript",
    q: "What is event delegation?",
    a: "Instead of attaching a handler to every child element, you attach one to the parent and rely on event bubbling, checking event.target. Benefits: fewer listeners (better performance), and it works for dynamically added elements.",
  },
  {
    id: "c38",
    cat: "JavaScript",
    q: "Map/Set vs Object/Array — when do you choose which?",
    a: "Map — keys of any type, preserves insertion order, has .size, fast for frequent additions/removals; Object — for structured data and JSON. Set — unique values, fast .has() checks; Array — when order/duplicates/indices matter.",
  },
  {
    id: "c39",
    cat: "JavaScript",
    q: "What is a closure, and what's the classic loop pitfall?",
    a: "A closure is a function plus a saved reference to variables from its outer scope. The pitfall: for (var i=0; i<3; i++) setTimeout(()=>console.log(i)) prints 3,3,3, because every callback sees the same shared variable i. The fix is let (a fresh binding per iteration) → 0,1,2.",
  },
  {
    id: "c40",
    cat: "JavaScript",
    q: "Promise.all vs allSettled vs race vs any?",
    a: "all — resolves only if every promise succeeds, otherwise the first rejection fails the whole thing. allSettled — waits for all of them and returns each one's status (never rejects). race — settles with whichever promise finishes first (success or failure). any — resolves with the first success (ignores failures as long as one succeeds).",
  },
  {
    id: "c41",
    cat: "TypeScript",
    q: "What is structural typing?",
    a: "TS compares types by structure (the set of fields), not by name (duck typing). If an object has all the required fields of the required types, it's compatible, even if it was declared as a different type/interface. This differs from nominal typing (Java/C#), where the type's name itself matters.",
  },
  {
    id: "c42",
    cat: "TypeScript",
    q: "keyof, typeof, and indexed access types?",
    a: "keyof T is a union of T's keys. typeof value (in a type context) extracts a type from a variable. Indexed access T[K] gives the type of the value at that key. Combined: type V = T[keyof T] is a union of all value types. Very common in generic utilities.",
  },
  {
    id: "c43",
    cat: "TypeScript",
    q: "Conditional types and infer?",
    a: "A conditional type: T extends U ? X : Y. infer lets you 'extract' a type from inside the condition: type ElementType<T> = T extends (infer E)[] ? E : never pulls out the array's element type. This is how ReturnType, Parameters, and Awaited are implemented.",
  },
  {
    id: "c44",
    cat: "TypeScript",
    q: "What are mapped types for?",
    a: "They build a new type by iterating over an existing type's keys: { [K in keyof T]: ... }. Modifiers include ? (optional), readonly, and -? (remove optionality). Partial, Required, Readonly, and Record are all built this way.",
  },
  {
    id: "c45",
    cat: "TypeScript",
    q: "What is a discriminated union, and why use one?",
    a: "A union of types that share a common literal 'discriminant' field (e.g. type). Based on that field's value, TS narrows the type inside a switch/if and gives you precise typing in each branch. The classic use case is state (loading/success/error) or events.",
  },
  {
    id: "c46",
    cat: "TypeScript",
    q: "enum vs a union of string literals?",
    a: "A literal union (type Role = 'admin' | 'user') is lighter, tree-shakeable, generates no runtime code, and is usually the better choice. enum generates an actual object at runtime and has quirks (numeric enums with reverse mapping). const enum gets inlined but has limitations. Modern advice: reach for a union or as const more often.",
  },
  {
    id: "c47",
    cat: "TypeScript",
    q: "What is as const for?",
    a: "It makes a literal immutable and narrows its type to the specific value (e.g. 'admin' instead of string), and turns arrays into readonly tuples. Useful for config objects, so you get precise inferred types and can build a union from an array of values.",
  },
  {
    id: "c48",
    cat: "Node.js",
    q: "What is libuv and the thread pool?",
    a: "libuv is the C library behind Node that implements the event loop and async I/O. Network operations are mostly non-blocking at the OS level; but the filesystem, DNS, and crypto (bcrypt, pbkdf2) run in a thread pool (4 threads by default, via UV_THREADPOOL_SIZE). That's why heavy synchronous code blocks the loop, while properly offloaded operations don't.",
  },
  {
    id: "c49",
    cat: "Node.js",
    q: "process.nextTick vs setImmediate vs setTimeout(0)?",
    a: "process.nextTick runs earliest, right after the current operation, before Promise microtasks (easy to starve the loop if overused). setImmediate runs in the check phase, after I/O. setTimeout(0) runs in the timers phase with a minimal delay. The order of setImmediate vs setTimeout outside of an I/O callback is not deterministic.",
  },
  {
    id: "c50",
    cat: "Node.js",
    q: "What kinds of streams are there, and what are they for?",
    a: "Readable, Writable, Duplex, Transform. They let you process data in chunks instead of holding it all in memory — critical for large files/network transfers. pipe() / pipeline() connect streams and handle backpressure (when the consumer can't keep up, the source slows down).",
  },
  {
    id: "c51",
    cat: "Node.js",
    q: "cluster vs worker_threads vs child_process?",
    a: "cluster — several Node processes sharing a port (scaling HTTP across all cores). worker_threads — threads within one process sharing memory (for CPU-heavy computation). child_process — launching separate OS processes/commands. CPU-bound → worker_threads; web-server scale → cluster/PM2 or multiple containers.",
  },
  {
    id: "c52",
    cat: "Node.js",
    q: "How do you find and avoid a memory leak in Node?",
    a: "Common causes: EventEmitter listeners that are never removed, growing global caches, closures, timers. Diagnosis: --inspect + heap snapshots in Chrome DevTools, comparing snapshots, monitoring process.memoryUsage(). Avoiding it: remove listeners, bound caches (LRU), WeakMap for object metadata.",
  },
  {
    id: "c53",
    cat: "Node.js",
    q: "What is graceful shutdown and why does it matter?",
    a: "On SIGTERM (e.g. a deploy), a service should stop accepting new requests, wait for in-flight ones to finish, close DB/queue connections, and only then exit. Without this — dropped requests and dangling connections. In Nest — the onModuleDestroy/enableShutdownHooks hooks.",
  },
  {
    id: "c54",
    cat: "NestJS",
    q: "Order: middleware, guard, interceptor, pipe, filter?",
    a: "A request passes through: middleware → guards (authorization, whether to let it through) → interceptors (before) → pipes (transforming/validating arguments) → the handler → interceptors (after) → the response. Exception filters catch errors at any stage. Understanding this order is a common senior-level question.",
  },
  {
    id: "c55",
    cat: "NestJS",
    q: "Provider scopes in Nest?",
    a: "DEFAULT (singleton) — one instance for the whole app, the most performant. REQUEST — a new instance per request (needed for request-specific state, but more expensive). TRANSIENT — a new instance for every consumer. By default, and in 95% of cases — singleton.",
  },
  {
    id: "c56",
    cat: "NestJS",
    q: "How does Nest's DI container work?",
    a: "On startup, Nest builds a dependency graph from metadata (decorators + constructor types, read via reflect-metadata), instantiates providers in the right order, and injects them. Providers are registered in a module; to be available to another module, it must be exported and the module imported.",
  },
  {
    id: "c57",
    cat: "React",
    q: "What is Fiber and how does reconciliation work?",
    a: "Fiber is React's internal tree representation that lets it pause and resume rendering (concurrent mode). On a state change, React builds a new tree, compares it to the current one (diffing) by element type and key, and applies minimal changes to the DOM. Different types → full subtree replacement; same type → prop updates.",
  },
  {
    id: "c58",
    cat: "React",
    q: "What is a stale closure in useEffect?",
    a: "An effect 'remembers' variable values as of when it was created. If a variable isn't in the dependency array, the effect sees a stale value inside it. The fix: add the variable to deps, use a functional update setX(prev => ...), or useRef for the current value. A classic pitfall with timers.",
  },
  {
    id: "c59",
    cat: "React",
    q: "useEffect vs useLayoutEffect?",
    a: "useEffect runs asynchronously after paint, so it doesn't block the UI (99% of cases). useLayoutEffect runs synchronously after DOM mutations, before paint; needed when you must measure the DOM and avoid flicker (e.g. positioning a tooltip).",
  },
  {
    id: "c60",
    cat: "React",
    q: "Why can Context hurt performance?",
    a: "Every consumer of a context re-renders on any change to its value, even if it only needs part of it. The fix: split into several contexts, memoize the value, or use an external store (Zustand/Redux) with selectors that subscribe precisely.",
  },
  {
    id: "c61",
    cat: "React",
    q: "When is React.memo worth using?",
    a: "When a component is heavy and often receives the same props, while its parent re-renders often. memo does a shallow comparison of props. Don't wrap everything — the comparison itself has a cost, and premature optimization complicates the code. Pairs with useCallback/useMemo for stable references.",
  },
  {
    id: "c62",
    cat: "React",
    q: "Suspense and lazy — what are they for?",
    a: "React.lazy + Suspense — code splitting: a component loads only when needed, and Suspense shows a fallback while it loads. Shrinks the initial bundle. In modern React/Next, Suspense is also used for data fetching and server components.",
  },
  {
    id: "c63",
    cat: "React",
    q: "Error boundaries — what are they?",
    a: "A component (class-based, with componentDidCatch/getDerivedStateFromError) that catches render errors in a subtree and shows a fallback instead of a 'white screen'. It doesn't catch errors in event handlers, async code, or SSR — those need try/catch. Often people just use the ready-made react-error-boundary.",
  },
  {
    id: "c64",
    cat: "Vue",
    q: "How does reactivity work in Vue 3?",
    a: "Vue 3 wraps objects in a Proxy, intercepting get/set. Reading inside a computed/effect registers a dependency (track); a change triggers a recalculation (trigger). This is more precise and performant than Object.defineProperty in Vue 2 (which couldn't see new properties being added or array changes by index).",
  },
  {
    id: "c65",
    cat: "Vue",
    q: "ref vs reactive vs toRefs?",
    a: "ref — a wrapper for any value (accessed via .value), works with primitives too. reactive — for objects (no .value), but loses reactivity on destructuring. toRefs — breaks a reactive object down into refs, so you can safely destructure it without losing reactivity.",
  },
  {
    id: "c66",
    cat: "Vue",
    q: "computed vs watch vs watchEffect?",
    a: "computed — a cached derived value (recalculated only when its dependencies change). watch — reacts to a specific source, gives the old and new value, lazy. watchEffect — runs immediately and automatically tracks the dependencies used inside it. For calculations — computed; for side effects — watch/watchEffect.",
  },
  {
    id: "c67",
    cat: "HTML/CSS",
    q: "Flexbox vs Grid — when to use which?",
    a: "Flexbox — one-dimensional layout (a row OR a column): navbars, lining up elements. Grid — two-dimensional (rows AND columns at once): complex page layouts, card grids. Often used together: Grid for the overall layout, Flex inside individual cells.",
  },
  {
    id: "c68",
    cat: "HTML/CSS",
    q: "How is CSS specificity calculated?",
    a: "Priority: inline style > id > class/attribute/pseudo-class > tag. Conceptually a vector (a,b,c): id=100, class=10, tag=1 — compared left to right. !important overrides everything (avoid it). At equal weight, the last declared rule wins.",
  },
  {
    id: "c69",
    cat: "HTML/CSS",
    q: "position: relative / absolute / fixed / sticky?",
    a: "relative — offset from its normal position, still occupies its original space. absolute — taken out of the flow, positioned relative to the nearest positioned ancestor. fixed — relative to the viewport (doesn't move on scroll). sticky — a hybrid: relative until it hits a threshold, then 'sticks' like fixed.",
  },
  {
    id: "c70",
    cat: "HTML/CSS",
    q: "Reflow vs repaint?",
    a: "Reflow (layout) — recomputing geometry (size/position changes) — expensive. Repaint — redrawing without a geometry change (color, shadow) — cheaper. Better to animate transform/opacity (handled by the compositor, no reflow). Reading layout properties in a loop interleaved with writes causes layout thrashing.",
  },
  {
    id: "c71",
    cat: "SQL",
    q: "Explain the different JOIN types.",
    a: "INNER — only rows matching in both tables. LEFT — all from the left + matches from the right (NULL where there's none). RIGHT — the mirror image. FULL OUTER — all from both, NULL where there's no pair. CROSS — cartesian product. INNER and LEFT are the most common.",
  },
  {
    id: "c72",
    cat: "SQL",
    q: "What kinds of indexes does PostgreSQL have?",
    a: "B-tree (default) — equality and ranges, sorting. Hash — equality only. GIN — for arrays, JSONB, full-text. GiST — geodata, ranges. BRIN — huge tables with natural ordering. Also: composite (column order matters), partial (WHERE), unique, functional.",
  },
  {
    id: "c73",
    cat: "SQL",
    q: "How do you read EXPLAIN ANALYZE?",
    a: "It shows the real execution plan: Seq Scan (full scan — bad on large tables), Index Scan (an index was used), the join type (Nested Loop/Hash/Merge), estimated vs actual row counts and time. Red flags: a Seq Scan where an index was expected, a big gap between estimate and actual (stale statistics → ANALYZE).",
  },
  {
    id: "c74",
    cat: "SQL",
    q: "Transaction isolation levels?",
    a: "Read Uncommitted, Read Committed (the PG default), Repeatable Read, Serializable — from weakest to strictest. They prevent anomalies: dirty read, non-repeatable read, phantom read. Stricter levels are safer but more expensive on concurrency. PG uses MVCC — readers don't block writers.",
  },
  {
    id: "c75",
    cat: "SQL",
    q: "Optimistic vs pessimistic locking?",
    a: "Pessimistic — lock the row (SELECT ... FOR UPDATE) for the duration of the work; safe, but reduces concurrency. Optimistic — don't lock, keep a version column, and on update check that it hasn't changed; if it has — conflict and retry. Optimistic is better with rare conflicts, pessimistic with frequent ones.",
  },
  {
    id: "c76",
    cat: "SQL",
    q: "What is connection pooling and why does it matter?",
    a: "Creating a DB connection is expensive. A pool keeps ready connections and reuses them for queries, capping the maximum. Without a pool, the DB chokes under load from thousands of connections. Tools: the driver's built-in pool, PgBouncer in front of PostgreSQL.",
  },
  {
    id: "c77",
    cat: "Databases",
    q: "Explain the CAP theorem.",
    a: "A distributed system can't simultaneously guarantee all three: Consistency (everyone sees the same data), Availability (every request gets a response), Partition tolerance (works despite network splits). Since network partitions are inevitable, in practice you choose between CP (sacrifice availability for consistency) and AP (the reverse).",
  },
  {
    id: "c78",
    cat: "Databases",
    q: "When and why would you use Redis?",
    a: "An in-memory key-value store. Use cases: caching (cache-aside), sessions, rate limiting (counters with TTL), queues/pub-sub, leaderboards (sorted sets), distributed locks. Fast, but data lives in memory — not a source of truth without persistence.",
  },
  {
    id: "c79",
    cat: "API",
    q: "What makes an API RESTful?",
    a: "Resources through URLs (nouns, not verbs), the right HTTP methods, stateless (no state stored between requests on the server), a uniform interface, correct status codes, HATEOAS (by the strict definition). In practice, most APIs are 'REST-like' — level 2 on the Richardson maturity model.",
  },
  {
    id: "c80",
    cat: "API",
    q: "What is idempotency, and which methods are idempotent?",
    a: "An idempotent method gives the same result across repeated calls. GET, PUT, DELETE — idempotent; POST — not (calling it twice creates two records). For payments this matters: the client sends an Idempotency-Key, and the server doesn't repeat the operation for the same key — saves you from double charges on retries.",
  },
  {
    id: "c81",
    cat: "API",
    q: "Offset vs cursor pagination?",
    a: "Offset (LIMIT/OFFSET) — simple, but slow on deep pages (the DB scans and discards rows) and 'shifts' on inserts. Cursor (keyset, WHERE id > last_id) — fast and stable on large datasets and infinite scroll. Cursor is better for large/changing datasets.",
  },
  {
    id: "c82",
    cat: "API",
    q: "REST vs GraphQL?",
    a: "REST — several endpoints, risk of over/under-fetching, simple URL-based caching. GraphQL — one endpoint, the client requests exactly the fields it needs, convenient for complex UIs, but harder to cache and a risk of expensive queries (depth/complexity limits are needed). Choose based on client needs, not fashion.",
  },
  {
    id: "c83",
    cat: "Docker",
    q: "Image vs container vs layer?",
    a: "Image — an immutable template (filesystem layers + metadata). Container — a running instance of an image with a writable layer on top. Layer — the result of each Dockerfile instruction, cached: unchanged layers aren't rebuilt. That's why dependencies (COPY package.json + install) are placed before copying the code — so the cache isn't invalidated on every code change.",
  },
  {
    id: "c84",
    cat: "Docker",
    q: "Why use a multi-stage build?",
    a: "One stage builds (with all dev dependencies and the toolchain), and the final stage copies only the artifact into a clean, lightweight image. The result: a small production image with nothing extra, faster deploys, and a smaller attack surface.",
  },
  {
    id: "c85",
    cat: "Docker",
    q: "Volume vs bind mount?",
    a: "Volume — managed by Docker, stored separately from the host's structure (for DB data in production). Bind mount — links to a specific host directory (handy in development for code hot-reload). Without one of these, container data disappears when the container is removed.",
  },
  {
    id: "c86",
    cat: "Docker",
    q: "Blue-green vs canary deployment?",
    a: "Blue-green — two identical environments; switch traffic to the new version instantly, easy rollback. Canary — the new release gets a small % of traffic, gradually increased while watching metrics. Canary is safer for risky changes, blue-green is simpler.",
  },
  {
    id: "c87",
    cat: "Git/Testing",
    q: "git reset vs revert?",
    a: "revert — creates a new commit that undoes changes; safe for shared history. reset — moves the branch pointer back (--soft leaves changes staged, --mixed in the working tree, --hard discards everything); rewrites history — local use only. On a shared branch — use revert.",
  },
  {
    id: "c88",
    cat: "Git/Testing",
    q: "How do you resolve a merge conflict?",
    a: "Git marks conflicts with <<< === >>> markers. You look at both versions, pick/combine the right code, remove the markers, git add the file, and finish the merge/rebase. Prevention: frequent small commits, syncing with main often, smaller PRs.",
  },
  {
    id: "c89",
    cat: "Git/Testing",
    q: "Mock vs stub vs spy?",
    a: "Stub — a replacement that returns preset values. Spy — a wrapper that records how a function was called (arguments, count) while keeping the real behavior (or not). Mock — a pre-configured object with expected calls that verifies them. In Jest the line is blurry (jest.fn, jest.spyOn).",
  },
  {
    id: "c90",
    cat: "Git/Testing",
    q: "What does 100% coverage actually mean?",
    a: "Only that lines/branches executed during tests — not that the logic is correct or that edge cases are covered. You can have 100% and still miss a bug. The goal is confidence in critical paths, not chasing a number. Fewer, meaningful tests beat many shallow ones.",
  },
  {
    id: "c91",
    cat: "Security",
    q: "How should you store passwords correctly?",
    a: "Never in plaintext, and never with a plain hash (MD5/SHA). Use slow, adaptive, salted algorithms: bcrypt, scrypt, or Argon2. The salt is unique per password (bcrypt embeds it in the hash) and defends against rainbow tables; the slowness defends against brute force.",
  },
  {
    id: "c92",
    cat: "Security",
    q: "Access token vs refresh token?",
    a: "Access — short-lived (minutes), sent with every request; if stolen, it expires quickly. Refresh — long-lived, stored more securely (an httpOnly cookie), used only to get a new access token. This balances security and UX; a refresh token can be revoked server-side.",
  },
  {
    id: "c93",
    cat: "Security",
    q: "The difference between XSS and CSRF?",
    a: "XSS — injecting someone else's JS into the page (stealing data/sessions); the defense is output escaping and CSP. CSRF — a malicious site tricks the victim's browser into making a request with their cookies to a trusted site; the defense is CSRF tokens, SameSite cookies, and checking the Origin.",
  },
  {
    id: "c94",
    cat: "System Design",
    q: "Caching strategies?",
    a: "Cache-aside (the most common) — the app reads the cache itself, and on a miss goes to the DB and populates the cache. Write-through — writes to the cache and DB at the same time (consistent, slower). Write-back — writes to the cache first, to the DB later (fast, risk of loss). Plus eviction policies (LRU) and TTL. The main pain point is invalidation.",
  },
  {
    id: "c95",
    cat: "System Design",
    q: "Monolith vs microservices?",
    a: "Monolith — a simpler start, easier to debug/deploy, but harder to scale in parts and can sprawl. Microservices — independent deploy/scaling, fault isolation, but added complexity (networking, consistency, observability, devops). Advice: start with a (modular) monolith, split it up only when there's a real need.",
  },
  {
    id: "c96",
    cat: "System Design",
    q: "How would you design a rate limiter?",
    a: "Algorithms: fixed window (simple, but bursts at the boundary), sliding window (more precise), token bucket / leaky bucket (smooth, allows bursts). Counter state lives in Redis with a TTL (so it works across multiple instances). Return 429 + a Retry-After header.",
  },
  {
    id: "c97",
    cat: "Architecture",
    q: "DRY, KISS, YAGNI — briefly?",
    a: "DRY — don't duplicate knowledge/logic. KISS — keep it simple, don't overcomplicate. YAGNI — don't build what you 'might need later'. Together they save you from over-engineering. But DRY isn't absolute — a premature abstraction just to avoid duplication is sometimes worse than a bit of duplication.",
  },
  {
    id: "c98",
    cat: "Architecture",
    q: "A few design patterns worth knowing?",
    a: "Factory — creating objects without a direct new. Singleton — a single instance (careful, global state). Observer — subscribing to events (EventEmitter, reactivity). Strategy — interchangeable algorithms. Adapter — making incompatible interfaces compatible. Repository — a data-access abstraction. DI in Nest is an implementation of Inversion of Control.",
  },
  {
    id: "c99",
    cat: "Architecture",
    q: "What is event-driven architecture?",
    a: "Components communicate via events/messages instead of direct calls. A producer publishes an event, consumers react asynchronously (through a broker: Kafka/RabbitMQ). Pros: loose coupling, scalability, resilience to spikes. Cons: harder tracing, eventual consistency, consumers need to be idempotent.",
  },
  {
    id: "c100",
    cat: "AI",
    q: "What is RAG and why use it?",
    a: "Retrieval-Augmented Generation: before the LLM answers, we find relevant fragments from our own knowledge base (via embeddings + vector search) and add them to the prompt. This lets the model answer using private/fresh data without fine-tuning, and with less hallucination. Steps: chunking → embeddings → a vector DB (pgvector/Pinecone) → retrieval → prompt.",
  },
  {
    id: "c101",
    cat: "AI",
    q: "What are embeddings and vector search?",
    a: "An embedding is a numeric vector that encodes a text's meaning; texts similar in meaning have nearby vectors. Vector search finds the nearest ones by cosine distance — this is semantic search (by meaning, not by keywords). Stored in pgvector or specialized vector databases.",
  },
  {
    id: "c102",
    cat: "AI",
    q: "How do you deal with LLM hallucinations in production?",
    a: "Grounding in facts (RAG), clear instructions and constraints in the prompt, structured responses (JSON schema / tool calling) validated on the backend, lower temperature for factual tasks, showing sources, a human in the loop for critical decisions, and always validating/sanitizing the output before use. This is exactly what an interviewer is probing for with 'how did you catch incorrect AI-generated code'.",
  },
  {
    id: "c103",
    cat: "AI",
    q: "What is tool/function calling?",
    a: "The LLM can return a structured call to a pre-defined function (with arguments), which your code executes, and the result is fed back to the model. This is how an LLM 'acts' in the real world: querying a DB, calling an API, running calculations. The key is validating the arguments and never blindly trusting the LLM.",
  },
  {
    id: "c104",
    cat: "Behavioral",
    q: "Tell me about a time you quickly learned a new technology.",
    a: "STAR: a concrete situation (e.g. you needed to pick up NestJS or Azure), how you approached it (official docs → a small POC → applying it to a real task), the result. Emphasize a systematic approach to learning — exactly what you're demonstrating right now with React/SQL.",
  },
  {
    id: "c105",
    cat: "Behavioral",
    q: "There was a conflict on the team — how did you resolve it?",
    a: "Show maturity: you listened to the other side, grounded the discussion in facts/data/product goals rather than personalities, found a compromise or escalated constructively. Avoid 'I was right, they were wrong' — focus on the outcome for the team.",
  },
  {
    id: "c106",
    cat: "Behavioral",
    q: "How do you prioritize when there's more work than time?",
    a: "By impact and urgency (something like Eisenhower / value vs effort), aligning with the PO/team, honestly communicating expectations, breaking things down into an MVP. Show that you can say 'no/later' with reasoning, rather than heroically burning out.",
  },
  {
    id: "c107",
    cat: "System Design",
    q: "How do you scale a service as load grows?",
    a: "First vertically (more resources), then horizontally (multiple instances behind a load balancer). Key points: stateless services (state in the DB/Redis, not in process memory), caching (CDN, Redis), DB read replicas, queues for heavy/background work, sharding when needed. Always measure the bottleneck first, don't optimize blindly.",
  },
  {
    id: "c108",
    cat: "System Design",
    q: "When and why would you use a message queue (MQ)?",
    a: "To decouple the producer and consumer and smooth out peak load. Pros: asynchrony, buffering, retries, scaling consumers independently. Examples: sending email, image processing, webhooks. Tools: RabbitMQ, Kafka (stream/log), SQS. Keep idempotency and at-least-once delivery in mind.",
  },
  {
    id: "c109",
    cat: "System Design",
    q: "Caching strategies and invalidation",
    a: "Patterns: cache-aside (read the cache → miss → DB → write to cache), write-through, write-behind. Invalidation — by TTL or event-driven (on data change). The main pain point is consistency: pick a TTL that matches acceptable 'staleness'. Cache hot keys closer to the edge (CDN/edge). 'There are two hard things in CS: cache invalidation and naming things.'",
  },
  {
    id: "c110",
    cat: "System Design",
    q: "SQL or NoSQL — how do you justify the choice?",
    a: "SQL (Postgres): strong consistency, transactions, complex joins, a clear schema — finance, relationships. NoSQL: a flexible schema and horizontal scaling — documents (MongoDB), key-value (Redis), wide columns (Cassandra) for large volumes/simple queries. In an interview, answer based on requirements (access patterns, consistency, volume), not what's trendy.",
  },
  {
    id: "c111",
    cat: "System Design",
    q: "Idempotency and why it matters in APIs",
    a: "An idempotent operation gives the same result on retry (GET/PUT/DELETE — yes, POST — no). This matters under retries and an unreliable network. For POST payments, an Idempotency-Key is used: the server remembers the key and doesn't perform the action twice. Protects against double charges when the client retries a request.",
  },
];

export const DRILLS: DrillItem[] = [
  {
    id: "d0",
    cat: "JavaScript",
    lvl: "easy",
    q: "Implement once(fn)",
    sol: "function once(fn) {\n  let called = false, result;\n  return function (...args) {\n    if (!called) { called = true; result = fn.apply(this, args); }\n    return result;\n  };\n}",
    exp: "A closure holds the called flag and the result between calls.",
  },
  {
    id: "d1",
    cat: "JavaScript",
    lvl: "easy",
    q: "groupBy(arr, keyFn)",
    sol: "function groupBy(arr, keyFn) {\n  return arr.reduce((acc, item) => {\n    const k = keyFn(item);\n    (acc[k] ||= []).push(item);\n    return acc;\n  }, {});\n}\n// groupBy([1,2,3,4], n => n % 2 ? 'odd' : 'even')\n// => { odd: [1,3], even: [2,4] }",
    exp: "reduce with an object accumulator; ||= initializes the array on demand.",
  },
  {
    id: "d2",
    cat: "JavaScript",
    lvl: "med",
    q: "Implement throttle(fn, limit)",
    sol: "function throttle(fn, limit) {\n  let last = 0, timer;\n  return function (...args) {\n    const now = Date.now();\n    const remaining = limit - (now - last);\n    if (remaining <= 0) {\n      clearTimeout(timer); timer = null;\n      last = now;\n      fn.apply(this, args);\n    } else if (!timer) {\n      timer = setTimeout(() => {\n        last = Date.now(); timer = null;\n        fn.apply(this, args);\n      }, remaining);\n    }\n  };\n}",
    exp: "Unlike debounce (run 'after the silence'), throttle caps the rate and guarantees a call at the end of the window.",
  },
  {
    id: "d3",
    cat: "JavaScript",
    lvl: "med",
    q: "Implement Promise.all from scratch",
    sol: "function promiseAll(promises) {\n  return new Promise((resolve, reject) => {\n    const results = [];\n    let done = 0;\n    if (promises.length === 0) return resolve(results);\n    promises.forEach((p, i) => {\n      Promise.resolve(p).then((val) => {\n        results[i] = val;               // store by index\n        if (++done === promises.length) resolve(results);\n      }, reject);                       // the first rejection fails everything\n    });\n  });\n}",
    exp: "The key part: results are stored by index (order preserved), not in completion order.",
  },
  {
    id: "d4",
    cat: "JavaScript",
    lvl: "hard",
    q: "Deep clone with circular references",
    sol: "function deepClone(obj, seen = new WeakMap()) {\n  if (obj === null || typeof obj !== 'object') return obj;\n  if (seen.has(obj)) return seen.get(obj);          // already copied — a cycle\n  const copy = Array.isArray(obj) ? [] : {};\n  seen.set(obj, copy);\n  for (const key of Object.keys(obj)) {\n    copy[key] = deepClone(obj[key], seen);\n  }\n  return copy;\n}\n// Modern alternative (without custom classes): structuredClone(obj)",
    exp: "The WeakMap remembers already-copied objects → safe for cycles and doesn't hold memory.",
  },
  {
    id: "d5",
    cat: "TypeScript",
    lvl: "easy",
    q: "Generic identity",
    sol: "function identity<T>(value: T): T {\n  return value;\n}\nconst a = identity(42);    // a: number\nconst b = identity('hi');  // b: string",
    exp: "",
  },
  {
    id: "d6",
    cat: "TypeScript",
    lvl: "easy",
    q: "Implement MyOmit<T, K>",
    sol: "type MyOmit<T, K extends keyof T> = {\n  [P in keyof T as P extends K ? never : P]: T[P];\n};\n\ntype User = { id: number; name: string; pass: string };\ntype PublicUser = MyOmit<User, 'pass'>; // { id; name }",
    exp: "Key remapping via as + a conditional type: never drops the unwanted key.",
  },
  {
    id: "d7",
    cat: "TypeScript",
    lvl: "med",
    q: "DeepReadonly<T>",
    sol: "type DeepReadonly<T> = {\n  readonly [K in keyof T]: T[K] extends object\n    ? DeepReadonly<T[K]>\n    : T[K];\n};",
    exp: "A recursive mapped type: it descends into nested objects.",
  },
  {
    id: "d8",
    cat: "TypeScript",
    lvl: "med",
    q: "Discriminated union + exhaustive check",
    sol: "type Result =\n  | { status: 'loading' }\n  | { status: 'success'; data: string }\n  | { status: 'error'; message: string };\n\nfunction render(r: Result): string {\n  switch (r.status) {\n    case 'loading': return 'Loading…';\n    case 'success': return r.data;\n    case 'error':   return r.message;\n    default:\n      const _exhaustive: never = r; // errors out if a variant was forgotten\n      return _exhaustive;\n  }\n}",
    exp: "never in default is a compiler safety net for exhaustive handling.",
  },
  {
    id: "d9",
    cat: "TypeScript",
    lvl: "med",
    q: "MyReturnType<F> via infer",
    sol: "type MyReturnType<F> =\n  F extends (...args: any[]) => infer R ? R : never;\n\ntype Fn = () => { id: number };\ntype R = MyReturnType<Fn>; // { id: number }",
    exp: "infer R 'captures' the type inside a conditional type.",
  },
  {
    id: "d10",
    cat: "React",
    lvl: "easy",
    q: "A controlled input",
    sol: "function NameField() {\n  const [name, setName] = useState('');\n  return (\n    <input\n      value={name}\n      onChange={(e) => setName(e.target.value)}\n    />\n  );\n}",
    exp: "",
  },
  {
    id: "d11",
    cat: "React",
    lvl: "easy",
    q: "A custom useToggle hook",
    sol: "function useToggle(initial = false) {\n  const [on, setOn] = useState(initial);\n  const toggle = useCallback(() => setOn((v) => !v), []);\n  return [on, toggle] as const;\n}",
    exp: "as const makes it a tuple, so destructuring is typed precisely.",
  },
  {
    id: "d12",
    cat: "React",
    lvl: "med",
    q: "useFetch with loading/error and cancellation",
    sol: "function useFetch<T>(url: string) {\n  const [data, setData] = useState<T | null>(null);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState<string | null>(null);\n\n  useEffect(() => {\n    const ac = new AbortController();\n    setLoading(true);\n    fetch(url, { signal: ac.signal })\n      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })\n      .then(setData)\n      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); })\n      .finally(() => setLoading(false));\n    return () => ac.abort();   // cleanup: cancel on url change / unmount\n  }, [url]);\n\n  return { data, loading, error };\n}",
    exp: "AbortController + cleanup prevents updating state on an already-unmounted component.",
  },
  {
    id: "d13",
    cat: "React",
    lvl: "med",
    q: "Stop an unnecessary re-render (memo + useCallback)",
    sol: "const Child = React.memo(function Child(\n  { onClick }: { onClick: () => void }\n) {\n  console.log('render Child');\n  return <button onClick={onClick}>+</button>;\n});\n\nfunction Parent() {\n  const [n, setN] = useState(0);\n  // without useCallback — a new reference every time, and memo won't help\n  const inc = useCallback(() => setN((v) => v + 1), []);\n  return <>{n}<Child onClick={inc} /></>;\n}",
    exp: "React.memo does a shallow prop comparison; a stable reference from useCallback lets it actually work.",
  },
  {
    id: "d14",
    cat: "SQL",
    lvl: "easy",
    q: "Users with no orders at all",
    sol: "SELECT u.id, u.name\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nWHERE o.id IS NULL;",
    exp: "LEFT JOIN + IS NULL is an 'anti-join': only rows with no matching pair remain.",
  },
  {
    id: "d15",
    cat: "SQL",
    lvl: "easy",
    q: "Order count by status",
    sol: "SELECT status, COUNT(*) AS cnt\nFROM orders\nGROUP BY status\nORDER BY cnt DESC;",
    exp: "",
  },
  {
    id: "d16",
    cat: "SQL",
    lvl: "med",
    q: "The second-highest salary",
    sol: "SELECT MAX(salary) AS second_highest\nFROM employees\nWHERE salary < (SELECT MAX(salary) FROM employees);\n\n-- Via a window function (more flexible for the Nth place):\n-- SELECT DISTINCT salary FROM (\n--   SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk\n--   FROM employees\n-- ) t WHERE rnk = 2;",
    exp: "The subquery excludes the maximum; DENSE_RANK is more general for the 'Nth' position.",
  },
  {
    id: "d17",
    cat: "SQL",
    lvl: "med",
    q: "A running total (window function)",
    sol: "SELECT created_at, amount,\n       SUM(amount) OVER (ORDER BY created_at) AS running_total\nFROM orders\nORDER BY created_at;",
    exp: "A window function computes a running total without GROUP BY.",
  },
  {
    id: "d18",
    cat: "SQL",
    lvl: "med",
    q: "Avoid N+1 when fetching relations",
    sol: "-- Bad: ORM in a loop — 1 query for projects + N for tasks.\n-- Good: a single JOIN\nSELECT p.id, p.title, t.id AS task_id, t.title AS task_title\nFROM projects p\nLEFT JOIN tasks t ON t.project_id = p.id\nWHERE p.owner_id = $1;\n\n-- Prisma equivalent:\n-- prisma.project.findMany({ where: { ownerId }, include: { tasks: true } })",
    exp: "",
  },
  {
    id: "d19",
    cat: "NestJS",
    lvl: "easy",
    q: "An async wrapper for Express routes",
    sol: "const asyncHandler = (fn) => (req, res, next) =>\n  Promise.resolve(fn(req, res, next)).catch(next);\n\napp.get('/users', asyncHandler(async (req, res) => {\n  const users = await db.users.findAll();\n  res.json(users);\n}));",
    exp: "Any rejection is automatically forwarded to next(err).",
  },
  {
    id: "d20",
    cat: "NestJS",
    lvl: "med",
    q: "An in-memory rate limiter",
    sol: "function rateLimiter({ windowMs, max }) {\n  const hits = new Map(); // ip -> [timestamps]\n  return (req, res, next) => {\n    const now = Date.now();\n    const arr = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);\n    arr.push(now);\n    hits.set(req.ip, arr);\n    if (arr.length > max)\n      return res.status(429).json({ error: 'Too many requests' });\n    next();\n  };\n}",
    exp: "In production — Redis (counters with a TTL), so it works across multiple instances.",
  },
  {
    id: "d21",
    cat: "NestJS",
    lvl: "med",
    q: "Process a large file as a stream",
    sol: "const readline = require('readline');\nconst fs = require('fs');\n\nasync function countLines(path) {\n  const rl = readline.createInterface({\n    input: fs.createReadStream(path),\n  });\n  let n = 0;\n  for await (const line of rl) n++; // read in chunks\n  return n;\n}",
    exp: "Stream + async iteration keeps only the current line in memory.",
  },
  {
    id: "d22",
    cat: "NestJS",
    lvl: "med",
    q: "Retry with exponential backoff",
    sol: "async function retry(fn, retries = 3, delay = 300) {\n  try {\n    return await fn();\n  } catch (e) {\n    if (retries === 0) throw e;\n    await new Promise((r) => setTimeout(r, delay));\n    return retry(fn, retries - 1, delay * 2); // 300 → 600 → 1200\n  }\n}",
    exp: "",
  },
  {
    id: "d23",
    cat: "NestJS",
    lvl: "med",
    q: "A NestJS JWT Guard",
    sol: "@Injectable()\nexport class JwtAuthGuard implements CanActivate {\n  constructor(private jwt: JwtService) {}\n\n  canActivate(ctx: ExecutionContext): boolean {\n    const req = ctx.switchToHttp().getRequest();\n    const token = req.headers.authorization?.split(' ')[1];\n    if (!token) throw new UnauthorizedException();\n    try {\n      req.user = this.jwt.verify(token);\n      return true;\n    } catch {\n      throw new UnauthorizedException();\n    }\n  }\n}",
    exp: "A guard decides 'let it through or not' before the controller; it stores user on the request.",
  },
  {
    id: "d24",
    cat: "Algorithms",
    lvl: "easy",
    q: "Valid Anagram",
    sol: "function isAnagram(s, t) {\n  if (s.length !== t.length) return false;\n  const count = {};\n  for (const c of s) count[c] = (count[c] || 0) + 1;\n  for (const c of t) {\n    if (!count[c]) return false;\n    count[c]--;\n  }\n  return true;\n}\n// Time O(n), space O(1) for a bounded alphabet",
    exp: "",
  },
  {
    id: "d25",
    cat: "Algorithms",
    lvl: "easy",
    q: "Contains Duplicate",
    sol: "function containsDuplicate(nums) {\n  return new Set(nums).size !== nums.length;\n}\n// Time O(n), space O(n)",
    exp: "",
  },
  {
    id: "d26",
    cat: "Algorithms",
    lvl: "med",
    q: "Group Anagrams",
    sol: "function groupAnagrams(strs) {\n  const map = new Map();\n  for (const s of strs) {\n    const key = s.split('').sort().join(''); // canonical form\n    if (!map.has(key)) map.set(key, []);\n    map.get(key).push(s);\n  }\n  return [...map.values()];\n}\n// Time O(n · k log k), k = word length",
    exp: "",
  },
  {
    id: "d27",
    cat: "Algorithms",
    lvl: "med",
    q: "Longest substring without repeats (sliding window)",
    sol: "function lengthOfLongestSubstring(s) {\n  const seen = new Map();\n  let start = 0, max = 0;\n  for (let i = 0; i < s.length; i++) {\n    if (seen.has(s[i]) && seen.get(s[i]) >= start) {\n      start = seen.get(s[i]) + 1;      // shift the window's left edge\n    }\n    seen.set(s[i], i);\n    max = Math.max(max, i - start + 1);\n  }\n  return max;\n}\n// Time O(n) — sliding window",
    exp: "The classic sliding-window pattern: keep a window with no repeats, moving the left edge forward.",
  },
  {
    id: "d28",
    cat: "Algorithms",
    lvl: "med",
    q: "Binary search",
    sol: "function binarySearch(arr, target) {\n  let lo = 0, hi = arr.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;   // divide by 2\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) lo = mid + 1;\n    else hi = mid - 1;\n  }\n  return -1;\n}",
    exp: "A required precondition: the array must be sorted. >> 1 is a fast halving division.",
  },
  {
    id: "d29",
    cat: "Algorithms",
    lvl: "med",
    q: "BFS: level-order tree traversal",
    sol: "function levelOrder(root) {\n  if (!root) return [];\n  const res = [], queue = [root];\n  while (queue.length) {\n    const level = [], size = queue.length;\n    for (let i = 0; i < size; i++) {\n      const node = queue.shift();\n      level.push(node.val);\n      if (node.left) queue.push(node.left);\n      if (node.right) queue.push(node.right);\n    }\n    res.push(level);\n  }\n  return res;\n}\n// Time O(n) — a queue (BFS)",
    exp: "We snapshot the queue's size at the start of each level — that's how levels are separated.",
  },
  {
    id: "d30",
    cat: "Algorithms",
    lvl: "easy",
    q: "FizzBuzz",
    sol: "for (let i = 1; i <= n; i++) {\n  let out = '';\n  if (i % 3 === 0) out += 'Fizz';\n  if (i % 5 === 0) out += 'Buzz';\n  console.log(out || i);\n}",
    exp: "The trick: build up a string, and out || i gives the number if neither condition fired. Avoid a separate i%15 check — the concatenation is more elegant.",
  },
  {
    id: "d31",
    cat: "Algorithms",
    lvl: "easy",
    q: "Valid Parentheses (a stack)",
    sol: "function isValid(s) {\n  const stack = [];\n  const pairs = { ')': '(', ']': '[', '}': '{' };\n  for (const c of s) {\n    if (c === '(' || c === '[' || c === '{') {\n      stack.push(c);\n    } else if (stack.pop() !== pairs[c]) {\n      return false;\n    }\n  }\n  return stack.length === 0;\n}\n// O(n) time, O(n) space",
    exp: "A classic stack application: a closing bracket must match the top of the stack. At the end, the stack must be empty.",
  },
  {
    id: "d32",
    cat: "Algorithms",
    lvl: "easy",
    q: "Two Sum (hash map)",
    sol: "function twoSum(nums, target) {\n  const seen = new Map(); // value -> index\n  for (let i = 0; i < nums.length; i++) {\n    const need = target - nums[i];\n    if (seen.has(need)) return [seen.get(need), i];\n    seen.set(nums[i], i);\n  }\n  return [];\n}\n// O(n) time, O(n) space",
    exp: "The naive solution is two nested loops, O(n²). The optimization: store seen numbers in a Map in one pass and look up the complement. A classic memory-for-time trade-off.",
  },
  {
    id: "d33",
    cat: "Algorithms",
    lvl: "easy",
    q: "Best Time to Buy & Sell Stock",
    sol: "function maxProfit(prices) {\n  let minPrice = Infinity, best = 0;\n  for (const p of prices) {\n    minPrice = Math.min(minPrice, p);   // cheapest so far\n    best = Math.max(best, p - minPrice); // best sale today\n  }\n  return best;\n}\n// O(n) time, O(1) space",
    exp: "A single pass: track the minimum price so far and check the profit from selling at each point.",
  },
  {
    id: "d34",
    cat: "Algorithms",
    lvl: "easy",
    q: "Valid Palindrome (two pointers)",
    sol: "function isPalindrome(s) {\n  s = s.toLowerCase().replace(/[^a-z0-9]/g, '');\n  let l = 0, r = s.length - 1;\n  while (l < r) {\n    if (s[l] !== s[r]) return false;\n    l++; r--;\n  }\n  return true;\n}\n// O(n) time, O(1) extra space (aside from cleanup)",
    exp: "Two pointers closing in from the ends — the basic two-pointers pattern.",
  },
  {
    id: "d35",
    cat: "Algorithms",
    lvl: "med",
    q: "Maximum Subarray (Kadane)",
    sol: "function maxSubArray(nums) {\n  let cur = nums[0], max = nums[0];\n  for (let i = 1; i < nums.length; i++) {\n    cur = Math.max(nums[i], cur + nums[i]); // start fresh or extend\n    max = Math.max(max, cur);\n  }\n  return max;\n}\n// O(n) time, O(1) space",
    exp: "Kadane's algorithm: at every point, decide whether to extend the current running sum or start a new subarray at the current element.",
  },
  {
    id: "d36",
    cat: "Algorithms",
    lvl: "med",
    q: "Product of Array Except Self",
    sol: "function productExceptSelf(nums) {\n  const n = nums.length, res = new Array(n).fill(1);\n  let prefix = 1;\n  for (let i = 0; i < n; i++) {        // products from the left\n    res[i] = prefix;\n    prefix *= nums[i];\n  }\n  let suffix = 1;\n  for (let i = n - 1; i >= 0; i--) {   // multiply in products from the right\n    res[i] *= suffix;\n    suffix *= nums[i];\n  }\n  return res;\n}\n// O(n) time, O(1) extra space (aside from the result)",
    exp: "Two passes: prefix products from the left, then suffix products from the right. Division is disallowed so there's no 'cheating' with total-product/element.",
  },
  {
    id: "d37",
    cat: "Algorithms",
    lvl: "easy",
    q: "Reverse Linked List",
    sol: "function reverseList(head) {\n  let prev = null, curr = head;\n  while (curr) {\n    const next = curr.next; // save the next node\n    curr.next = prev;       // reverse the pointer\n    prev = curr;            // advance prev\n    curr = next;            // advance curr\n  }\n  return prev;\n}\n// O(n) time, O(1) space",
    exp: "Three pointers: prev/curr/next. An iterative solution beats recursion here (no stack-overflow risk).",
  },
  {
    id: "d38",
    cat: "Algorithms",
    lvl: "easy",
    q: "Merge Two Sorted Lists",
    sol: "function mergeTwoLists(l1, l2) {\n  const dummy = { next: null };\n  let tail = dummy;\n  while (l1 && l2) {\n    if (l1.val <= l2.val) { tail.next = l1; l1 = l1.next; }\n    else { tail.next = l2; l2 = l2.next; }\n    tail = tail.next;\n  }\n  tail.next = l1 || l2; // attach the remainder\n  return dummy.next;\n}\n// O(n + m)",
    exp: "A dummy node removes the need to special-case the list's head — a common trick.",
  },
  {
    id: "d39",
    cat: "Algorithms",
    lvl: "med",
    q: "Merge Intervals",
    sol: "function merge(intervals) {\n  intervals.sort((a, b) => a[0] - b[0]); // by start\n  const res = [intervals[0]];\n  for (let i = 1; i < intervals.length; i++) {\n    const last = res[res.length - 1];\n    if (intervals[i][0] <= last[1]) {\n      last[1] = Math.max(last[1], intervals[i][1]); // overlap → extend\n    } else {\n      res.push(intervals[i]);\n    }\n  }\n  return res;\n}\n// O(n log n) due to sorting",
    exp: "The key is sorting by start first — then overlaps become adjacent.",
  },
  {
    id: "d40",
    cat: "Algorithms",
    lvl: "easy",
    q: "Climbing Stairs (DP)",
    sol: "function climbStairs(n) {\n  let a = 1, b = 1;\n  for (let i = 0; i < n; i++) {\n    [a, b] = [b, a + b];\n  }\n  return a;\n}\n// O(n) time, O(1) space",
    exp: "These are Fibonacci numbers: ways(n) = ways(n-1) + ways(n-2). Iterative, with no array and no recursion.",
  },
  {
    id: "d41",
    cat: "Algorithms",
    lvl: "med",
    q: "Number of Islands (DFS)",
    sol: "function numIslands(grid) {\n  let count = 0;\n  const dfs = (r, c) => {\n    if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length || grid[r][c] !== '1') return;\n    grid[r][c] = '0'; // 'sink' the visited cell\n    dfs(r + 1, c); dfs(r - 1, c); dfs(r, c + 1); dfs(r, c - 1);\n  };\n  for (let r = 0; r < grid.length; r++) {\n    for (let c = 0; c < grid[0].length; c++) {\n      if (grid[r][c] === '1') { count++; dfs(r, c); }\n    }\n  }\n  return count;\n}\n// O(m·n)",
    exp: "Every new '1' is a new island; DFS 'floods' the whole connected landmass so it isn't counted twice.",
  },
  {
    id: "d42",
    cat: "Algorithms",
    lvl: "hard",
    q: "LRU Cache (a Senior favorite)",
    sol: "class LRUCache {\n  constructor(capacity) {\n    this.cap = capacity;\n    this.map = new Map(); // Map preserves insertion order\n  }\n  get(key) {\n    if (!this.map.has(key)) return -1;\n    const val = this.map.get(key);\n    this.map.delete(key);\n    this.map.set(key, val); // move to 'most recent'\n    return val;\n  }\n  put(key, val) {\n    if (this.map.has(key)) this.map.delete(key);\n    this.map.set(key, val);\n    if (this.map.size > this.cap) {\n      this.map.delete(this.map.keys().next().value); // evict the oldest\n    }\n  }\n}\n// get/put in O(1)",
    exp: "The trick: a JS Map preserves insertion order, so the first key is the oldest. Delete+set refreshes 'recency'. A classic solution with no hand-rolled doubly linked list.",
  },
  {
    id: "d43",
    cat: "JavaScript",
    lvl: "easy",
    q: "Implement debounce(fn, delay)",
    sol: `function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}`,
    exp: "Every new call resets the timer — fn only runs after a delay-ms pause with no new calls (e.g. search-as-you-type).",
  },
  {
    id: "d44",
    cat: "JavaScript",
    lvl: "med",
    q: "Implement curry(fn)",
    sol: `function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...next) => curried.apply(this, [...args, ...next]);
  };
}
// const add = (a,b,c) => a+b+c; curry(add)(1)(2)(3) === 6`,
    exp: "fn.length is the expected arity. While there are fewer arguments than that, we return a new function that collects the rest.",
  },
  {
    id: "d45",
    cat: "JavaScript",
    lvl: "med",
    q: "Implement memoize(fn)",
    sol: `function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}`,
    exp: "A cache keyed on serialized arguments. For object keys, a WeakMap is better; for complex cases, a custom key resolver.",
  },
  {
    id: "d46",
    cat: "JavaScript",
    lvl: "easy",
    q: "Flatten a nested array",
    sol: `function flatten(arr) {
  return arr.reduce(
    (acc, item) => acc.concat(Array.isArray(item) ? flatten(item) : item),
    []
  );
}
// Natively: arr.flat(Infinity)`,
    exp: "Recursion over nested arrays via reduce. The modern alternative is Array.prototype.flat(Infinity).",
  },
  {
    id: "d47",
    cat: "JavaScript",
    lvl: "med",
    q: "Implement an EventEmitter (on/off/emit)",
    sol: `class EventEmitter {
  constructor() { this.listeners = new Map(); }
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.off(event, cb); // an unsubscribe function
  }
  off(event, cb) { this.listeners.get(event)?.delete(cb); }
  emit(event, ...args) {
    this.listeners.get(event)?.forEach((cb) => cb(...args));
  }
}`,
    exp: "Map<event, Set<cb>>. on returns an unsubscribe function — a handy pattern (like React's useEffect cleanup).",
  },
  {
    id: "d48",
    cat: "JavaScript",
    lvl: "med",
    q: "deepEqual(a, b) — a deep comparison",
    sol: `function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}`,
    exp: "First reference/primitive equality, then key count, then recursion over values.",
  },
  {
    id: "d49",
    cat: "JavaScript",
    lvl: "easy",
    q: "chunk(arr, size) — split into groups",
    sol: `function chunk(arr, size) {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}
// chunk([1,2,3,4,5], 2) => [[1,2],[3,4],[5]]`,
    exp: "Step through the array by size + slice. A classic for pagination/batching.",
  },
  {
    id: "d50",
    cat: "JavaScript",
    lvl: "med",
    q: "compose and pipe",
    sol: `const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);
// pipe(f, g)(x) === g(f(x)); compose(f, g)(x) === f(g(x))`,
    exp: "pipe runs left to right (reduce), compose runs right to left (reduceRight). The foundation of a functional style.",
  },
  {
    id: "d51",
    cat: "JavaScript",
    lvl: "hard",
    q: "asyncPool — cap promise concurrency",
    sol: `async function asyncPool(limit, items, iteratorFn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    results.push(p);
    executing.add(p);
    p.finally(() => executing.delete(p));
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}`,
    exp: "We keep no more than limit promises 'in flight'; Promise.race waits until a slot frees up. This way we don't flood an API with 1000 requests at once.",
  },
  {
    id: "d52",
    cat: "TypeScript",
    lvl: "med",
    q: "DeepPartial<T>",
    sol: `type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};`,
    exp: "A recursive mapped type with ? makes every field optional, including nested ones.",
  },
  {
    id: "d53",
    cat: "TypeScript",
    lvl: "med",
    q: "MyAwaited<T> via infer",
    sol: `type MyAwaited<T> = T extends Promise<infer U>
  ? (U extends Promise<any> ? MyAwaited<U> : U)
  : T;
// MyAwaited<Promise<Promise<number>>> // number`,
    exp: "infer pulls the type out of a Promise; recursion 'unwraps' nested promises (like the built-in Awaited).",
  },
  {
    id: "d54",
    cat: "TypeScript",
    lvl: "easy",
    q: "TupleToUnion<T>",
    sol: `type TupleToUnion<T extends readonly any[]> = T[number];
// TupleToUnion<['a','b','c']> // 'a' | 'b' | 'c'`,
    exp: "Indexing a tuple with number returns the union of all its elements.",
  },
  {
    id: "d55",
    cat: "TypeScript",
    lvl: "easy",
    q: "MyPick<T, K>",
    sol: `type MyPick<T, K extends keyof T> = { [P in K]: T[P] };`,
    exp: "A mapped type over a subset of keys K. K extends keyof T guarantees valid keys.",
  },
  {
    id: "d56",
    cat: "React",
    lvl: "easy",
    q: "A usePrevious(value) hook",
    sol: `function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}`,
    exp: "The effect updates the ref AFTER the render, so during render it still returns the previous value.",
  },
  {
    id: "d57",
    cat: "React",
    lvl: "med",
    q: "A useDebouncedValue(value, delay) hook",
    sol: `function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}`,
    exp: "The cleanup cancels the previous timer — state only updates after a pause. Perfect for a search input.",
  },
  {
    id: "d58",
    cat: "React",
    lvl: "med",
    q: "A useLocalStorage(key, initial) hook",
    sol: `function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : initial;
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}`,
    exp: "Lazy initialization (the useState function reads storage once) + syncing back via an effect.",
  },
  {
    id: "d59",
    cat: "React",
    lvl: "med",
    q: "A useOnClickOutside(ref, handler) hook",
    sol: `function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler(e);
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}`,
    exp: "Listen for clicks on the document; if the click is outside ref, call handler (close a modal/dropdown).",
  },
  {
    id: "d60",
    cat: "React",
    lvl: "med",
    q: "A useInterval(callback, delay) hook",
    sol: `function useInterval(callback, delay) {
  const savedCb = useRef(callback);
  useEffect(() => { savedCb.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCb.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}`,
    exp: "The ref holds the latest callback, so the interval isn't recreated every time (Dan Abramov's pattern).",
  },
  {
    id: "d61",
    cat: "SQL",
    lvl: "med",
    q: "Top-N within each group (window function)",
    sol: `-- Top-3 most expensive products in each category
SELECT category, name, price FROM (
  SELECT category, name, price,
         ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn
  FROM products
) t
WHERE rn <= 3;`,
    exp: "ROW_NUMBER() with PARTITION BY numbers rows within each group; we filter in the outer query.",
  },
  {
    id: "d62",
    cat: "SQL",
    lvl: "med",
    q: "Delete duplicate rows",
    sol: `-- Keep the row with the smallest id for each email
DELETE FROM users a
USING users b
WHERE a.id > b.id AND a.email = b.email;`,
    exp: "A self-join: we delete rows with a larger id, keeping one unique row per email.",
  },
  {
    id: "d63",
    cat: "SQL",
    lvl: "med",
    q: "Days with no orders at all",
    sol: `-- Dates over the past week that had no orders
SELECT d::date
FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') AS d
LEFT JOIN orders o ON o.created_at::date = d::date
WHERE o.id IS NULL;`,
    exp: "generate_series produces every date; LEFT JOIN + IS NULL finds the gaps (an anti-join).",
  },
  {
    id: "d64",
    cat: "SQL",
    lvl: "hard",
    q: "A 7-day moving average",
    sol: `SELECT day, amount,
       AVG(amount) OVER (
         ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
       ) AS moving_avg_7d
FROM daily_sales
ORDER BY day;`,
    exp: "The ROWS BETWEEN ... window frame defines a 'window' of rows for the aggregate — that's how moving metrics are computed.",
  },
  {
    id: "d65",
    cat: "Node.js",
    lvl: "med",
    q: "An in-memory cache with a TTL",
    sol: `class TTLCache {
  constructor() { this.store = new Map(); }
  set(key, value, ttlMs) {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }
  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expires) { this.store.delete(key); return undefined; }
    return hit.value;
  }
}`,
    exp: "We store the expiration time and check it lazily on read (lazy expiration). In production — Redis with a TTL.",
  },
  {
    id: "d66",
    cat: "Node.js",
    lvl: "med",
    q: "A Transform stream (uppercase)",
    sol: `import { Transform } from 'node:stream';

const upper = new Transform({
  transform(chunk, _enc, cb) {
    cb(null, chunk.toString().toUpperCase());
  },
});
// process.stdin.pipe(upper).pipe(process.stdout);`,
    exp: "Transform processes data in chunks without holding it all in memory — critical for large files.",
  },
  {
    id: "d67",
    cat: "Node.js",
    lvl: "med",
    q: "promisify(fn) for a callback-based API",
    sol: `function promisify(fn) {
  return (...args) =>
    new Promise((resolve, reject) => {
      fn(...args, (err, result) => (err ? reject(err) : resolve(result)));
    });
}`,
    exp: "Wraps an error-first callback in a Promise. Node already ships util.promisify.",
  },
  {
    id: "d68",
    cat: "Node.js",
    lvl: "med",
    q: "Graceful shutdown of a server",
    sol: `const server = app.listen(3000);
function shutdown() {
  server.close(() => {
    // close DB, queues, connections here
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref(); // force-exit after 10s
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);`,
    exp: "Stop accepting new connections, wait for in-flight ones, force-exit on a timeout. A must for k8s/deploys.",
  },
  {
    id: "d69",
    cat: "NestJS",
    lvl: "med",
    q: "A custom ParseIntPipe",
    sol: `@Injectable()
export class ParseIntPipe implements PipeTransform {
  transform(value: string) {
    const num = Number(value);
    if (Number.isNaN(num)) throw new BadRequestException('Not a number');
    return num;
  }
}
// @Get(':id') get(@Param('id', ParseIntPipe) id: number) {}`,
    exp: "A pipe transforms/validates an argument before it reaches the handler — the controller stays clean.",
  },
  {
    id: "d70",
    cat: "NestJS",
    lvl: "med",
    q: "A RolesGuard via Reflector",
    sol: `@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', ctx.getHandler());
    if (!roles) return true;
    const { user } = ctx.switchToHttp().getRequest();
    return roles.some((r) => user?.roles?.includes(r));
  }
}`,
    exp: "Reflector reads the @Roles() metadata off the handler; the guard decides access before the controller runs.",
  },
  {
    id: "d71",
    cat: "Algorithms",
    lvl: "easy",
    q: "Move Zeroes",
    sol: `function moveZeroes(nums) {
  let insert = 0;
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== 0) {
      [nums[insert], nums[i]] = [nums[i], nums[insert]];
      insert++;
    }
  }
  return nums;
}
// O(n) time, O(1) space`,
    exp: "Two pointers: insert is the position for the next non-zero element. Zeros 'float' to the end.",
  },
  {
    id: "d72",
    cat: "Algorithms",
    lvl: "med",
    q: "3Sum (triples summing to 0)",
    sol: `function threeSum(nums) {
  nums.sort((a, b) => a - b);
  const res = [];
  for (let i = 0; i < nums.length - 2; i++) {
    if (i > 0 && nums[i] === nums[i - 1]) continue; // skip duplicates
    let l = i + 1, r = nums.length - 1;
    while (l < r) {
      const sum = nums[i] + nums[l] + nums[r];
      if (sum === 0) {
        res.push([nums[i], nums[l], nums[r]]);
        while (l < r && nums[l] === nums[l + 1]) l++;
        while (l < r && nums[r] === nums[r - 1]) r--;
        l++; r--;
      } else if (sum < 0) l++;
      else r--;
    }
  }
  return res;
}
// O(n^2)`,
    exp: "Sort, fix i, then two pointers. Skipping duplicates guarantees unique triples.",
  },
  {
    id: "d73",
    cat: "Algorithms",
    lvl: "med",
    q: "Container With Most Water",
    sol: `function maxArea(height) {
  let l = 0, r = height.length - 1, max = 0;
  while (l < r) {
    const area = Math.min(height[l], height[r]) * (r - l);
    max = Math.max(max, area);
    if (height[l] < height[r]) l++;
    else r--;
  }
  return max;
}
// O(n)`,
    exp: "Two pointers from the ends; move the shorter wall — that's the only way the area can grow.",
  },
  {
    id: "d74",
    cat: "Algorithms",
    lvl: "easy",
    q: "Linked List Cycle (Floyd)",
    sol: `function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
// O(n) time, O(1) space`,
    exp: "'Tortoise and hare': if there's a cycle, the fast pointer is guaranteed to catch up to the slow one.",
  },
  {
    id: "d75",
    cat: "Algorithms",
    lvl: "easy",
    q: "Middle of Linked List",
    sol: `function middleNode(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;
}`,
    exp: "When the fast pointer (step 2) reaches the end, the slow one (step 1) will be exactly in the middle.",
  },
  {
    id: "d76",
    cat: "Algorithms",
    lvl: "med",
    q: "Min Stack (getMin in O(1))",
    sol: `class MinStack {
  constructor() { this.stack = []; this.mins = []; }
  push(x) {
    this.stack.push(x);
    const min = this.mins.length ? Math.min(x, this.mins[this.mins.length - 1]) : x;
    this.mins.push(min);
  }
  pop() { this.mins.pop(); return this.stack.pop(); }
  top() { return this.stack[this.stack.length - 1]; }
  getMin() { return this.mins[this.mins.length - 1]; }
}
// all operations O(1)`,
    exp: "A parallel stack of minimums: on every push we store the current minimum, so getMin is O(1).",
  },
  {
    id: "d77",
    cat: "Algorithms",
    lvl: "med",
    q: "Coin Change (minimum coins)",
    sol: `function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
// O(amount * coins)`,
    exp: "dp[a] is the minimum number of coins for amount a. Build bottom-up, trying every coin.",
  },
  {
    id: "d78",
    cat: "Algorithms",
    lvl: "med",
    q: "House Robber (DP)",
    sol: `function rob(nums) {
  let prev = 0, curr = 0;
  for (const n of nums) {
    [prev, curr] = [curr, Math.max(curr, prev + n)];
  }
  return curr;
}
// O(n) time, O(1) space`,
    exp: "At each house: skip it (curr) or rob it (prev + n). You can't rob two in a row.",
  },
  {
    id: "d79",
    cat: "Algorithms",
    lvl: "hard",
    q: "Course Schedule (topological sort)",
    sol: `function canFinish(numCourses, prerequisites) {
  const graph = Array.from({ length: numCourses }, () => []);
  const indegree = new Array(numCourses).fill(0);
  for (const [course, pre] of prerequisites) {
    graph[pre].push(course);
    indegree[course]++;
  }
  const queue = [];
  for (let i = 0; i < numCourses; i++) if (indegree[i] === 0) queue.push(i);
  let done = 0;
  while (queue.length) {
    const node = queue.shift();
    done++;
    for (const next of graph[node]) {
      if (--indegree[next] === 0) queue.push(next);
    }
  }
  return done === numCourses; // everyone got processed → no cycle
}
// Kahn's algorithm, O(V + E)`,
    exp: "If every node can be ordered (no cycle of dependencies), the courses can actually be completed.",
  },
  {
    id: "d80",
    cat: "Algorithms",
    lvl: "med",
    q: "Kth Largest Element",
    sol: `function findKthLargest(nums, k) {
  return [...nums].sort((a, b) => b - a)[k - 1]; // O(n log n)
  // Optimizations: a min-heap of size k → O(n log k); quickselect → avg O(n)
}`,
    exp: "The simple solution is sorting. In an interview, mention a min-heap (O(n log k)) or quickselect (avg O(n)).",
  },
  {
    id: "d81",
    cat: "Algorithms",
    lvl: "easy",
    q: "Invert Binary Tree",
    sol: `function invertTree(root) {
  if (!root) return null;
  [root.left, root.right] = [invertTree(root.right), invertTree(root.left)];
  return root;
}`,
    exp: "Recursively swap the left and right subtrees. A legendary problem (there's a Google meme about it).",
  },
  {
    id: "d82",
    cat: "Algorithms",
    lvl: "easy",
    q: "Max Depth of Binary Tree",
    sol: `function maxDepth(root) {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}`,
    exp: "Depth = 1 + the max depth of the subtrees. Basic DFS over a tree.",
  },
  {
    id: "d83",
    cat: "Algorithms",
    lvl: "med",
    q: "Validate Binary Search Tree",
    sol: `function isValidBST(root, min = -Infinity, max = Infinity) {
  if (!root) return true;
  if (root.val <= min || root.val >= max) return false;
  return isValidBST(root.left, min, root.val) &&
         isValidBST(root.right, root.val, max);
}`,
    exp: "Pass the valid (min, max) range down the recursion. Comparing only against the parent isn't enough!",
  },
  {
    id: "d84",
    cat: "Algorithms",
    lvl: "med",
    q: "Search in Rotated Sorted Array",
    sol: `function search(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[lo] <= nums[mid]) {              // the left half is sorted
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {                                   // the right half is sorted
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}
// O(log n)`,
    exp: "A modified binary search: one of the two halves is always sorted — figure out which one and narrow the range.",
  },
  {
    id: "d85",
    cat: "Algorithms",
    lvl: "med",
    q: "Subsets (all subsets)",
    sol: `function subsets(nums) {
  const res = [];
  const backtrack = (start, path) => {
    res.push([...path]);
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      backtrack(i + 1, path);
      path.pop();
    }
  };
  backtrack(0, []);
  return res;
}
// O(2^n)`,
    exp: "Backtracking: at every step, either include the element or don't. The basic template for combinatorial problems.",
  },
  {
    id: "d86",
    cat: "System Design",
    lvl: "med",
    q: "Design a URL shortener (bit.ly)",
    sol: `Requirements: a short code → a long URL, redirect, ~100:1 read/write.

API:
  POST /shorten { url } -> { shortCode }
  GET /:code -> 301 redirect

Generating the code:
  - base62(id) from an auto-increment (short, no collisions), or
  - hash(url) with collision checking.

Storage:
  code (PK) | long_url | created_at | clicks
  Key-value (Redis) for hot reads + a DB as the source of truth.

Scale:
  - Cache redirects (99% reads) in Redis/CDN.
  - DB read replicas.
  - 7 base62 characters = 62^7 ≈ 3.5 trillion URLs.`,
    exp: "Discuss: code generation (counter vs hash), a cache for reads, click analytics asynchronously via a queue, TTL for temporary links.",
  },
  {
    id: "d87",
    cat: "System Design",
    lvl: "med",
    q: "Design a rate limiter",
    sol: `Goal: no more than N requests per user within window T.

Algorithms:
  - Fixed window: a counter on the key user:minute (simple, but bursts at the window boundary).
  - Sliding window log/counter: more precise, more expensive.
  - Token bucket: allows controlled bursts (the most common one).

Implementation (token bucket in Redis):
  - key = user_id; fields: tokens, last_refill.
  - on a request: refill tokens based on elapsed time; if >=1, deduct and allow; otherwise 429.
  - atomicity via a Lua script / MULTI.

Distributed: a shared Redis, so the limit applies across all instances.`,
    exp: "Mention: 429 Too Many Requests + a Retry-After header; token bucket is the de-facto standard; atomicity is critical under concurrent requests.",
  },
  {
    id: "d88",
    cat: "System Design",
    lvl: "hard",
    q: "Design a news feed",
    sol: `Two delivery approaches:
  - Fan-out on write (push): when the author posts, push their id into every follower's feed (a Redis list). Fast reads, expensive writes for 'celebrities'.
  - Fan-out on read (pull): read the posts of everyone you follow and merge them. Cheap writes, more expensive reads.
  - Hybrid: push for regular accounts, pull for accounts with millions of followers.

Components:
  - Post service, Graph service (follows), Feed service, a Redis cache of feeds.
  - Ranking (time/relevance) + pagination (cursor, not offset).
  - Media via a CDN.`,
    exp: "The classic push vs pull dilemma. The key is a hybrid for 'hot users', cursor pagination, and caching pre-built feeds.",
  },
];
