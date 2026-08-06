import { getCards, getDrills } from "../study/tracks/index.js";
import { getLocale } from "../../core/request-context.js";
import { buildKbUk } from "./knowledge-base.uk.js";
import { DEFAULT_TRACK, type Track } from "../../shared/tracks.js";

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
  JavaScript: {
    cat: "JavaScript",
    learn: [
      "Closures, scope, the event loop (micro vs macro tasks)",
      "Prototypes, `this` binding, ES modules",
      "Promises/async-await, error handling",
      "Array/object methods, destructuring, spread",
    ],
    resources: [
      R("MDN JavaScript Guide", "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide"),
      R("JavaScript.info", "https://javascript.info/"),
      R("You Don't Know JS (book series)", "https://github.com/getify/You-Dont-Know-JS"),
    ],
  },
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
    cat: "Git/Testing",
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

  // ---------- Data track additions ----------
  pandas: {
    cat: "Tools",
    learn: [
      "DataFrame/Series basics, indexing, filtering",
      "groupby (split-apply-combine), merge/join",
      "Reshaping: pivot_table, melt",
      "Handling missing data, dtypes",
    ],
    resources: [
      R("pandas Docs", "https://pandas.pydata.org/docs/"),
      R("pandas User Guide", "https://pandas.pydata.org/docs/user_guide/index.html"),
      R("Kaggle — Pandas (practice)", "https://www.kaggle.com/learn/pandas"),
    ],
  },
  NumPy: {
    cat: "Tools",
    learn: [
      "ndarray, vectorized operations, broadcasting",
      "Indexing/slicing, aggregation functions",
      "Why it's faster than plain Python lists",
    ],
    resources: [
      R("NumPy Docs", "https://numpy.org/doc/stable/"),
      R("NumPy: the absolute basics", "https://numpy.org/doc/stable/user/absolute_beginners.html"),
    ],
  },
  "scikit-learn": {
    cat: "Modeling",
    learn: [
      "Estimator API: fit/predict/transform",
      "train_test_split, cross_val_score, Pipeline",
      "Regression/classification/clustering models",
      "Preprocessing (StandardScaler, encoders)",
    ],
    resources: [
      R("scikit-learn Docs", "https://scikit-learn.org/stable/"),
      R("scikit-learn Tutorials", "https://scikit-learn.org/stable/tutorial/index.html"),
    ],
  },
  dbt: {
    cat: "Collection",
    learn: ["Models as SELECT statements, ref()/source()", "Tests, documentation, lineage graph", "ELT: transforming inside the warehouse"],
    resources: [R("dbt Docs", "https://docs.getdbt.com/"), R("dbt Guides", "https://docs.getdbt.com/guides")],
  },
  Airflow: {
    cat: "Collection",
    learn: ["DAGs, tasks, operators, dependencies", "Scheduling, retries, backfills", "Monitoring/alerting for pipeline failures"],
    resources: [
      R("Apache Airflow Docs", "https://airflow.apache.org/docs/apache-airflow/stable/index.html"),
      R("Apache Airflow", "https://airflow.apache.org/"),
    ],
  },
  "Power BI": {
    cat: "Visualization",
    learn: ["Data modeling, relationships, DAX measures", "Reports/dashboards, row-level security", "Power Query for transformation"],
    resources: [
      R("Power BI Docs", "https://learn.microsoft.com/en-us/power-bi/"),
      R("Power BI Fundamentals", "https://learn.microsoft.com/en-us/power-bi/fundamentals/"),
    ],
  },
  Tableau: {
    cat: "Visualization",
    learn: ["Dimensions vs measures, calculated fields", "Dashboards, filters, actions", "Choosing the right chart type"],
    resources: [
      R("Tableau Training", "https://www.tableau.com/learn/training"),
      R("Tableau Help", "https://help.tableau.com/current/pro/desktop/en-us/default.htm"),
    ],
  },
  Looker: {
    cat: "Visualization",
    learn: [
      "LookML semantic layer, explores/views",
      "Governed metrics shared across dashboards",
      "Self-service exploration for stakeholders",
    ],
    resources: [R("Looker Docs", "https://cloud.google.com/looker/docs")],
  },
  BigQuery: {
    cat: "Collection",
    learn: ["Serverless SQL warehouse, partitioning/clustering", "Cost control (query bytes scanned)", "Standard SQL, scheduled queries"],
    resources: [
      R("BigQuery Docs", "https://cloud.google.com/bigquery/docs"),
      R("BigQuery Introduction", "https://cloud.google.com/bigquery/docs/introduction"),
    ],
  },
  Snowflake: {
    cat: "Collection",
    learn: ["Virtual warehouses (compute/storage separation)", "Micro-partitions, time travel", "Semi-structured data (VARIANT/JSON)"],
    resources: [R("Snowflake Docs", "https://docs.snowflake.com/en/"), R("Snowflake Guides", "https://www.snowflake.com/guides/")],
  },
  Redshift: {
    cat: "Collection",
    learn: ["Columnar storage, distribution/sort keys", "COPY for bulk loads, WLM/query queues", "Redshift Spectrum for querying S3 data"],
    resources: [
      R("Amazon Redshift Getting Started", "https://docs.aws.amazon.com/redshift/latest/gsg/"),
      R("Amazon Redshift Docs", "https://docs.aws.amazon.com/redshift/"),
    ],
  },
  Databricks: {
    cat: "Collection",
    learn: ["Lakehouse architecture, Delta Lake", "Notebooks, clusters, Spark under the hood", "MLflow for experiment tracking"],
    resources: [R("Databricks Docs", "https://docs.databricks.com/en/index.html")],
  },
  Excel: {
    cat: "Tools",
    learn: ["Pivot tables, VLOOKUP/INDEX-MATCH/XLOOKUP", "Formulas, conditional formatting", "Basic VBA/macros for repetitive tasks"],
    resources: [
      R("Microsoft Excel Support", "https://support.microsoft.com/en-us/excel"),
      R("Exceljet (tips & formulas)", "https://exceljet.net/"),
    ],
  },
  Jupyter: {
    cat: "Tools",
    learn: [
      "Notebook workflow for exploratory analysis",
      "Magic commands, kernel/cell execution model",
      "Why notebooks aren't ideal for production code",
    ],
    resources: [R("Jupyter Docs", "https://docs.jupyter.org/en/latest/"), R("Project Jupyter", "https://jupyter.org/")],
  },
  "Google Sheets": {
    cat: "Tools",
    learn: ["Pivot tables, QUERY/ARRAYFORMULA", "Data validation, conditional formatting", "Apps Script for automation"],
    resources: [
      R("Google Docs Editors Help", "https://support.google.com/docs"),
      R("Google Sheets", "https://workspace.google.com/products/sheets/"),
    ],
  },
  "Google Analytics": {
    cat: "Tools",
    learn: ["Events, conversions, audiences (GA4 model)", "Funnels/retention reports", "Linking to BigQuery for raw event export"],
    resources: [
      R("Google Analytics Help", "https://support.google.com/analytics"),
      R("Google Analytics Academy", "https://analytics.google.com/analytics/academy/"),
    ],
  },
  ETL: {
    cat: "Collection",
    learn: ["Extract/Transform/Load vs ELT", "Idempotency, incremental loads, backfills", "Data quality checks in the pipeline"],
    resources: [
      R("AWS — What is ETL?", "https://aws.amazon.com/what-is/etl/"),
      R("Google Cloud — What is ETL?", "https://cloud.google.com/learn/what-is-etl"),
    ],
  },
  "A/B Testing": {
    cat: "Core",
    learn: ["Randomization, sample size/power, MDE", "Guardrail metrics, avoiding peeking", "Statistical vs practical significance"],
    resources: [
      R("VWO — A/B Testing Guide", "https://vwo.com/ab-testing/"),
      R("Optimizely — A/B Testing Glossary", "https://www.optimizely.com/optimization-glossary/ab-testing/"),
    ],
  },
  "Machine Learning": {
    cat: "Modeling",
    learn: [
      "Supervised/unsupervised/reinforcement learning",
      "Train/test split, overfitting, evaluation metrics",
      "Feature engineering, model selection",
    ],
    resources: [
      R("Google — Machine Learning Crash Course", "https://developers.google.com/machine-learning/crash-course"),
      R("scikit-learn Docs", "https://scikit-learn.org/stable/"),
    ],
  },
  "Hypothesis Testing": {
    cat: "Core",
    learn: ["Null/alternative hypothesis, p-values", "Type I/II errors, statistical power", "t-test, chi-square, one- vs two-tailed"],
    resources: [
      R("Khan Academy — Significance Tests", "https://www.khanacademy.org/math/statistics-probability/significance-tests-one-sample"),
    ],
  },
  "Statistics Fundamentals": {
    cat: "Core",
    learn: ["Mean/median/mode, variance/std dev", "Distributions, the Central Limit Theorem", "Correlation vs causation, sampling bias"],
    resources: [
      R("Khan Academy — Statistics & Probability", "https://www.khanacademy.org/math/statistics-probability"),
      R("Seeing Theory (visual intro to stats)", "https://seeing-theory.brown.edu/"),
    ],
  },
  "Data Governance": {
    cat: "Core",
    learn: ["Data quality, lineage, access control", "PII/compliance (GDPR), retention policies", "Data catalogs and ownership"],
    resources: [
      R("AWS — What is Data Governance?", "https://aws.amazon.com/what-is/data-governance/"),
      R("Google Cloud — What is Data Governance?", "https://cloud.google.com/learn/what-is-data-governance"),
    ],
  },
  "Feature Engineering": {
    cat: "Modeling",
    learn: ["Encoding categoricals, scaling, binning", "Date/time features, aggregation features", "Domain-driven feature creation"],
    resources: [R("Kaggle — Feature Engineering (practice)", "https://www.kaggle.com/learn/feature-engineering")],
  },
  "Regression Analysis": {
    cat: "Modeling",
    learn: ["Linear/logistic regression assumptions", "Coefficient interpretation, odds ratios", "Regularization (L1/L2)"],
    resources: [
      R("scikit-learn — Linear Models", "https://scikit-learn.org/stable/modules/linear_model.html"),
      R(
        "Khan Academy — Relationships in Data",
        "https://www.khanacademy.org/math/statistics-probability/describing-relationships-quantitative-data",
      ),
    ],
  },
  Classification: {
    cat: "Modeling",
    learn: [
      "Decision trees, random forest, gradient boosting",
      "Confusion matrix, precision/recall/F1, ROC-AUC",
      "Handling class imbalance",
    ],
    resources: [R("scikit-learn — Supervised Learning", "https://scikit-learn.org/stable/supervised_learning.html")],
  },
  "Time Series Analysis": {
    cat: "Modeling",
    learn: ["Trend, seasonality, stationarity", "ARIMA basics, moving averages", "Train/test split by time, not randomly"],
    resources: [
      R("statsmodels — Time Series Analysis", "https://www.statsmodels.org/stable/tsa.html"),
      R("pandas — Time Series Guide", "https://pandas.pydata.org/docs/user_guide/timeseries.html"),
    ],
  },
  "Data Cleaning": {
    cat: "Collection",
    learn: ["Missing values (deletion vs imputation)", "Outlier detection (z-score, IQR)", "Deduplication, data type/format consistency"],
    resources: [R("Kaggle — Data Cleaning (practice)", "https://www.kaggle.com/learn/data-cleaning")],
  },
  "Data Visualization": {
    cat: "Visualization",
    learn: [
      "Matching chart type to the comparison being made",
      "Avoiding misleading charts (truncated axes, dual axes)",
      "Dashboard design, color/accessibility",
    ],
    resources: [
      R("Kaggle — Data Visualization (practice)", "https://www.kaggle.com/learn/data-visualization"),
      R("The Data Visualisation Catalogue", "https://datavizcatalogue.com/"),
    ],
  },
  "Data Warehousing": {
    cat: "Collection",
    learn: ["Star schema (fact/dimension tables)", "OLTP vs OLAP, ETL/ELT", "Slowly changing dimensions"],
    resources: [
      R("AWS — What is a Data Warehouse?", "https://aws.amazon.com/what-is/data-warehouse/"),
      R("Google Cloud — What is a Data Warehouse?", "https://cloud.google.com/learn/what-is-a-data-warehouse"),
    ],
  },
  "Dimensional Modeling": {
    cat: "Collection",
    learn: ["Fact vs dimension tables, grain", "Star vs snowflake schema", "Slowly changing dimensions (Type 1/2)"],
    resources: [R("Kimball Group (dimensional modeling resources)", "https://www.kimballgroup.com/")],
  },

  // ---------- DevOps track additions ----------
  Linux: {
    cat: "Core",
    learn: [
      "Processes, signals, systemd/systemctl, journalctl",
      "File permissions (chmod/chown/umask), inodes, filesystems",
      "Networking basics: ip/ss, DNS, firewalls (iptables/nft)",
      "Shell tools: grep/sed/awk, pipes, redirection",
    ],
    resources: [
      R("Linux Journey", "https://linuxjourney.com/"),
      R("The Linux Documentation Project", "https://tldp.org/"),
      R("Arch Wiki (excellent reference, distro-agnostic in practice)", "https://wiki.archlinux.org/"),
    ],
  },
  "Bash Scripting": {
    cat: "Core",
    learn: [
      "set -euo pipefail, quoting, parameter expansion",
      "Functions, arrays, conditionals, loops",
      "Common pitfalls: word splitting, globbing, unset variables",
    ],
    resources: [
      R("Bash Manual (GNU)", "https://www.gnu.org/software/bash/manual/bash.html"),
      R("ShellCheck (lint your scripts)", "https://www.shellcheck.net/"),
      R("Bash Guide (Wooledge)", "https://mywiki.wooledge.org/BashGuide"),
    ],
  },
  systemd: {
    cat: "Core",
    learn: [
      "Unit files (.service/.timer), dependencies (After=/Requires=)",
      "systemctl start/stop/enable/status, journalctl",
      "Timers as a cron alternative",
    ],
    resources: [
      R("systemd.service man page", "https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html"),
      R("systemd.timer man page", "https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html"),
    ],
  },
  Terraform: {
    cat: "Cloud",
    learn: [
      "HCL syntax, providers, resources, data sources",
      "State: plan/apply workflow, remote state + locking",
      "Modules, variables/outputs, workspaces",
    ],
    resources: [
      R("Terraform Docs", "https://developer.hashicorp.com/terraform/docs"),
      R("Terraform Tutorials", "https://developer.hashicorp.com/terraform/tutorials"),
      R("Terraform Registry (providers/modules)", "https://registry.terraform.io/"),
    ],
  },
  Ansible: {
    cat: "Tools",
    learn: [
      "Playbooks, tasks, idempotent modules",
      "Inventory (static/dynamic), roles, variables",
      "Handlers, templates (Jinja2), vault for secrets",
    ],
    resources: [
      R("Ansible Docs", "https://docs.ansible.com/ansible/latest/index.html"),
      R("Ansible Getting Started", "https://www.ansible.com/resources/get-started"),
    ],
  },
  "GitHub Actions": {
    cat: "CI/CD",
    learn: [
      "Workflows, jobs, steps, runners (hosted/self-hosted)",
      "Matrix builds, caching, artifacts",
      "Secrets, environments, reusable workflows",
    ],
    resources: [
      R("GitHub Actions Docs", "https://docs.github.com/en/actions"),
      R("GitHub Actions Marketplace", "https://github.com/marketplace?type=actions"),
    ],
  },
  Jenkins: {
    cat: "CI/CD",
    learn: ["Declarative vs scripted pipelines", "Agents, stages, post actions", "Plugins ecosystem, distributed builds"],
    resources: [
      R("Jenkins Docs", "https://www.jenkins.io/doc/"),
      R("Jenkins Pipeline Tutorial", "https://www.jenkins.io/doc/pipeline/tour/getting-started/"),
    ],
  },
  GitOps: {
    cat: "CI/CD",
    learn: [
      "Git as the single source of truth for desired state",
      "Reconciliation loop, drift detection/correction",
      "Pull-based vs push-based deployment",
    ],
    resources: [R("OpenGitOps Principles", "https://opengitops.dev/"), R("Flux Concepts", "https://fluxcd.io/flux/concepts/")],
  },
  ArgoCD: {
    cat: "CI/CD",
    learn: [
      "Application CRD, sync policies (manual/automated)",
      "App of Apps pattern, Helm/Kustomize integration",
      "RBAC, SSO, notifications",
    ],
    resources: [
      R("Argo CD Docs", "https://argo-cd.readthedocs.io/en/stable/"),
      R("Argo CD Getting Started", "https://argo-cd.readthedocs.io/en/stable/getting_started/"),
    ],
  },
  "Blue-Green Deployment": {
    cat: "CI/CD",
    learn: ["Two identical environments, instant traffic cutover", "Rollback = switch back; double infra cost during cutover"],
    resources: [R("Martin Fowler -- BlueGreenDeployment", "https://martinfowler.com/bliki/BlueGreenDeployment.html")],
  },
  "Canary Deployment": {
    cat: "CI/CD",
    learn: ["Gradual traffic shift to a new version while monitoring", "Blast-radius limiting vs blue-green's instant cutover"],
    resources: [R("Martin Fowler -- CanaryRelease", "https://martinfowler.com/bliki/CanaryRelease.html")],
  },
  "Feature Flags": {
    cat: "CI/CD",
    learn: ["Decoupling deploy from release", "Kill switches, gradual rollout, targeting/cohorts"],
    resources: [
      R("LaunchDarkly -- Feature Flag Guide", "https://docs.launchdarkly.com/home"),
      R("Martin Fowler -- Feature Toggles", "https://martinfowler.com/articles/feature-toggles.html"),
    ],
  },
  Prometheus: {
    cat: "Monitoring",
    learn: [
      "Pull-based scraping, exporters, service discovery",
      "PromQL: counters/gauges/histograms, rate()/histogram_quantile()",
      "Alertmanager: alerting rules, routing, silences",
    ],
    resources: [
      R("Prometheus Docs", "https://prometheus.io/docs/introduction/overview/"),
      R("PromQL Basics", "https://prometheus.io/docs/prometheus/latest/querying/basics/"),
    ],
  },
  Grafana: {
    cat: "Monitoring",
    learn: [
      "Dashboards/panels, data sources (Prometheus/Loki/SQL/...)",
      "Alerting, variables/templating",
      "Provisioning dashboards as code",
    ],
    resources: [R("Grafana Docs", "https://grafana.com/docs/grafana/latest/"), R("Grafana Play (live demo)", "https://play.grafana.org/")],
  },
  "Distributed Tracing": {
    cat: "Monitoring",
    learn: [
      "Trace/span model, context propagation",
      "OpenTelemetry instrumentation (auto vs manual)",
      "Visualizing traces (Jaeger/Tempo/Zipkin)",
    ],
    resources: [R("OpenTelemetry Docs", "https://opentelemetry.io/docs/"), R("Jaeger Docs", "https://www.jaegertracing.io/docs/latest/")],
  },
  "Log Aggregation": {
    cat: "Monitoring",
    learn: [
      "Centralized, indexed, searchable logs across a fleet",
      "ELK/Elastic stack vs Grafana Loki (labels-only indexing)",
      "Structured logging, retention policies",
    ],
    resources: [
      R("Grafana Loki Docs", "https://grafana.com/docs/loki/latest/"),
      R("Elasticsearch Reference", "https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html"),
    ],
  },
  "SRE/SLO": {
    cat: "Monitoring",
    learn: [
      "SLI/SLO/SLA, error budgets",
      "Golden signals (latency, traffic, errors, saturation)",
      "Multi-window, multi-burn-rate alerting",
    ],
    resources: [
      R("Google SRE Book", "https://sre.google/sre-book/table-of-contents/"),
      R("Google SRE Workbook", "https://sre.google/workbook/table-of-contents/"),
    ],
  },
  "Incident Response": {
    cat: "Monitoring",
    learn: ["On-call, escalation policies, runbooks", "Incident commander role, mitigate-first discipline", "Blameless postmortems"],
    resources: [
      R("Google SRE Book -- Managing Incidents", "https://sre.google/sre-book/managing-incidents/"),
      R("PagerDuty Incident Response Docs", "https://response.pagerduty.com/"),
    ],
  },
  "Chaos Engineering": {
    cat: "Monitoring",
    learn: ["Hypothesis-driven fault injection, blast-radius limits", "Steady-state baseline, abort conditions"],
    resources: [R("Principles of Chaos Engineering", "https://principlesofchaos.org/")],
  },
  Helm: {
    cat: "Containers",
    learn: ["Charts, templates, values.yaml", "Releases, upgrade/rollback, repositories"],
    resources: [
      R("Helm Docs", "https://helm.sh/docs/"),
      R("Helm Chart Template Guide", "https://helm.sh/docs/chart_template_guide/getting_started/"),
    ],
  },
  "Container Registry": {
    cat: "Containers",
    learn: ["Image tags vs immutable digests", "Content-addressed layers, push/pull efficiency", "Vulnerability scanning, image signing"],
    resources: [
      R("Docker Hub Docs", "https://docs.docker.com/docker-hub/"),
      R("AWS ECR Docs", "https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html"),
    ],
  },
  "VPC/Networking": {
    cat: "Cloud",
    learn: [
      "Subnets (public/private), route tables",
      "Internet Gateway vs NAT Gateway",
      "Security groups vs network ACLs, VPC peering/Transit Gateway",
    ],
    resources: [
      R("AWS VPC Docs", "https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html"),
      R("AWS VPC Peering Docs", "https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html"),
    ],
  },
  IAM: {
    cat: "Cloud",
    learn: ["Users/roles/policies, least privilege", "Role assumption, temporary credentials", "Permissions boundaries"],
    resources: [
      R("AWS IAM Docs", "https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html"),
      R("AWS IAM Best Practices", "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html"),
    ],
  },
  "Load Balancing": {
    cat: "Cloud",
    learn: ["L4 vs L7 load balancing", "Health checks, sticky sessions, TLS termination", "Autoscaling integration"],
    resources: [
      R("AWS Elastic Load Balancing Docs", "https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html"),
    ],
  },
  "Secrets Management": {
    cat: "Cloud",
    learn: ["Encrypted storage, access control via IAM", "Automatic rotation, audit trails", "Runtime injection vs baked-in credentials"],
    resources: [
      R("AWS Secrets Manager Docs", "https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html"),
      R("Azure Key Vault Docs", "https://learn.microsoft.com/en-us/azure/key-vault/general/overview"),
    ],
  },
  "Auto Scaling": {
    cat: "Cloud",
    learn: [
      "Scaling policies: target tracking, step, scheduled",
      "Health checks and instance replacement",
      "Integration with load balancers",
    ],
    resources: [R("AWS Auto Scaling Docs", "https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html")],
  },
  Vault: {
    cat: "Tools",
    learn: ["KV secrets engine, dynamic secrets", "Policies (path-based access control)", "Auth methods, audit devices"],
    resources: [
      R("Vault Docs", "https://developer.hashicorp.com/vault/docs"),
      R("Vault Tutorials", "https://developer.hashicorp.com/vault/tutorials"),
    ],
  },
  Nginx: {
    cat: "Tools",
    learn: ["Reverse proxy, upstream/load-balancing directives", "TLS termination, static file serving", "Rate limiting, header rewriting"],
    resources: [R("Nginx Docs", "https://nginx.org/en/docs/"), R("Nginx Admin Guide (F5)", "https://docs.nginx.com/nginx/admin-guide/")],
  },
  Vagrant: {
    cat: "Tools",
    learn: ["Vagrantfile, boxes, providers (VirtualBox/VMware)", "Provisioning (shell/Ansible), synced folders"],
    resources: [R("Vagrant Docs", "https://developer.hashicorp.com/vagrant/docs")],
  },
  Packer: {
    cat: "Tools",
    learn: ["Templates, builders (amazon-ebs, docker, ...)", "Provisioners (shell/Ansible) baked into the image"],
    resources: [R("Packer Docs", "https://developer.hashicorp.com/packer/docs")],
  },
  "Configuration Drift": {
    cat: "Tools",
    learn: ["Detecting drift: terraform plan, Ansible --check", "Prevention: restricting direct access, GitOps reconciliation"],
    resources: [
      R("Terraform -- Resource Drift Tutorial", "https://developer.hashicorp.com/terraform/tutorials/state/resource-drift"),
      R("AWS Config Docs", "https://docs.aws.amazon.com/config/latest/developerguide/WhatIsConfig.html"),
    ],
  },
  // ---------- QA track ----------
  Selenium: {
    cat: "Automation",
    learn: [
      "Locator strategies (id/CSS/XPath), explicit vs implicit waits",
      "Page Object Model, Selenium Grid for parallel/cross-browser runs",
      "WebDriver architecture, browser drivers",
    ],
    resources: [
      R("Selenium Docs", "https://www.selenium.dev/documentation/"),
      R("Selenium — Waiting Strategies", "https://www.selenium.dev/documentation/webdriver/waits/"),
      R("Selenium — Page Object Models", "https://www.selenium.dev/documentation/test_practices/encouraged/page_object_models/"),
    ],
  },
  Cypress: {
    cat: "Automation",
    learn: [
      "Automatic retry-ability, cy.intercept for network stubbing",
      "Custom commands, fixtures, cy.session for auth reuse",
      "Same-origin model and its practical limits vs Playwright",
    ],
    resources: [
      R("Cypress Docs", "https://docs.cypress.io/guides/overview/why-cypress"),
      R("Cypress — Best Practices", "https://docs.cypress.io/guides/references/best-practices"),
    ],
  },
  Appium: {
    cat: "Automation",
    learn: [
      "WebDriver-protocol mobile automation (iOS/Android)",
      "Locating native elements (accessibility id, UiAutomator/XCUITest selectors)",
      "Real device vs emulator/simulator trade-offs",
    ],
    resources: [R("Appium Docs", "https://appium.io/docs/en/latest/")],
  },
  "Page Object Model": {
    cat: "Automation",
    learn: [
      "Encapsulate locators/actions per page or component, keep assertions in the test",
      "Compose shared components (header/nav) instead of duplicating locators",
      "Avoid a 'God object' — model around business actions, not raw selectors",
    ],
    resources: [
      R("Selenium — Page Object Models", "https://www.selenium.dev/documentation/test_practices/encouraged/page_object_models/"),
      R("Test Automation University (free courses)", "https://testautomationu.applitools.com/"),
    ],
  },
  "Test Automation Framework": {
    cat: "Automation",
    learn: [
      "Hybrid frameworks: POM + data-driven + keyword-driven, sharing one driver/utility layer",
      "Test isolation, independent setup/teardown per test",
      "Deciding what to automate vs keep manual (ROI: repetition, stability, business value)",
    ],
    resources: [R("Test Automation University (free courses)", "https://testautomationu.applitools.com/")],
  },
  "Cucumber/BDD": {
    cat: "Automation",
    learn: [
      "Gherkin (Given/When/Then), Scenario Outline + Examples for data-driven scenarios",
      "Step definitions mapping Gherkin to automation code",
      "Collaborating on scenarios with non-technical stakeholders before automating",
    ],
    resources: [R("Cucumber Docs", "https://cucumber.io/docs/cucumber/")],
  },
  "Visual Regression Testing": {
    cat: "Automation",
    learn: [
      "Screenshot diffing against an approved baseline to catch layout/CSS regressions",
      "Handling intentional visual changes: baseline approval workflow",
      "Complements (not replaces) functional/DOM-based assertions",
    ],
    resources: [
      R("Playwright — Visual Comparisons", "https://playwright.dev/docs/test-snapshots"),
      R("Test Automation University (free courses)", "https://testautomationu.applitools.com/"),
    ],
  },
  "Robot Framework": {
    cat: "Automation",
    learn: ["Keyword-driven syntax, readable by non-programmers", "Libraries (SeleniumLibrary, RequestsLibrary) for web/API automation"],
    resources: [R("Robot Framework Docs", "https://robotframework.org/")],
  },
  "Data-Driven Testing": {
    cat: "Automation",
    learn: [
      "Parameterize one test with many input sets instead of duplicating test bodies",
      "Sourcing data: inline arrays, CSV/JSON fixtures, spreadsheets",
    ],
    resources: [R("Test Automation University (free courses)", "https://testautomationu.applitools.com/")],
  },
  Postman: {
    cat: "API Testing",
    learn: [
      "Collections, environments/variables, pre-request and test scripts",
      "Chaining requests (extract a value, store it, reuse via {{var}})",
      "Newman for running collections headlessly in CI",
    ],
    resources: [
      R("Postman Learning Center", "https://learning.postman.com/docs/getting-started/overview/"),
      R("Postman — Writing Tests", "https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/"),
    ],
  },
  Newman: {
    cat: "API Testing",
    learn: ["Running a Postman collection from the CLI", "Integrating collection runs into a CI pipeline"],
    resources: [R("Newman (GitHub)", "https://github.com/postmanlabs/newman")],
  },
  "Contract Testing": {
    cat: "API Testing",
    learn: [
      "Consumer-driven contracts: the consumer defines expectations, the provider verifies independently",
      "Catches integration-breaking changes earlier/cheaper than full e2e integration tests",
      "Pact as the most common implementation",
    ],
    resources: [R("Pact Docs", "https://docs.pact.io/")],
  },
  WireMock: {
    cat: "API Testing",
    learn: [
      "Stubbing HTTP responses (including specific error scenarios) for tests",
      "Request matching, verifying calls were made as expected",
    ],
    resources: [R("WireMock Docs", "https://wiremock.org/docs/")],
  },
  SoapUI: {
    cat: "API Testing",
    learn: ["Testing SOAP (WSDL-based) and REST APIs from one tool", "Assertions, data-driven test steps"],
    resources: [R("SoapUI Docs", "https://www.soapui.org/docs/")],
  },
  "API Testing": {
    cat: "API Testing",
    learn: [
      "Assert on status code + body shape/values, not just one or the other",
      "Negative tests: missing/invalid fields, no/expired auth, out-of-range values",
      "Schema validation (JSON Schema/Zod) to catch structural drift",
    ],
    resources: [
      R("Postman Learning Center", "https://learning.postman.com/docs/getting-started/overview/"),
      R("MDN — HTTP overview", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview"),
    ],
  },
  JMeter: {
    cat: "Tools",
    learn: [
      "Thread Groups (users, ramp-up), Samplers (requests), Listeners (results)",
      "CSV-driven test data to avoid single-account throttling",
      "Running headlessly (non-GUI mode) in CI",
    ],
    resources: [R("JMeter User Manual", "https://jmeter.apache.org/usermanual/index.html")],
  },
  k6: {
    cat: "Tools",
    learn: [
      "JavaScript-based load test scripts, CI-native by design",
      "Scenarios/executors (constant-arrival-rate, ramping-vus), thresholds as pass/fail gates",
    ],
    resources: [R("k6 Docs", "https://k6.io/docs/")],
  },
  TestRail: {
    cat: "Tools",
    learn: ["Organizing test cases into suites/runs, recording results per run", "Tracking coverage and pass rate over a release cycle"],
    resources: [R("TestRail Help Center", "https://support.testrail.com/hc/en-us")],
  },
  BrowserStack: {
    cat: "Tools",
    learn: [
      "Running Selenium/Playwright/Appium tests against real remote browsers/devices",
      "Cross-browser matrices without a physical device lab",
    ],
    resources: [R("BrowserStack Docs", "https://www.browserstack.com/docs")],
  },
  "Sauce Labs": {
    cat: "Tools",
    learn: ["Cloud grid for cross-browser/cross-device automated testing", "Parallel execution at scale in CI"],
    resources: [R("Sauce Labs Docs", "https://docs.saucelabs.com/")],
  },
  "axe-core": {
    cat: "Tools",
    learn: [
      "Automated WCAG violation detection (labels, contrast, ARIA) embeddable in tests",
      "Catches roughly a third of real accessibility issues — pair with manual testing",
    ],
    resources: [
      R("axe-core (GitHub)", "https://github.com/dequelabs/axe-core"),
      R("Playwright — Accessibility Testing", "https://playwright.dev/docs/accessibility-testing"),
    ],
  },
  Lighthouse: {
    cat: "Tools",
    learn: ["Automated audits: performance, accessibility, SEO, best practices", "CI integration for regression-gating audit scores"],
    resources: [R("Lighthouse Docs", "https://developer.chrome.com/docs/lighthouse/overview/")],
  },
  JIRA: {
    cat: "Tools",
    learn: [
      "Bug/issue workflow: Open → Triaged → In Progress → Resolved → In Testing → Closed/Reopened",
      "Zephyr/Xray plugins for test-case and traceability management inside JIRA",
    ],
    resources: [R("Atlassian — Jira Guides", "https://www.atlassian.com/software/jira/guides")],
  },
  Allure: {
    cat: "Tools",
    learn: [
      "Turning raw test-runner output into a browsable report (steps, screenshots, history trends)",
      "Tagging tests by feature/severity for categorized failure reporting",
    ],
    resources: [R("Allure Report Docs", "https://allurereport.org/docs/")],
  },
  "Charles Proxy": {
    cat: "Tools",
    learn: [
      "HTTP(S) debugging proxy: inspecting real wire-level requests (including mobile app traffic)",
      "Simulating network conditions, replaying/modifying requests",
    ],
    resources: [R("Charles Proxy Docs", "https://www.charlesproxy.com/documentation/")],
  },
  "Boundary Value Analysis": {
    cat: "Manual Testing",
    learn: [
      "Test the edge of a valid range plus the values immediately on each side of it",
      "Pairs with equivalence partitioning to keep test counts small but high-yield",
    ],
    resources: [
      R("ISTQB Glossary", "https://glossary.istqb.org/en/search/"),
      R("Test Automation University (free courses)", "https://testautomationu.applitools.com/"),
    ],
  },
  "Equivalence Partitioning": {
    cat: "Manual Testing",
    learn: ["Split inputs into classes the system should treat identically, test one representative per class"],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "Decision Table Testing": {
    cat: "Manual Testing",
    learn: [
      "Enumerate every combination of independent input conditions systematically",
      "Useful when behavior depends on multiple interacting rules",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "State Transition Testing": {
    cat: "Manual Testing",
    learn: [
      "Model states/events/transitions, test both valid and invalid transitions",
      "Confirms the system actually enforces its own state rules",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "Smoke Testing": {
    cat: "Manual Testing",
    learn: [
      "A broad, shallow build-acceptance check before deeper testing",
      "Distinct from sanity testing (narrow, deep, after a specific fix)",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "Regression Testing": {
    cat: "Manual Testing",
    learn: [
      "Re-running existing tests to confirm a change didn't break prior functionality",
      "Automate the repetitive core, keep a targeted subset on every PR",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "Exploratory Testing": {
    cat: "Manual Testing",
    learn: [
      "Simultaneous learning, test design, and execution guided by a mission, not a script",
      "Session-based test management: a time-boxed charter plus notes for reportability",
    ],
    resources: [
      R("Ministry of Testing", "https://www.ministryoftesting.com/"),
      R("ISTQB Glossary", "https://glossary.istqb.org/en/search/"),
    ],
  },
  "Accessibility Testing": {
    cat: "Manual Testing",
    learn: [
      "WCAG (usually level AA): contrast, ARIA roles/labels, focus order, keyboard-only navigation",
      "Automated tools (axe-core, Lighthouse) catch a fraction — manual screen-reader testing is still required",
    ],
    resources: [
      R("W3C — Web Accessibility Initiative", "https://www.w3.org/WAI/"),
      R("axe-core (GitHub)", "https://github.com/dequelabs/axe-core"),
    ],
  },
  "Test Data Management": {
    cat: "Manual Testing",
    learn: [
      "Synthetic/generated data for volume and edge cases, seed/reset scripts for a known starting state",
      "Isolating test data per test/shard to avoid parallel-run collisions",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
};

// Fallback for any tech OUTSIDE the ~35 curated entries above — vacancies name a much longer
// tail (specific libraries, architecture patterns, niche tools) than any hand-curated list can
// keep up with. Used to be one static, English-only, unparametrized link ("roadmap.sh" — its
// homepage, not even a search) regardless of the actual tech; every one of these three is
// parametrized by `tech` and verified to resolve without a lookup (search/listing pages, so
// there's no risk of linking a made-up specific article that 404s) — genuinely more useful for a
// pattern like "Event-driven Architecture" or a niche library like "LiveKit" than a single
// homepage link ever was. If the LLM IS available, getDynamicKnowledge (knowledge.service.ts)
// still tries to generate and validate real, specific resources first — this is only the offline/
// LLM-failed floor underneath that.
function genericEntry(tech: string, isUk: boolean): KbEntry {
  const q = encodeURIComponent(tech);
  return {
    cat: null,
    learn: [
      isUk
        ? `Основи «${tech}» — почни з офіційної документації та ресурсів нижче`
        : `${tech} fundamentals — start with the official docs and the resources below`,
    ],
    resources: [
      R(`"${tech}" — curated lists on GitHub`, `https://github.com/search?q=awesome+${q}&type=repositories`),
      R(`"${tech}" — tutorials on freeCodeCamp`, `https://www.freecodecamp.org/news/search/?query=${q}`),
      R(`"${tech}" — API/reference search on DevDocs`, `https://devdocs.io/#q=${q}`),
    ],
  };
}

export function catFor(tech: string): string | null {
  return KB[tech]?.cat ?? null;
}

// Memoized: KB is a static module-level constant, so the share count per category never changes
// at runtime — it must NOT be derived from the caller's roadmap universe, or a tech's "shared
// practice track" flag would change depending on which vacancies a given user happened to add.
let catShareCountCache: Record<string, number> | undefined;

/** How many KB technologies share this drill/card category — practice stats (drills/cards/SRS)
 * are only as specific as the category ("System Design" covers 8 technologies), so a tech's level
 * derived from a shared category needs to be flagged as such (see roadmap RoadmapNode.practiceShared). */
export function catShareCount(cat: string | null): number {
  if (!cat) return 0;
  if (!catShareCountCache) {
    const counts: Record<string, number> = {};
    for (const entry of Object.values(KB)) {
      if (!entry.cat) continue;
      counts[entry.cat] = (counts[entry.cat] || 0) + 1;
    }
    catShareCountCache = counts;
  }
  return catShareCountCache[cat] || 0;
}

export interface KnowledgeBase {
  learn: string[];
  resources: Resource[];
  drills: { q: string; lvl: string }[];
  cards: { q: string }[];
}

export function kbFor(tech: string, track: Track = DEFAULT_TRACK): KnowledgeBase {
  const locale = getLocale();
  const isUk = locale === "uk";
  const kb = isUk ? getKbUk() : KB;
  const base = kb[tech] || genericEntry(tech, isUk);
  const cat = base.cat;
  const drills = cat
    ? getDrills(locale, track)
        .filter((d) => d.cat === cat)
        .map((d) => ({ q: d.q, lvl: d.lvl }))
    : [];
  const cards = cat
    ? getCards(locale, track)
        .filter((c) => c.cat === cat)
        .map((c) => ({ q: c.q }))
    : [];
  return { learn: base.learn, resources: base.resources, drills, cards };
}
