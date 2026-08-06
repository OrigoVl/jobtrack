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

  // ---------- Product track additions ----------
  "Product Ops": {
    cat: "Core",
    learn: [
      "Owns tooling/process standardization and feedback synthesis across PM teams, freeing PMs for strategy work",
      "Common outputs: a single feedback taxonomy, roadmap tooling upkeep, recurring metrics/reporting",
    ],
    resources: [
      R("Product School — What Is Product Operations?", "https://productschool.com/blog/product-fundamentals/product-operations"),
      R("Mind the Product — Product Ops", "https://www.mindtheproduct.com/tag/product-ops/"),
    ],
  },
  "TAM/SAM/SOM": {
    cat: "Core",
    learn: [
      "TAM (total market) → SAM (realistically serviceable) → SOM (realistically obtainable, given competition/GTM capacity)",
      "Use it to sanity-check whether an initiative is worth building, not just whether it's technically excellent",
    ],
    resources: [R("Product School — TAM SAM SOM", "https://productschool.com/blog/product-fundamentals/tam-sam-som")],
  },
  "Business Model Canvas": {
    cat: "Core",
    learn: [
      "9 blocks: segments, value props, channels, relationships, revenue, resources, activities, partnerships, costs",
      "Checks that a product solves a real problem AND sits inside a viable business, not just a good idea",
    ],
    resources: [R("Strategyzer — Business Model Canvas", "https://www.strategyzer.com/canvas/business-model-canvas")],
  },
  "Value Proposition Canvas": {
    cat: "Core",
    learn: [
      "Maps customer jobs/pains/gains against the product's pain relievers/gain creators",
      "Used early in discovery to sanity-check fit before investing in build",
    ],
    resources: [R("Strategyzer — Value Proposition Canvas", "https://www.strategyzer.com/canvas/value-proposition-canvas")],
  },
  "Product-Market Fit": {
    cat: "Core",
    learn: [
      "Signals: strong organic growth, high retention, shortening sales cycles, inbound demand outpacing spend",
      "Not binary or permanent — can erode as the market or competitive landscape shifts",
    ],
    resources: [
      R("a16z — The Only Thing That Matters", "https://a16z.com/2007/06/25/the-only-thing-that-matters/"),
      R("First Round Review — 12 Things About Product-Market Fit", "https://review.firstround.com/12-things-about-product-market-fit"),
    ],
  },
  "Product-Led Growth": {
    cat: "Core",
    learn: [
      "The product itself drives acquisition/conversion/expansion — free trials, in-product upsell, virality",
      "Often blended with sales-led motion for larger/enterprise accounts ('product-led sales')",
    ],
    resources: [R("ProductLed — What Is Product-Led Growth?", "https://productled.com/blog/product-led-growth-definition")],
  },
  "Go-to-Market Strategy": {
    cat: "Core",
    learn: [
      "Covers positioning, target segment, channel, pricing, and launch/sales-enablement plan for a release",
      "A PM's roadmap work and a PMM's GTM plan should be built together, not handed off at the last minute",
    ],
    resources: [R("Product School — Go-To-Market Strategy", "https://productschool.com/blog/product-strategy/go-to-market-strategy")],
  },
  "Jobs-to-be-Done": {
    cat: "Discovery",
    learn: [
      "Frames research around the 'progress' a customer is trying to make, not the product or demographics",
      "Surfaces competitors you wouldn't otherwise consider — anything competing for the same underlying job",
    ],
    resources: [
      R("JTBD.info", "https://jtbd.info/"),
      R("HBR — Know Your Customers' 'Jobs to Be Done'", "https://hbr.org/2016/09/know-your-customers-jobs-to-be-done"),
    ],
  },
  "Customer Interviews": {
    cat: "Discovery",
    learn: [
      "Ask about specific past behavior/facts, not hypothetical opinions or predictions (see The Mom Test)",
      "Weekly touchpoints (continuous discovery) beat occasional large research 'sprints'",
    ],
    resources: [
      R("The Mom Test", "http://momtestbook.com/"),
      R("Y Combinator — How to Talk to Users", "https://www.ycombinator.com/library/6f-how-to-talk-to-users"),
    ],
  },
  "Competitive Analysis": {
    cat: "Discovery",
    learn: [
      "Positioning maps and win/loss interviews reveal more than a feature-checkbox matrix",
      "Use a JTBD lens — competitors for the same underlying job, not just literal feature-for-feature rivals",
    ],
    resources: [R("Product School — Competitive Analysis", "https://productschool.com/blog/product-strategy/competitive-analysis")],
  },
  "Product Vision & Strategy": {
    cat: "Discovery",
    learn: [
      "Vision: long-term aspirational picture. Strategy: concrete plan (segments/bets) over a shorter horizon",
      "A vision doc should be concrete enough to rule things out, abstract enough to survive many roadmap cycles",
    ],
    resources: [R("SVPG — Marty Cagan's articles", "https://www.svpg.com/articles/")],
  },
  "Design Thinking": {
    cat: "Discovery",
    learn: [
      "Empathize → Define → Ideate → Prototype → Test, with PMs typically leading the first/last stages",
      "Skipping a stage (e.g. Empathize straight to Prototype) risks solving a poorly-defined problem",
    ],
    resources: [
      R("IDEO — Design Thinking", "https://designthinking.ideo.com/"),
      R("Interaction Design Foundation — Design Thinking", "https://www.interaction-design.org/literature/topics/design-thinking"),
    ],
  },
  MVP: {
    cat: "Discovery",
    learn: [
      "The smallest thing that tests the riskiest assumption or delivers core value to a narrow segment",
      "'Cut scope until it fits the deadline' isn't an MVP if what remains no longer tests anything meaningful",
    ],
    resources: [R("Lean Startup — Principles", "http://theleanstartup.com/principles")],
  },
  "Opportunity Solution Tree": {
    cat: "Discovery",
    learn: [
      "Outcome → opportunities (needs/pains) → candidate solutions → experiments, all explicitly linked",
      "Prevents jumping from a metric straight to a favorite solution without mapping the space in between",
    ],
    resources: [R("Product Talk — Opportunity Solution Trees", "https://www.producttalk.org/opportunity-solution-tree/")],
  },
  "Voice of Customer": {
    cat: "Discovery",
    learn: [
      "Systematic capture/tagging/synthesis of feedback across channels into themes the team can act on",
      "Needs a consistent taxonomy plus a visible loop back to whoever raised the feedback",
    ],
    resources: [R("ProductPlan — Voice of the Customer", "https://www.productplan.com/glossary/voice-of-the-customer/")],
  },
  "RICE Prioritization": {
    cat: "Delivery",
    learn: [
      "Score = (Reach x Impact x Confidence) / Effort — best for comparing many disparate ideas",
      "Only as good as the honesty of the 4 estimates that feed it — Confidence should genuinely discount guesses",
    ],
    resources: [
      R(
        "Intercom — RICE: Simple Prioritization for Product Managers",
        "https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/",
      ),
      R("ProductPlan — RICE Scoring Model", "https://www.productplan.com/glossary/rice-scoring-model/"),
    ],
  },
  "MoSCoW Prioritization": {
    cat: "Delivery",
    learn: [
      "Must / Should / Could / Won't have — fast, shared language for scoping one release under time pressure",
      "Breaks down once 'Must Have' loses scarcity — cap the count or ask 'does the release fail without it?'",
    ],
    resources: [R("ProductPlan — MoSCoW Prioritization", "https://www.productplan.com/glossary/moscow-prioritization/")],
  },
  "Kano Model": {
    cat: "Delivery",
    learn: [
      "Basic/must-be, Performance, and Delighter features have different satisfaction curves",
      "Warns against over-investing in basics past 'good enough' while starving delighters, and vice versa",
    ],
    resources: [R("ProductPlan — Kano Model", "https://www.productplan.com/glossary/kano-model/")],
  },
  "Product Roadmapping": {
    cat: "Delivery",
    learn: [
      "Now/Next/Later or theme-based formats communicate confidence honestly vs a rigidly dated roadmap",
      "Tailor framing (not the underlying plan) to execs vs sales vs engineering audiences",
    ],
    resources: [R("Aha! — Guide to Product Roadmaps", "https://www.aha.io/roadmapping/guide")],
  },
  "User Story Mapping": {
    cat: "Delivery",
    learn: [
      "Arrange stories along the user's actual workflow (backbone) to spot MVP slices and gaps visually",
      "Vertical slicing (thin, end-to-end value) beats splitting by technical layer for incremental delivery",
    ],
    resources: [R("Jeff Patton & Associates — Story Mapping", "https://www.jpattonassociates.com/story-mapping/")],
  },
  "Backlog Refinement": {
    cat: "Delivery",
    learn: [
      "Recurring session to clarify requirements, split large stories, estimate, and re-order before planning",
      "A story should meet Definition of Ready here — not be discovered too-big-to-fit at sprint planning",
    ],
    resources: [R("Scrum.org — What is Backlog Refinement?", "https://www.scrum.org/resources/what-is-backlog-refinement")],
  },
  OKRs: {
    cat: "Analytics",
    learn: [
      "Objectives (qualitative, ambitious) + Key Results (measurable outcomes, not tasks), 2-4 per objective",
      "Tying attainment directly to performance reviews pushes teams to sandbag safe targets — decouple the two",
    ],
    resources: [
      R("Google re:Work — Set Goals with OKRs", "https://rework.withgoogle.com/guides/set-goals-with-okrs/steps/introduction/"),
      R("What Matters — OKRs", "https://www.whatmatters.com/"),
    ],
  },
  "North Star Metric": {
    cat: "Analytics",
    learn: [
      "One metric that best captures delivered value and correlates with long-term business success",
      "Should be a leading, team-influenceable indicator — not a lagging outcome like raw revenue",
    ],
    resources: [R("Amplitude — North Star Playbook", "https://amplitude.com/north-star")],
  },
  "Cohort Analysis": {
    cat: "Analytics",
    learn: [
      "Group users by shared start date, track retention/revenue per cohort separately over time",
      "Reveals trend direction an aggregate metric can mask (flat MAU hiding worsening per-cohort retention)",
    ],
    resources: [R("Amplitude Docs — Cohort Analysis", "https://amplitude.com/docs")],
  },
  "Funnel Analysis": {
    cat: "Analytics",
    learn: [
      "Measure conversion between each consecutive step toward a goal to find the steepest relative drop-off",
      "Pair the quantitative WHERE with qualitative research (interviews, session recordings) for WHY",
    ],
    resources: [R("Mixpanel Docs — Funnels", "https://docs.mixpanel.com/")],
  },
  "AARRR / Pirate Metrics": {
    cat: "Analytics",
    learn: [
      "Acquisition, Activation, Retention, Referral, Revenue — localizes which funnel stage a problem lives in",
      "Organizes growth experiments by funnel stage rather than testing changes randomly",
    ],
    resources: [R("ProductPlan — Pirate Metrics (AARRR)", "https://www.productplan.com/glossary/pirate-metrics/")],
  },
  "Churn Analysis": {
    cat: "Analytics",
    learn: [
      "Logo churn (customer count) vs revenue churn (dollars) can diverge sharply — track both",
      "Segment churned customers by plan/cohort/onboarding to find real patterns, not just a topline rate",
    ],
    resources: [R("Baremetrics Academy — Churn Rate", "https://baremetrics.com/academy/churn-rate")],
  },
  Confluence: {
    cat: "Tools",
    learn: [
      "Central, linkable home for PRDs, vision/strategy docs, and decision logs — not scattered Docs/Slack",
      "Value comes from a consistent template per doc type plus a searchable, browsable space structure",
    ],
    resources: [R("Atlassian — Confluence Guides", "https://www.atlassian.com/software/confluence/guides")],
  },
  Amplitude: {
    cat: "Tools",
    learn: [
      "User-level, event-based product analytics — cohorts, retention, funnels, behavioral segmentation",
      "Best for 'what did this group of users do inside the product over time', not traffic-source questions",
    ],
    resources: [R("Amplitude Docs", "https://amplitude.com/docs")],
  },
  Mixpanel: {
    cat: "Tools",
    learn: [
      "Event-based product analytics with substantial overlap with Amplitude (funnels, retention, cohorts)",
      "Analysis quality is bounded by the tracking plan feeding it, not by which tool is chosen",
    ],
    resources: [R("Mixpanel Docs", "https://docs.mixpanel.com/")],
  },
  Productboard: {
    cat: "Tools",
    learn: [
      "Aggregates/tags customer feedback against a structured backlog of insights and features",
      "Generates stakeholder-facing roadmap views decoupled from JIRA's execution-level detail",
    ],
    resources: [R("Productboard — Product Resources", "https://www.productboard.com/")],
  },
  Pendo: {
    cat: "Tools",
    learn: [
      "In-app adoption platform: feature usage analytics plus in-app guides/tooltips/NPS without an engineering release",
      "Lets a PM iterate on onboarding/adoption nudges independent of the engineering release cycle",
    ],
    resources: [R("Pendo — Resources", "https://www.pendo.io/resources/")],
  },
  "Aha!": {
    cat: "Tools",
    learn: [
      "Structured hierarchy: strategic goals → initiatives → features → linked JIRA/Azure DevOps tickets",
      "Generates audience-specific roadmap views (public vs internal) from one underlying dataset",
    ],
    resources: [R("Aha! — Guide to Product Roadmaps", "https://www.aha.io/roadmapping/guide")],
  },

  // ---------- SysAdmin track additions ----------
  ITIL: {
    cat: "Core",
    learn: [
      "Incident vs problem vs change vs service request management",
      "SLAs, priority (impact x urgency), tiered support (L1/L2/L3)",
      "Change Advisory Board (CAB), Requests for Change (RFC), standard vs emergency changes",
    ],
    resources: [
      R("ITIL Foundation overview — AXELOS", "https://www.axelos.com/certifications/itil-service-management"),
      R("ITIL 4 key concepts — Atlassian", "https://www.atlassian.com/itsm/itil"),
    ],
  },
  MFA: {
    cat: "Core",
    learn: [
      "Factor types: knowledge, possession, inherence; push vs number-matching vs FIDO2/hardware keys",
      "MFA fatigue attacks and why number-matching/hardware keys resist phishing better than plain push",
      "NIST SP 800-63B password guidance: length over forced rotation, paired with MFA",
    ],
    resources: [
      R("NIST SP 800-63B — Digital Identity Guidelines", "https://pages.nist.gov/800-63-3/sp800-63b.html"),
      R(
        "Microsoft — How it works: Azure AD Multi-Factor Authentication",
        "https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mfa-howitworks",
      ),
    ],
  },
  "Endpoint Protection": {
    cat: "Core",
    learn: [
      "Signature-based AV vs EDR: behavioral monitoring, telemetry, isolate/kill/rollback response",
      "Patch cadence (Patch Tuesday), staged rollout rings, emergency out-of-band patching",
      "Common enterprise EDR: Microsoft Defender for Endpoint, CrowdStrike Falcon, SentinelOne",
    ],
    resources: [
      R("Microsoft Defender for Endpoint docs", "https://learn.microsoft.com/en-us/defender-endpoint/"),
      R(
        "CrowdStrike — What is EDR?",
        "https://www.crowdstrike.com/en-us/cybersecurity-101/endpoint-security/endpoint-detection-and-response-edr/",
      ),
    ],
  },
  "Ticketing Systems": {
    cat: "Core",
    learn: [
      "Incident/request lifecycle, SLA tracking, categorization, escalation paths",
      "ServiceNow (enterprise ITSM) vs Zendesk (customer support) vs Freshservice/Jira Service Management (mid-market ITSM)",
      "Writing a reproducible ticket: symptom, steps taken, environment, evidence",
    ],
    resources: [
      R("ServiceNow — ITSM overview", "https://www.servicenow.com/products/itsm.html"),
      R("Atlassian — Jira Service Management docs", "https://support.atlassian.com/jira-service-management-cloud/"),
    ],
  },
  "IT Asset Management": {
    cat: "Core",
    learn: [
      "CMDB: tracking hardware, software licenses, and their relationships/dependencies",
      "Onboarding/offboarding checklists tied to asset assignment and license reclamation",
      "Automated network discovery vs manual spreadsheet tracking",
    ],
    resources: [R("ServiceNow — What is a CMDB?", "https://www.servicenow.com/products/configuration-management-database.html")],
  },
  DNS: {
    cat: "Networking",
    learn: [
      "Record types: A/AAAA/CNAME/MX/TXT/NS/PTR, and the resolution chain (recursive → root → TLD → authoritative)",
      "TTL and caching at every hop — why propagation isn't instant",
      "AD-integrated DNS zones and SRV records (_ldap._tcp, _kerberos._tcp)",
    ],
    resources: [
      R("Cloudflare — What is DNS?", "https://www.cloudflare.com/learning/dns/what-is-dns/"),
      R(
        "Microsoft Learn — DNS for Active Directory",
        "https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/plan/creating-a-forest-plan",
      ),
    ],
  },
  DHCP: {
    cat: "Networking",
    learn: [
      "DORA process (Discover/Offer/Request/Acknowledge), lease time and renewal",
      "APIPA (169.254.x.x) as a diagnostic signal for a fully unreachable DHCP server",
      "Reservations for printers/servers; DHCP snooping to block rogue DHCP servers",
    ],
    resources: [
      R("Microsoft Learn — DHCP overview", "https://learn.microsoft.com/en-us/windows-server/networking/technologies/dhcp/dhcp-top"),
    ],
  },
  VPN: {
    cat: "Networking",
    learn: [
      "Site-to-site vs remote access VPN; IPsec, OpenVPN, WireGuard, SSL/TLS VPN",
      "Zero-trust/SASE as an alternative to broad network-level VPN access",
      "Common failure modes: NAT-T passthrough issues, IKE Phase 1/2 mismatches, idle timeouts",
    ],
    resources: [
      R("Cloudflare — What is a VPN?", "https://www.cloudflare.com/learning/access-management/what-is-a-vpn/"),
      R("WireGuard — official site", "https://www.wireguard.com/"),
    ],
  },
  Subnetting: {
    cat: "Networking",
    learn: [
      "CIDR notation, subnet masks, network/broadcast address reservation",
      "Sizing a subnet from a host-count requirement (rounding up to the next power of 2 minus 2)",
      "VLANs as the layer-2 complement to IP subnetting for traffic isolation",
    ],
    resources: [R("Cloudflare — What is a subnet?", "https://www.cloudflare.com/learning/network-layer/what-is-a-subnet/")],
  },
  "TCP/IP": {
    cat: "Networking",
    learn: [
      "OSI model's 7 layers vs the 4-layer TCP/IP model",
      "TCP (connection-oriented, reliable) vs UDP (connectionless, low-overhead) and when to use each",
      "Well-known ports (22/25/53/80/443/3389/etc.) and reading a 'connection refused' error",
    ],
    resources: [
      R("Cloudflare — What is the OSI Model?", "https://www.cloudflare.com/learning/ddos/glossary/open-systems-interconnection-model-osi/"),
    ],
  },
  Firewalls: {
    cat: "Networking",
    learn: [
      "Stateful vs stateless filtering; default-deny posture with narrow explicit allows",
      "DMZ design: restricting a compromised public-facing server's path to internal assets",
      "Network segmentation to limit lateral movement after a breach",
    ],
    resources: [R("Cloudflare — What is a firewall?", "https://www.cloudflare.com/learning/security/what-is-a-firewall/")],
  },
  SNMP: {
    cat: "Networking",
    learn: [
      "MIB tree, OIDs, SNMP GET vs traps for agentless device monitoring",
      "SNMPv2c's plaintext community string weakness vs SNMPv3's authentication/encryption",
      "When to use SNMP (network appliances) vs an installed monitoring agent (servers you control)",
    ],
    resources: [R("Cisco — What is SNMP?", "https://www.cisco.com/c/en/us/products/switches/what-is-snmp.html")],
  },
  "Active Directory": {
    cat: "Systems",
    learn: [
      "Forest/tree/domain/OU hierarchy; LDAP and Kerberos underpinnings",
      "Group types/scopes (security vs distribution, domain local/global/universal) and the AGDLP pattern",
      "FSMO roles, trust relationships, and replication (repadmin, DNS dependency)",
      "Delegation of Control for least-privilege administration",
    ],
    resources: [
      R(
        "Microsoft Learn — Active Directory Domain Services overview",
        "https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview",
      ),
      R(
        "Microsoft Learn — AD DS design and planning",
        "https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/plan/active-directory-design-and-planning",
      ),
    ],
  },
  "Windows Server": {
    cat: "Systems",
    learn: [
      "Core roles: AD DS, DNS, DHCP, File and Storage Services, IIS, RDS, Hyper-V, Certificate Services",
      "GPO precedence (LSDOU), Enforced/Block Inheritance",
      "NTFS vs share permissions; patch management (WSUS/SCCM/Intune)",
    ],
    resources: [
      R("Microsoft Learn — Windows Server documentation", "https://learn.microsoft.com/en-us/windows-server/"),
      R(
        "Microsoft Learn — Server roles overview",
        "https://learn.microsoft.com/en-us/windows-server/get-started/getting-started-with-server-manager",
      ),
    ],
  },
  "Group Policy": {
    cat: "Systems",
    learn: [
      "GPO precedence: Local → Site → Domain → OU (LSDOU), Enforced vs Block Inheritance",
      "Common use cases: security settings, software deployment, drive mappings, screen lock enforcement",
      "gpupdate /force and gpresult for troubleshooting policy application",
    ],
    resources: [
      R(
        "Microsoft Learn — Group Policy overview",
        "https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-policy/group-policy-overview",
      ),
    ],
  },
  VMware: {
    cat: "Systems",
    learn: [
      "ESXi (bare-metal hypervisor) vs vCenter Server (centralized management plane)",
      "vMotion (live migration), DRS (load balancing), HA (automatic VM restart on host failure)",
      "Snapshots vs real backups — why a snapshot isn't a DR strategy",
    ],
    resources: [R("VMware — vSphere documentation", "https://docs.vmware.com/en/VMware-vSphere/index.html")],
  },
  "Hyper-V": {
    cat: "Systems",
    learn: [
      "Type 1 hypervisor shipped as a Windows Server role; Live Migration as the vMotion equivalent",
      "Management via Hyper-V Manager, PowerShell, Failover Cluster Manager/System Center VMM",
      "Checkpoints (differencing disks) and why long-lived chains degrade VM performance",
    ],
    resources: [
      R(
        "Microsoft Learn — Hyper-V technology overview",
        "https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/hyper-v-technology-overview",
      ),
    ],
  },
  RAID: {
    cat: "Systems",
    learn: [
      "RAID 0/1/5/6/10 tradeoffs: performance, redundancy, capacity efficiency, rebuild risk",
      "Why RAID 10 is preferred for write-heavy database workloads over RAID 5/6's parity write penalty",
      "RAID is not a backup — it protects against disk failure, not deletion/corruption/site loss",
    ],
    resources: [
      R("Synology — RAID types explained", "https://www.synology.com/en-us/knowledgebase/DSM/help/DSM/StorageManager/raid_choose_type"),
    ],
  },
  "NAS and SAN": {
    cat: "Systems",
    learn: [
      "NAS: file-level storage over the network (SMB/NFS) — simple, general file sharing",
      "SAN: block-level storage over Fibre Channel/iSCSI — higher performance for databases/virtualization",
      "Choosing based on whether the consuming workload needs raw block access or just a shared folder",
    ],
    resources: [R("NetApp — NAS vs SAN", "https://www.netapp.com/data-storage/nas/nas-vs-san/")],
  },
  "NTFS Permissions": {
    cat: "Systems",
    learn: [
      "NTFS permissions (granular, always apply) vs share permissions (network-only, coarser)",
      "Effective permission on network access is the more restrictive of the two",
      "Best practice: open share permission, do real access control entirely through NTFS",
    ],
    resources: [
      R(
        "Microsoft Learn — File and folder permissions",
        "https://learn.microsoft.com/en-us/windows-server/storage/file-server/ntfs-overview",
      ),
    ],
  },
  SSH: {
    cat: "Systems",
    learn: [
      "Key-based authentication (ssh-keygen, authorized_keys) vs password auth",
      "Disabling password auth (PasswordAuthentication no) as a standard hardening step",
      "PowerShell remoting (WinRM) as the Windows-native equivalent for remote administration",
    ],
    resources: [R("OpenSSH — key-based authentication", "https://www.ssh.com/academy/ssh/public-key-authentication")],
  },
  "Entra ID": {
    cat: "Systems",
    learn: [
      "Cloud identity for SaaS/M365 via SSO, distinct from on-prem AD managing the internal network",
      "Azure AD Connect sync (password hash sync vs pass-through auth), hybrid join",
      "Conditional Access and Intune policies layered on top of on-prem GPOs during migration",
    ],
    resources: [R("Microsoft Learn — What is Microsoft Entra ID?", "https://learn.microsoft.com/en-us/entra/fundamentals/whatis")],
  },
  DFS: {
    cat: "Systems",
    learn: [
      "DFS Namespaces: unified logical path across multiple servers' file shares",
      "DFS Replication: keeping data in sync across servers/sites for redundancy and branch-office speed",
      "Migrating shares transparently when users already map to the DFS path, not a direct UNC path",
    ],
    resources: [
      R(
        "Microsoft Learn — DFS Namespaces and DFS Replication overview",
        "https://learn.microsoft.com/en-us/windows-server/storage/dfs-namespaces/dfs-overview",
      ),
    ],
  },
  WSUS: {
    cat: "Systems",
    learn: [
      "Approving/distributing Microsoft updates internally instead of every machine pulling from the internet",
      "Limited scope/reporting compared to SCCM/Intune — Microsoft-only updates",
      "Fits smaller, fully on-prem environments without a full endpoint management suite",
    ],
    resources: [
      R(
        "Microsoft Learn — WSUS overview",
        "https://learn.microsoft.com/en-us/windows-server/administration/windows-server-update-services/get-started/windows-server-update-services-wsus",
      ),
    ],
  },
  PowerShell: {
    cat: "Scripting",
    learn: [
      "Verb-Noun cmdlet naming convention; object pipeline (vs Bash's plain-text pipes)",
      "Remoting (WinRM): Invoke-Command vs Enter-PSSession",
      "Error handling (try/catch/finally, $ErrorActionPreference), the ActiveDirectory module",
    ],
    resources: [
      R("Microsoft Learn — PowerShell documentation", "https://learn.microsoft.com/en-us/powershell/"),
      R("Microsoft Learn — Active Directory module cmdlets", "https://learn.microsoft.com/en-us/powershell/module/activedirectory/"),
    ],
  },
  Zabbix: {
    cat: "Monitoring",
    learn: [
      "Agent-based vs agentless (SNMP/WMI) monitoring tradeoffs",
      "Triggers, thresholds, and tuning to avoid alert fatigue",
      "Dashboards for at-a-glance fleet visibility beyond raw alerts",
    ],
    resources: [R("Zabbix — official documentation", "https://www.zabbix.com/documentation/current/en/manual")],
  },
  Nagios: {
    cat: "Monitoring",
    learn: [
      "Plugin model: independent check scripts returning a standardized exit code (0/1/2/3) plus a status line",
      "Writing a custom check without touching Nagios's core",
      "Alert routing by severity to avoid paging for informational-only conditions",
    ],
    resources: [R("Nagios — Plugin development guidelines", "https://nagios-plugins.org/doc/guidelines.html")],
  },
  "Windows Event Viewer": {
    cat: "Monitoring",
    learn: [
      "Log categories: Application, System, Security, Setup — and which to check for what",
      "Key Event IDs worth memorizing (4625 failed logon, 6008 unexpected shutdown)",
      "Centralized log aggregation (Windows Event Forwarding, syslog) vs per-server manual checks",
    ],
    resources: [
      R(
        "Microsoft Learn — Event Viewer overview",
        "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/eventvwr",
      ),
    ],
  },
  "Backup and Disaster Recovery": {
    cat: "Tools",
    learn: [
      "Full/incremental/differential backups; RTO and RPO as business-driven design inputs",
      "3-2-1 (and 3-2-1-1-0) backup rule — why an air-gapped copy defeats ransomware targeting backups",
      "Hot/warm/cold DR sites; testing a DR plan (tabletop and live failover tests) rather than trusting it untested",
    ],
    resources: [
      R("Veeam — 3-2-1 backup rule explained", "https://www.veeam.com/blog/321-backup-rule.html"),
      R(
        "AWS — Disaster recovery objectives (RTO/RPO)",
        "https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html",
      ),
    ],
  },
  SCCM: {
    cat: "Tools",
    learn: [
      "Full on-prem endpoint management suite: patching, software deployment, OS imaging, inventory",
      "Richer targeting/reporting than WSUS, but requires real infrastructure and expertise",
      "Deployment rings (pilot → broad → critical) to catch bad updates before fleet-wide rollout",
    ],
    resources: [R("Microsoft Learn — Configuration Manager documentation", "https://learn.microsoft.com/en-us/mem/configmgr/")],
  },
  Intune: {
    cat: "Tools",
    learn: [
      "Cloud-native MDM: patching, app deployment, Conditional Access enforcement without a corporate-network requirement",
      "Fits hybrid/remote workforces where devices never touch the internal LAN",
      "Works alongside Entra ID hybrid join during an on-prem-to-cloud migration",
    ],
    resources: [R("Microsoft Learn — Microsoft Intune documentation", "https://learn.microsoft.com/en-us/mem/intune/")],
  },

  // ---------- Design track additions ----------
  Figma: {
    cat: "Tools",
    learn: [
      "Real-time multiplayer editing, comments, and shareable prototype links replace manual file-passing",
      "Components/variants + Auto Layout for consistent, resizable UI pieces",
      "Dev Mode generates measurements/tokens/code snippets directly for handoff",
    ],
    resources: [R("Figma Help Center", "https://help.figma.com/"), R("Figma — Best Practices", "https://www.figma.com/best-practices/")],
  },
  Sketch: {
    cat: "Tools",
    learn: [
      "macOS-only vector UI design tool, built around a large plugin ecosystem",
      "Predates Figma's dominance — still used by teams invested in its plugins or local-file workflows",
    ],
    resources: [R("Sketch — Docs", "https://www.sketch.com/docs/")],
  },
  "Adobe XD": {
    cat: "Tools",
    learn: [
      "Adobe's UI/UX design and prototyping tool, integrated with Creative Cloud (Illustrator/Photoshop assets)",
      "Adobe has stopped actively developing new XD features — Figma is now the default for new teams",
    ],
    resources: [R("Adobe XD", "https://www.adobe.com/products/xd.html")],
  },
  FigJam: {
    cat: "Tools",
    learn: [
      "Digital whiteboard for brainstorming, affinity mapping, and journey mapping — not pixel-precise UI",
      "Tightly integrated with Figma, but a deliberately separate, looser collaboration space",
    ],
    resources: [R("FigJam", "https://www.figma.com/figjam/")],
  },
  Miro: {
    cat: "Tools",
    learn: [
      "General-purpose online whiteboard for workshops, retros, and research synthesis with distributed teams",
      "Overlaps with FigJam — teams typically standardize on one rather than running both",
    ],
    resources: [R("Miro — Guides", "https://miro.com/guides/")],
  },
  Zeplin: {
    cat: "Handoff",
    learn: [
      "Dedicated design-to-developer handoff tool: specs, style guides, and exportable assets from imported designs",
      "Figma's native Dev Mode now covers much of this for Figma-only teams — Zeplin remains relevant across multiple design tools",
    ],
    resources: [R("Zeplin", "https://zeplin.io/"), R("Zeplin — Blog", "https://blog.zeplin.io/")],
  },
  Maze: {
    cat: "Research",
    learn: [
      "Unmoderated testing of interactive Figma prototypes at scale — heatmaps, click paths, task success/time",
      "No live moderator, so it can't probe unexpected behavior the way a moderated session can",
    ],
    resources: [R("Maze — Guides", "https://maze.co/guides/")],
  },
  UserTesting: {
    cat: "Research",
    learn: [
      "Recruits from a large panel of real users; records video/audio of them thinking aloud on tasks",
      "Faster and broader reach than scheduling your own moderated sessions, at the cost of live follow-up questions",
    ],
    resources: [R("UserTesting — Resources", "https://www.usertesting.com/resources")],
  },
  "Design Systems": {
    cat: "UI",
    learn: [
      "Component library + design tokens + usage guidelines + governance, not just 'a Figma file with reusable pieces'",
      "The library is an artifact the system produces — consistency comes from the principles and process behind it",
    ],
    resources: [
      R("Nielsen Norman Group — Design Systems 101", "https://www.nngroup.com/articles/design-systems-101/"),
      R("Design Systems Repo", "https://designsystemsrepo.com/"),
    ],
  },
  Wireframing: {
    cat: "Prototyping",
    learn: [
      "Low-fidelity, largely grayscale structural blueprint — layout/hierarchy, deliberately stripped of visual styling",
      "Lets structure/flow decisions get evaluated without color/typography biasing the feedback",
    ],
    resources: [
      R("Nielsen Norman Group — Wireframing", "https://www.nngroup.com/articles/wireframing/"),
      R("Usability.gov — Wireframing", "https://www.usability.gov/how-to-and-tools/methods/wireframing.html"),
    ],
  },
  "Usability Testing": {
    cat: "Research",
    learn: [
      "Moderated (researcher present, can probe) vs unmoderated (faster, scales, no real-time clarification)",
      "~5 participants per segment catches most common issues — fix and retest beats one large round",
    ],
    resources: [
      R("Nielsen Norman Group — Usability Testing 101", "https://www.nngroup.com/articles/usability-testing-101/"),
      R("Usability.gov — Usability Testing", "https://www.usability.gov/how-to-and-tools/methods/usability-testing.html"),
    ],
  },
  "User Research": {
    cat: "Research",
    learn: [
      "Quant (how many/how much) finds where to look; qual (why) explains what's actually happening",
      "Match method to question type — surveys, interviews, usability tests, card sorting, diary studies",
    ],
    resources: [
      R("Nielsen Norman Group — UX Research Cheat Sheet", "https://www.nngroup.com/articles/ux-research-cheat-sheet/"),
      R("Usability.gov — User Research Basics", "https://www.usability.gov/what-and-why/user-research.html"),
    ],
  },
  "Information Architecture": {
    cat: "Core",
    learn: [
      "How content/navigation is structured and labeled based on users' actual mental models, not an org chart",
      "Card sorting (generative) then tree testing (evaluative) is the standard validation sequence",
    ],
    resources: [
      R("Nielsen Norman Group — Information Architecture 101", "https://www.nngroup.com/articles/information-architecture-101/"),
      R("Information Architecture Institute", "https://www.iainstitute.org/"),
    ],
  },
  "Accessibility (a11y)": {
    cat: "UI",
    learn: [
      "Never rely on color alone; verify contrast, focus order, and keyboard-only navigation",
      "ARIA roles/labels for any custom (non-native) interactive component",
    ],
    resources: [R("W3C — Web Accessibility Initiative", "https://www.w3.org/WAI/"), R("The A11Y Project", "https://www.a11yproject.com/")],
  },
  WCAG: {
    cat: "UI",
    learn: [
      "4.5:1 contrast for normal text at AA (3:1 for large text); AAA is stricter (7:1) and rarely a blanket target",
      "AA is the practical baseline most legal accessibility requirements reference",
    ],
    resources: [
      R("WCAG 2.2 — Quick Reference", "https://www.w3.org/WAI/WCAG22/quickref/"),
      R("WebAIM — Contrast Checker", "https://webaim.org/resources/contrastchecker/"),
    ],
  },
  Persona: {
    cat: "Research",
    learn: [
      "Useful personas are built from real research patterns, not demographic filler nobody consults",
      "Teams reference a good persona when making trade-offs, not just as a poster on the wall",
    ],
    resources: [
      R("Nielsen Norman Group — Personas", "https://www.nngroup.com/articles/persona/"),
      R("Usability.gov — Personas", "https://www.usability.gov/how-to-and-tools/methods/personas.html"),
    ],
  },
  "User Journey Mapping": {
    cat: "Research",
    learn: [
      "Stages, actions, thoughts/emotions, pain points, and opportunities across the full end-to-end experience",
      "Spots friction a single-feature view misses, e.g. a support interaction no UI redesign alone would fix",
    ],
    resources: [
      R("Nielsen Norman Group — Journey Mapping 101", "https://www.nngroup.com/articles/journey-mapping-101/"),
      R("Usability.gov — Journey Mapping", "https://www.usability.gov/how-to-and-tools/methods/journey-mapping.html"),
    ],
  },
  "Heuristic Evaluation": {
    cat: "Core",
    learn: [
      "3-5 evaluators independently review a UI against Nielsen's 10 usability heuristics, then aggregate findings",
      "Prioritize fixes by severity x frequency x impact, not as a single pass-through checklist",
    ],
    resources: [
      R("Nielsen Norman Group — 10 Usability Heuristics", "https://www.nngroup.com/articles/ten-usability-heuristics/"),
      R(
        "Nielsen Norman Group — How to Conduct a Heuristic Evaluation",
        "https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/",
      ),
    ],
  },
  Prototyping: {
    cat: "Prototyping",
    learn: [
      "Match fidelity to what you're trying to learn — low-fi for structure/flow, hi-fi for visuals/copy/micro-interactions",
      "Interactive prototypes reveal flow-level usability problems a static mockup can't",
    ],
    resources: [R("Nielsen Norman Group — UX Prototypes: Hi-Fi vs Lo-Fi", "https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/")],
  },
  "Interaction Design": {
    cat: "UI",
    learn: [
      "Interaction patterns, feedback, and behavior — not just the visual layer",
      "Grounded in predictive models (Fitts's Law, Hick's Law) and established conventions (Jakob's Law)",
    ],
    resources: [R("Interaction Design Foundation", "https://www.interaction-design.org/"), R("Laws of UX", "https://lawsofux.com/")],
  },
  Typography: {
    cat: "UI",
    learn: [
      "Limited, deliberate type scale (H1-H3/body/caption) applied consistently to the same semantic role",
      "Line-height ~1.4-1.6x font size for readable body text",
    ],
    resources: [
      R("Material Design — Typography", "https://m3.material.io/styles/typography/overview"),
      R("Practical Typography", "https://practicaltypography.com/"),
    ],
  },
  "Color Theory": {
    cat: "UI",
    learn: [
      "Complementary (opposite on the wheel) for contrast/accents; analogous (adjacent) for cohesive, low-contrast palettes",
      "Never rely on hue alone for meaning — pair with an icon/label/pattern for accessibility",
    ],
    resources: [
      R("Material Design — Color", "https://m3.material.io/styles/color/system/overview"),
      R("Adobe Color — Color Wheel", "https://color.adobe.com/create/color-wheel"),
    ],
  },
  "Material Design": {
    cat: "UI",
    learn: [
      "Google's design system: components, tokens, and guidelines spanning Android and the web",
      "Widely used as a reference baseline even outside Android-specific products",
    ],
    resources: [
      R("Material Design (M3)", "https://m3.material.io/"),
      R("Material Design — Foundations", "https://m3.material.io/foundations"),
    ],
  },
  "Human Interface Guidelines": {
    cat: "UI",
    learn: [
      "Apple's platform conventions (iOS/iPadOS/macOS) for navigation, touch targets, and native component behavior",
      "The source for 44x44pt minimum touch target guidance widely cited across mobile design",
    ],
    resources: [
      R("Apple — Human Interface Guidelines", "https://developer.apple.com/design/human-interface-guidelines"),
      R("Apple — Design Resources", "https://developer.apple.com/design/resources/"),
    ],
  },
  "Card Sorting": {
    cat: "Research",
    learn: [
      "Open (participants create own groups) vs closed (sort into predefined categories) — generative vs evaluative",
      "Used to design/validate information architecture based on users' actual mental models",
    ],
    resources: [
      R("Nielsen Norman Group — Card Sorting", "https://www.nngroup.com/articles/card-sorting-definition/"),
      R("Usability.gov — Card Sorting", "https://www.usability.gov/how-to-and-tools/methods/card-sorting.html"),
    ],
  },
  "Design Tokens": {
    cat: "UI",
    learn: [
      "Named, platform-agnostic variables (color.primary.500) as a single source of truth for design + code",
      "Enables rebranding/theming and systematic contrast fixes across a large product without a manual hunt-and-replace",
    ],
    resources: [R("W3C — Design Tokens Community Group", "https://www.w3.org/community/design-tokens/")],
  },
  "Atomic Design": {
    cat: "UI",
    learn: [
      "Atoms -> molecules -> organisms -> templates -> pages — a shared vocabulary for component complexity",
      "Clarifies where duplication actually lives (usually the atom level) when consolidating inconsistent components",
    ],
    resources: [R("Atomic Design by Brad Frost", "https://atomicdesign.bradfrost.com/")],
  },
  "Design Critique": {
    cat: "Core",
    learn: [
      "Framed around the goal/user problem, not personal taste — 'I like / I wish / What if' keeps feedback actionable",
      "Distinct from a design review (a gate for sign-off) — critique generates options while work is in progress",
    ],
    resources: [R("Nielsen Norman Group — Design Critiques", "https://www.nngroup.com/articles/design-critiques/")],
  },
  "Dark Patterns": {
    cat: "Core",
    learn: [
      "UI/UX patterns that manipulate users into decisions benefiting the business at their expense",
      "Confirmshaming, roach motel, and sneak-into-basket are common named patterns — increasingly drawing regulatory scrutiny",
    ],
    resources: [
      R("Deceptive Design (deceptive.design)", "https://www.deceptive.design/"),
      R("FTC — Bringing Dark Patterns to Light", "https://www.ftc.gov/reports/bringing-dark-patterns-light"),
    ],
  },
  "Empathy Map": {
    cat: "Research",
    learn: [
      "Quick synthesis of what a user says/thinks/does/feels in a specific context, built from raw research notes",
      "A working artifact for shared team understanding — personas are the more polished, reusable distillation",
    ],
    resources: [R("Nielsen Norman Group — Empathy Mapping", "https://www.nngroup.com/articles/empathy-mapping/")],
  },
  Microinteractions: {
    cat: "UI",
    learn: [
      "Four parts: trigger, rules, feedback, and loops/modes (Dan Saffer's framework)",
      "Designing all four deliberately — not just visual feedback — separates a good microinteraction from mere decoration",
    ],
    resources: [
      R("Interaction Design Foundation", "https://www.interaction-design.org/"),
      R("Material Design — Motion", "https://m3.material.io/styles/motion/overview"),
    ],
  },
  "Design Handoff": {
    cat: "Handoff",
    learn: [
      "Prototype (behavior/flow) + spec (exact values/states) — handoff usually needs both, not one or the other",
      "Design tokens beat static image exports: an update propagates to every implementation referencing the token",
    ],
    resources: [R("Figma — Dev Mode", "https://www.figma.com/dev-mode/"), R("Zeplin", "https://zeplin.io/")],
  },

  // ---------- Security track additions ----------
  "OWASP Top 10": {
    cat: "Core",
    learn: [
      "The current list's risk categories (Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable and Outdated Components, and more)",
      "It's a prioritization/awareness document based on real-world data, not a complete checklist",
    ],
    resources: [
      R("OWASP Top 10", "https://owasp.org/www-project-top-ten/"),
      R("OWASP Top 10 — GitHub source", "https://github.com/OWASP/Top10"),
    ],
  },
  "NIST Cybersecurity Framework": {
    cat: "Core",
    learn: [
      "Five functions: Identify, Protect, Detect, Respond, Recover",
      "A common-language maturity assessment, not a prescriptive checklist of specific controls",
    ],
    resources: [
      R("NIST Cybersecurity Framework", "https://www.nist.gov/cyberframework"),
      R("NIST CSF 2.0 Quick Start Guide", "https://www.nist.gov/cyberframework/getting-started"),
    ],
  },
  "MITRE ATT&CK": {
    cat: "Core",
    learn: [
      "Tactics, techniques, and procedures (TTPs) organized by attack lifecycle stage",
      "Mapping your own detection coverage against specific technique IDs, not just abstract categories",
    ],
    resources: [
      R("MITRE ATT&CK", "https://attack.mitre.org/"),
      R("MITRE ATT&CK — Enterprise Matrix", "https://attack.mitre.org/matrices/enterprise/"),
    ],
  },
  "Zero Trust Architecture": {
    cat: "Core",
    learn: [
      "Never trust by network location alone — authenticate/authorize every request based on identity, device posture, and context",
      "Micro-segmentation and continuous verification vs the older perimeter/VPN model",
    ],
    resources: [
      R("NIST SP 800-207 — Zero Trust Architecture", "https://csrc.nist.gov/pubs/sp/800/207/final"),
      R("CISA — Zero Trust Maturity Model", "https://www.cisa.gov/zero-trust-maturity-model"),
    ],
  },
  "Threat Modeling": {
    cat: "Core",
    learn: [
      "STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege)",
      "Data flow diagrams and trust boundaries as the starting artifact",
    ],
    resources: [
      R("OWASP Threat Modeling", "https://owasp.org/www-community/Threat_Modeling"),
      R("Microsoft — Threat Modeling", "https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool"),
    ],
  },
  "Password Hashing": {
    cat: "Core",
    learn: [
      "bcrypt/scrypt/Argon2 (slow, adaptive, salted) vs fast general-purpose hashes (MD5/SHA-256) for password storage",
      "Salting defeats rainbow tables; the work factor should be tuned for a real login-time budget",
    ],
    resources: [
      R("OWASP Password Storage Cheat Sheet", "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html"),
      R("Argon2 — RFC 9106", "https://www.rfc-editor.org/rfc/rfc9106.html"),
    ],
  },
  "Cryptography Fundamentals": {
    cat: "Core",
    learn: [
      "Symmetric (AES) vs asymmetric (RSA/ECC) — speed vs key-distribution trade-offs",
      "Hashing vs encryption; digital signatures for integrity and non-repudiation",
    ],
    resources: [
      R("Crypto101 (free book)", "https://www.crypto101.io/"),
      R("NIST — Cryptographic Standards and Guidelines", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines"),
    ],
  },
  "Penetration Testing": {
    cat: "Core",
    learn: [
      "Scoping and rules of engagement before any testing starts — explicit written authorization is mandatory",
      "Recon → scanning → exploitation → post-exploitation → reporting with remediation guidance",
    ],
    resources: [
      R("PortSwigger Web Security Academy", "https://portswigger.net/web-security"),
      R("OWASP Testing Guide", "https://owasp.org/www-project-web-security-testing-guide/"),
    ],
  },
  SIEM: {
    cat: "Core",
    learn: [
      "Aggregating logs across an org and correlating events to catch patterns a single log source wouldn't reveal",
      "Tuning correlation rules to cut noise without missing real signals",
    ],
    resources: [
      R("Splunk — What is SIEM?", "https://www.splunk.com/en_us/blog/learn/siem-security-information-event-management.html"),
      R("Elastic Security", "https://www.elastic.co/security"),
    ],
  },
  "SQL Injection": {
    cat: "AppSec",
    learn: [
      "String concatenation into a query vs parameterized queries/prepared statements",
      "Blind, error-based, and UNION-based injection — different techniques for the same root cause",
    ],
    resources: [
      R("OWASP SQL Injection", "https://owasp.org/www-community/attacks/SQL_Injection"),
      R("PortSwigger — SQL Injection", "https://portswigger.net/web-security/sql-injection"),
    ],
  },
  "Cross-Site Scripting (XSS)": {
    cat: "AppSec",
    learn: [
      "Reflected vs stored vs DOM-based XSS",
      "Output encoding by context as the primary defense; Content-Security-Policy as a second layer",
    ],
    resources: [
      R("OWASP Cross Site Scripting", "https://owasp.org/www-community/attacks/xss/"),
      R("PortSwigger — Cross-site scripting", "https://portswigger.net/web-security/cross-site-scripting"),
    ],
  },
  CSRF: {
    cat: "AppSec",
    learn: [
      "Anti-CSRF tokens, the SameSite cookie attribute, and Origin/Referer checks",
      "Why a GET request should never trigger a state change",
    ],
    resources: [
      R("OWASP CSRF", "https://owasp.org/www-community/attacks/csrf"),
      R("PortSwigger — CSRF", "https://portswigger.net/web-security/csrf"),
    ],
  },
  SSRF: {
    cat: "AppSec",
    learn: [
      "Server-side fetches abused to reach internal-only services (cloud metadata endpoints, internal admin panels)",
      "Defense: allowlist destinations, block private/link-local IP ranges, validate the resolved IP, not just the URL string",
    ],
    resources: [
      R(
        "OWASP SSRF Prevention Cheat Sheet",
        "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html",
      ),
      R("PortSwigger — SSRF", "https://portswigger.net/web-security/ssrf"),
    ],
  },
  IDOR: {
    cat: "AppSec",
    learn: [
      "Object-level authorization checked per request, not just authentication",
      "Why it's found simply by changing an ID — always re-verify ownership server-side",
    ],
    resources: [
      R("PortSwigger — Access control vulnerabilities", "https://portswigger.net/web-security/access-control"),
      R(
        "OWASP — Insecure Direct Object References",
        "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References",
      ),
    ],
  },
  XXE: {
    cat: "AppSec",
    learn: [
      "XML parsers resolving external entities by default — reading local files or triggering SSRF",
      "Fix: explicitly disable DTD processing and external entity resolution in the parser configuration",
    ],
    resources: [
      R(
        "OWASP XXE Prevention Cheat Sheet",
        "https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html",
      ),
      R("PortSwigger — XXE injection", "https://portswigger.net/web-security/xxe"),
    ],
  },
  "JWT Security": {
    cat: "AppSec",
    learn: [
      "decode vs verify — never trust claims from a token whose signature wasn't checked",
      "Hardcode the expected algorithm server-side; never accept alg: none or trust the token's own header",
    ],
    resources: [
      R("jwt.io — Introduction to JSON Web Tokens", "https://jwt.io/introduction"),
      R("OWASP JWT Cheat Sheet", "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html"),
    ],
  },
  "SAST/DAST": {
    cat: "AppSec",
    learn: [
      "SAST scans source without running it; DAST tests a running app from the outside like an attacker would",
      "Layering both plus dependency scanning covers meaningfully more than either alone",
    ],
    resources: [
      R("OWASP — Static Application Security Testing", "https://owasp.org/www-community/Source_Code_Analysis_Tools"),
      R("OWASP ZAP", "https://www.zaproxy.org/"),
    ],
  },
  "Secure Coding Practices": {
    cat: "AppSec",
    learn: [
      "Input validation, output encoding, parameterized queries, least-privilege service accounts",
      "Secrets management and dependency/supply-chain scanning as part of the standard dev workflow, not an afterthought",
    ],
    resources: [
      R("OWASP Cheat Sheet Series", "https://cheatsheetseries.owasp.org/"),
      R(
        "OWASP Secure Coding Practices Quick Reference Guide",
        "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/",
      ),
    ],
  },
  "TLS/SSL": {
    cat: "Network",
    learn: [
      "The handshake: cipher suite negotiation, certificate presentation, symmetric session key derivation",
      "Certificate chain of trust and validation (CN/SAN match, validity dates, revocation via CRL/OCSP)",
    ],
    resources: [
      R("Cloudflare — What happens in a TLS handshake?", "https://www.cloudflare.com/learning/ssl/what-happens-in-a-tls-handshake/"),
      R("Mozilla SSL Configuration Generator", "https://ssl-config.mozilla.org/"),
    ],
  },
  "DNS Security": {
    cat: "Network",
    learn: [
      "DNS cache poisoning/spoofing and how DNSSEC cryptographically signs records to defend against it",
      "DNS over HTTPS/TLS for protecting the query itself from eavesdropping",
    ],
    resources: [
      R("Cloudflare — DNSSEC", "https://www.cloudflare.com/dns/dnssec/how-dnssec-works/"),
      R(
        "ICANN — DNSSEC: What Is It and Why Is It Important?",
        "https://www.icann.org/resources/pages/dnssec-what-is-it-why-important-2019-03-05-en",
      ),
    ],
  },
  "DDoS Protection": {
    cat: "Network",
    learn: [
      "Volumetric attacks (bandwidth) vs application-layer attacks (expensive requests) need different mitigations",
      "CDN/scrubbing services vs rate limiting and request-cost-aware defenses at the application tier",
    ],
    resources: [
      R("Cloudflare — What is a DDoS attack?", "https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/"),
      R(
        "CISA — Understanding DDoS Attacks",
        "https://www.cisa.gov/news-events/news/understanding-and-responding-distributed-denial-service-attacks",
      ),
    ],
  },
  "IDS/IPS": {
    cat: "Network",
    learn: [
      "Detection (alert only) vs prevention (actively blocks) — and why new rules should prove out in detect-only mode first",
      "Signature-based vs anomaly-based detection",
    ],
    resources: [R("Suricata Documentation", "https://docs.suricata.io/"), R("Snort", "https://www.snort.org/")],
  },
  "Network Segmentation": {
    cat: "Network",
    learn: [
      "VLANs/subnets/firewall rules isolating zones so a compromise can't directly reach a high-value asset",
      "Limiting lateral movement — a key stage in most real breaches — even when perimeter defenses fail",
    ],
    resources: [
      R("NIST SP 800-125B — Secure Virtual Network Configuration", "https://csrc.nist.gov/pubs/sp/800/125/b/final"),
      R("Cisco — What Is Network Segmentation?", "https://www.cisco.com/c/en/us/products/security/what-is-network-segmentation.html"),
    ],
  },
  "Burp Suite": {
    cat: "Tools",
    learn: [
      "Intercepting proxy workflow: Proxy → Repeater for manual replay/tampering",
      "Automated crawling/scanning (Spider/Scanner) vs manual, targeted testing",
    ],
    resources: [
      R("PortSwigger — Getting started with Burp Suite", "https://portswigger.net/burp/documentation/desktop/getting-started"),
      R("PortSwigger Web Security Academy", "https://portswigger.net/web-security"),
    ],
  },
  Nmap: {
    cat: "Tools",
    learn: [
      "Host discovery, port scanning, service/version detection (-sV), and NSE scripts",
      "Running scans against your own infrastructure to catch unintentionally exposed services",
    ],
    resources: [R("Nmap Reference Guide", "https://nmap.org/book/man.html"), R("Nmap Official Site", "https://nmap.org/")],
  },
  Wireshark: {
    cat: "Tools",
    learn: [
      "Packet capture and protocol-level inspection with display filters",
      "Verifying traffic is actually encrypted as expected; forensic analysis of captured incident traffic",
    ],
    resources: [
      R("Wireshark User's Guide", "https://www.wireshark.org/docs/wsug_html_chunked/"),
      R("Wireshark Official Site", "https://www.wireshark.org/"),
    ],
  },
  Metasploit: {
    cat: "Tools",
    learn: [
      "Exploit/payload/post-exploitation modules — used only with explicit written authorization",
      "Verifying a known vulnerability is actually exploitable in a specific environment, not just theoretically present",
    ],
    resources: [R("Metasploit Documentation", "https://docs.metasploit.com/"), R("Rapid7 — Metasploit", "https://www.metasploit.com/")],
  },
  "OWASP ZAP": {
    cat: "Tools",
    learn: [
      "Free, open-source intercepting proxy with an automated scanner",
      "Baseline scan mode for CI-friendly DAST vs the full active scan",
    ],
    resources: [R("OWASP ZAP", "https://www.zaproxy.org/"), R("ZAP — Getting Started Guide", "https://www.zaproxy.org/getting-started/")],
  },
  "Vulnerability Scanning": {
    cat: "Tools",
    learn: [
      "Automated scanners (Nessus, Qualys, OpenVAS) checking targets against a database of known vulnerabilities/misconfigurations",
      "Triage by severity + exploitability + exposure, then dedupe by root cause rather than treating every finding independently",
    ],
    resources: [
      R("Tenable Nessus", "https://www.tenable.com/products/nessus"),
      R("OpenVAS / Greenbone Community Edition", "https://www.greenbone.net/en/testnow/"),
    ],
  },
  "Kali Linux": {
    cat: "Tools",
    learn: [
      "A pre-loaded Linux distribution for penetration testing — a standardized environment, not a tool by itself",
      "Only for use in explicitly authorized testing contexts",
    ],
    resources: [R("Kali Linux Documentation", "https://www.kali.org/docs/"), R("Kali Linux Official Site", "https://www.kali.org/")],
  },
  "Password Cracking": {
    cat: "Tools",
    learn: [
      "Dictionary attacks, brute force, and rule-based wordlist mutations (John the Ripper, Hashcat)",
      "Used defensively to audit whether an org's real password hashes would survive a real attacker's cracking attempt",
    ],
    resources: [R("Hashcat Documentation", "https://hashcat.net/wiki/"), R("John the Ripper", "https://www.openwall.com/john/")],
  },
  CyberChef: {
    cat: "Tools",
    learn: [
      "A chainable pipeline of encode/decode/encrypt/transform operations for a browser",
      "Deobfuscating malware payloads or CTF data without writing custom scripts",
    ],
    resources: [R("CyberChef (GCHQ)", "https://gchq.github.io/CyberChef/"), R("CyberChef — GitHub", "https://github.com/gchq/CyberChef")],
  },
  Shodan: {
    cat: "Tools",
    learn: [
      "A search engine indexing internet-connected devices/services by scanning the internet",
      "Finding your own unintentionally exposed devices before an attacker's search does",
    ],
    resources: [
      R("Shodan", "https://www.shodan.io/"),
      R("Shodan — Getting Started Guide", "https://help.shodan.io/the-basics/what-is-shodan"),
    ],
  },
  Splunk: {
    cat: "Tools",
    learn: [
      "Log ingestion, SPL query language for search/correlation, alerting rules and dashboards",
      "Writing a query to correlate a specific pattern (e.g. failed logins followed by a success) across ingested logs",
    ],
    resources: [
      R("Splunk Documentation", "https://docs.splunk.com/Documentation"),
      R("Splunk — What is SIEM?", "https://www.splunk.com/en_us/blog/learn/siem-security-information-event-management.html"),
    ],
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
