import { KB, type KbEntry } from "./knowledge-base.js";

// Ukrainian mirror of knowledge-base.ts: same keys/cat/resources, `learn` bullets translated.
// Wrapped in a function (rather than a top-level const) because knowledge-base.ts imports this
// module's export back — a genuine circular import. Reading `KB.X!.cat` at module-evaluation time
// would run before knowledge-base.ts finishes defining `KB` (whichever of the two loads first
// pauses partway through to load the other), leaving `KB` undefined. Calling this function lazily
// — after both modules have fully loaded — sidesteps that; see knowledge-base.ts's getKbUk().
export function buildKbUk(): Record<string, KbEntry> {
  return {
    JavaScript: {
      cat: KB.JavaScript!.cat,
      learn: [
        "Замикання (closures), область видимості, event loop (мікро- та макрозадачі)",
        "Прототипи, прив'язка `this`, ES-модулі",
        "Promises/async-await, обробка помилок",
        "Методи масивів/об'єктів, деструктуризація, spread",
      ],
      resources: KB.JavaScript!.resources,
    },
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

    // ---------- Data track additions ----------
    pandas: {
      cat: KB.pandas!.cat,
      learn: [
        "Основи DataFrame/Series, індексація, фільтрація",
        "groupby (split-apply-combine), merge/join",
        "Переформатування: pivot_table, melt",
        "Обробка пропущених даних, dtypes",
      ],
      resources: KB.pandas!.resources,
    },
    NumPy: {
      cat: KB.NumPy!.cat,
      learn: [
        "ndarray, векторизовані операції, broadcasting",
        "Індексація/зрізи, агрегатні функції",
        "Чому він швидший за звичайні списки Python",
      ],
      resources: KB.NumPy!.resources,
    },
    "scikit-learn": {
      cat: KB["scikit-learn"]!.cat,
      learn: [
        "Estimator API: fit/predict/transform",
        "train_test_split, cross_val_score, Pipeline",
        "Моделі регресії/класифікації/кластеризації",
        "Препроцесинг (StandardScaler, encoders)",
      ],
      resources: KB["scikit-learn"]!.resources,
    },
    dbt: {
      cat: KB.dbt!.cat,
      learn: ["Моделі як SELECT-запити, ref()/source()", "Тести, документація, граф lineage", "ELT: трансформація всередині сховища"],
      resources: KB.dbt!.resources,
    },
    Airflow: {
      cat: KB.Airflow!.cat,
      learn: ["DAG, завдання, оператори, залежності", "Планування, повтори, backfill", "Моніторинг/сповіщення про збої конвеєра"],
      resources: KB.Airflow!.resources,
    },
    "Power BI": {
      cat: KB["Power BI"]!.cat,
      learn: ["Моделювання даних, зв'язки, DAX-міри", "Звіти/дашборди, безпека на рівні рядків", "Power Query для трансформації"],
      resources: KB["Power BI"]!.resources,
    },
    Tableau: {
      cat: KB.Tableau!.cat,
      learn: ["Dimensions vs measures, обчислювані поля", "Дашборди, фільтри, дії (actions)", "Вибір правильного типу графіка"],
      resources: KB.Tableau!.resources,
    },
    Looker: {
      cat: KB.Looker!.cat,
      learn: [
        "Семантичний шар LookML, explores/views",
        "Керовані метрики, спільні для всіх дашбордів",
        "Self-service дослідження для стейкхолдерів",
      ],
      resources: KB.Looker!.resources,
    },
    BigQuery: {
      cat: KB.BigQuery!.cat,
      learn: [
        "Безсерверне SQL-сховище, partitioning/clustering",
        "Контроль вартості (query bytes scanned)",
        "Standard SQL, заплановані запити",
      ],
      resources: KB.BigQuery!.resources,
    },
    Snowflake: {
      cat: KB.Snowflake!.cat,
      learn: ["Віртуальні сховища (розділення compute/storage)", "Мікро-партиції, time travel", "Напівструктуровані дані (VARIANT/JSON)"],
      resources: KB.Snowflake!.resources,
    },
    Redshift: {
      cat: KB.Redshift!.cat,
      learn: [
        "Колонкове зберігання, ключі розподілу/сортування",
        "COPY для масового завантаження, WLM/query queues",
        "Redshift Spectrum для запитів до даних у S3",
      ],
      resources: KB.Redshift!.resources,
    },
    Databricks: {
      cat: KB.Databricks!.cat,
      learn: ["Архітектура lakehouse, Delta Lake", "Notebooks, кластери, Spark під капотом", "MLflow для трекінгу експериментів"],
      resources: KB.Databricks!.resources,
    },
    Excel: {
      cat: KB.Excel!.cat,
      learn: ["Pivot tables, VLOOKUP/INDEX-MATCH/XLOOKUP", "Формули, умовне форматування", "Базові VBA/макроси для повторюваних задач"],
      resources: KB.Excel!.resources,
    },
    Jupyter: {
      cat: KB.Jupyter!.cat,
      learn: [
        "Робочий процес notebook для дослідницького аналізу",
        "Магічні команди, модель виконання kernel/cell",
        "Чому notebooks не ідеальні для продакшн-коду",
      ],
      resources: KB.Jupyter!.resources,
    },
    "Google Sheets": {
      cat: KB["Google Sheets"]!.cat,
      learn: ["Pivot tables, QUERY/ARRAYFORMULA", "Перевірка даних, умовне форматування", "Apps Script для автоматизації"],
      resources: KB["Google Sheets"]!.resources,
    },
    "Google Analytics": {
      cat: KB["Google Analytics"]!.cat,
      learn: ["Події, конверсії, аудиторії (модель GA4)", "Звіти по funnel/утриманню", "Зв'язок з BigQuery для експорту сирих подій"],
      resources: KB["Google Analytics"]!.resources,
    },
    ETL: {
      cat: KB.ETL!.cat,
      learn: [
        "Extract/Transform/Load проти ELT",
        "Ідемпотентність, інкрементальні завантаження, backfill",
        "Перевірки якості даних у конвеєрі",
      ],
      resources: KB.ETL!.resources,
    },
    "A/B Testing": {
      cat: KB["A/B Testing"]!.cat,
      learn: [
        "Рандомізація, розмір вибірки/потужність, MDE",
        "Guardrail-метрики, уникнення підглядання (peeking)",
        "Статистична проти практичної значущості",
      ],
      resources: KB["A/B Testing"]!.resources,
    },
    "Machine Learning": {
      cat: KB["Machine Learning"]!.cat,
      learn: [
        "Навчання з учителем/без учителя/з підкріпленням",
        "Train/test split, перенавчання, метрики оцінки",
        "Feature engineering, вибір моделі",
      ],
      resources: KB["Machine Learning"]!.resources,
    },
    "Hypothesis Testing": {
      cat: KB["Hypothesis Testing"]!.cat,
      learn: [
        "Нульова/альтернативна гіпотеза, p-значення",
        "Помилки I/II роду, статистична потужність",
        "t-тест, хі-квадрат, одно- проти двобічних",
      ],
      resources: KB["Hypothesis Testing"]!.resources,
    },
    "Statistics Fundamentals": {
      cat: KB["Statistics Fundamentals"]!.cat,
      learn: [
        "Середнє/медіана/мода, дисперсія/стандартне відхилення",
        "Розподіли, центральна гранична теорема",
        "Кореляція проти причинності, зсув вибірки",
      ],
      resources: KB["Statistics Fundamentals"]!.resources,
    },
    "Data Governance": {
      cat: KB["Data Governance"]!.cat,
      learn: ["Якість даних, lineage, контроль доступу", "PII/відповідність (GDPR), політики зберігання", "Каталоги даних і власність"],
      resources: KB["Data Governance"]!.resources,
    },
    "Feature Engineering": {
      cat: KB["Feature Engineering"]!.cat,
      learn: ["Кодування категорій, масштабування, binning", "Ознаки дати/часу, агрегатні ознаки", "Створення ознак на основі домену"],
      resources: KB["Feature Engineering"]!.resources,
    },
    "Regression Analysis": {
      cat: KB["Regression Analysis"]!.cat,
      learn: ["Припущення лінійної/логістичної регресії", "Інтерпретація коефіцієнтів, odds ratios", "Регуляризація (L1/L2)"],
      resources: KB["Regression Analysis"]!.resources,
    },
    Classification: {
      cat: KB.Classification!.cat,
      learn: [
        "Дерева рішень, random forest, gradient boosting",
        "Confusion matrix, precision/recall/F1, ROC-AUC",
        "Обробка незбалансованих класів",
      ],
      resources: KB.Classification!.resources,
    },
    "Time Series Analysis": {
      cat: KB["Time Series Analysis"]!.cat,
      learn: ["Тренд, сезонність, стаціонарність", "Основи ARIMA, ковзні середні", "Розбиття train/test за часом, не випадково"],
      resources: KB["Time Series Analysis"]!.resources,
    },
    "Data Cleaning": {
      cat: KB["Data Cleaning"]!.cat,
      learn: [
        "Пропущені значення (видалення проти імпутації)",
        "Виявлення викидів (z-score, IQR)",
        "Дедублікація, консистентність типів/форматів даних",
      ],
      resources: KB["Data Cleaning"]!.resources,
    },
    "Data Visualization": {
      cat: KB["Data Visualization"]!.cat,
      learn: [
        "Відповідність типу графіка типу порівняння",
        "Уникнення оманливих графіків (обрізані осі, подвійні осі)",
        "Дизайн дашбордів, колір/доступність",
      ],
      resources: KB["Data Visualization"]!.resources,
    },
    "Data Warehousing": {
      cat: KB["Data Warehousing"]!.cat,
      learn: ["Star schema (fact/dimension таблиці)", "OLTP проти OLAP, ETL/ELT", "Повільно змінні вимірювання (SCD)"],
      resources: KB["Data Warehousing"]!.resources,
    },
    "Dimensional Modeling": {
      cat: KB["Dimensional Modeling"]!.cat,
      learn: ["Fact проти dimension таблиць, grain", "Star проти snowflake схеми", "Повільно змінні вимірювання (Type 1/2)"],
      resources: KB["Dimensional Modeling"]!.resources,
    },

    // ---------- DevOps track additions ----------
    Linux: {
      cat: KB.Linux!.cat,
      learn: [
        "Процеси, сигнали, systemd/systemctl, journalctl",
        "Права доступу до файлів (chmod/chown/umask), inodes, файлові системи",
        "Основи мережі: ip/ss, DNS, файрволи (iptables/nft)",
        "Інструменти shell: grep/sed/awk, pipes, редіректи",
      ],
      resources: KB.Linux!.resources,
    },
    "Bash Scripting": {
      cat: KB["Bash Scripting"]!.cat,
      learn: [
        "set -euo pipefail, квотування, розширення параметрів",
        "Функції, масиви, умови, цикли",
        "Типові пастки: word splitting, globbing, незадані змінні",
      ],
      resources: KB["Bash Scripting"]!.resources,
    },
    systemd: {
      cat: KB.systemd!.cat,
      learn: [
        "Unit-файли (.service/.timer), залежності (After=/Requires=)",
        "systemctl start/stop/enable/status, journalctl",
        "Timers як альтернатива cron",
      ],
      resources: KB.systemd!.resources,
    },
    Terraform: {
      cat: KB.Terraform!.cat,
      learn: [
        "Синтаксис HCL, провайдери, ресурси, data sources",
        "State: робочий процес plan/apply, remote state + блокування",
        "Модулі, variables/outputs, workspaces",
      ],
      resources: KB.Terraform!.resources,
    },
    Ansible: {
      cat: KB.Ansible!.cat,
      learn: [
        "Playbooks, tasks, ідемпотентні модулі",
        "Inventory (статичний/динамічний), roles, змінні",
        "Handlers, шаблони (Jinja2), vault для секретів",
      ],
      resources: KB.Ansible!.resources,
    },
    "GitHub Actions": {
      cat: KB["GitHub Actions"]!.cat,
      learn: [
        "Workflows, jobs, steps, runners (хостовані/self-hosted)",
        "Matrix-збірки, кешування, артефакти",
        "Секрети, environments, reusable workflows",
      ],
      resources: KB["GitHub Actions"]!.resources,
    },
    Jenkins: {
      cat: KB.Jenkins!.cat,
      learn: ["Декларативні проти скриптованих пайплайнів", "Agents, stages, post-дії", "Екосистема плагінів, розподілені збірки"],
      resources: KB.Jenkins!.resources,
    },
    GitOps: {
      cat: KB.GitOps!.cat,
      learn: [
        "Git як єдине джерело правди про бажаний стан",
        "Цикл узгодження, виявлення/виправлення дрейфу",
        "Pull-based проти push-based деплой",
      ],
      resources: KB.GitOps!.resources,
    },
    ArgoCD: {
      cat: KB.ArgoCD!.cat,
      learn: [
        "CRD Application, політики синхронізації (ручна/автоматична)",
        "Паттерн App of Apps, інтеграція з Helm/Kustomize",
        "RBAC, SSO, сповіщення",
      ],
      resources: KB.ArgoCD!.resources,
    },
    "Blue-Green Deployment": {
      cat: KB["Blue-Green Deployment"]!.cat,
      learn: [
        "Два ідентичних середовища, миттєве перемикання трафіку",
        "Rollback = перемикання назад; подвійна вартість інфраструктури під час переходу",
      ],
      resources: KB["Blue-Green Deployment"]!.resources,
    },
    "Canary Deployment": {
      cat: KB["Canary Deployment"]!.cat,
      learn: [
        "Поступове перемикання трафіку на нову версію зі спостереженням",
        "Обмеження радіуса ураження проти миттєвого перемикання blue-green",
      ],
      resources: KB["Canary Deployment"]!.resources,
    },
    "Feature Flags": {
      cat: KB["Feature Flags"]!.cat,
      learn: ["Розділення деплою коду й релізу фічі", "Kill switches, поступовий rollout, таргетинг/когорти"],
      resources: KB["Feature Flags"]!.resources,
    },
    Prometheus: {
      cat: KB.Prometheus!.cat,
      learn: [
        "Pull-based скрейпінг, експортери, service discovery",
        "PromQL: counters/gauges/histograms, rate()/histogram_quantile()",
        "Alertmanager: правила алертів, роутинг, silences",
      ],
      resources: KB.Prometheus!.resources,
    },
    Grafana: {
      cat: KB.Grafana!.cat,
      learn: [
        "Дашборди/панелі, data sources (Prometheus/Loki/SQL/...)",
        "Алертинг, змінні/шаблонізація",
        "Провізіонування дашбордів як коду",
      ],
      resources: KB.Grafana!.resources,
    },
    "Distributed Tracing": {
      cat: KB["Distributed Tracing"]!.cat,
      learn: [
        "Модель trace/span, поширення контексту",
        "Інструментація OpenTelemetry (авто проти ручної)",
        "Візуалізація трейсів (Jaeger/Tempo/Zipkin)",
      ],
      resources: KB["Distributed Tracing"]!.resources,
    },
    "Log Aggregation": {
      cat: KB["Log Aggregation"]!.cat,
      learn: [
        "Централізовані, індексовані, шукані логи по всьому флоту",
        "ELK/Elastic stack проти Grafana Loki (індексування лише лейблів)",
        "Структуроване логування, політики зберігання",
      ],
      resources: KB["Log Aggregation"]!.resources,
    },
    "SRE/SLO": {
      cat: KB["SRE/SLO"]!.cat,
      learn: [
        "SLI/SLO/SLA, error budgets",
        "Золоті сигнали (latency, traffic, errors, saturation)",
        "Multi-window, multi-burn-rate алертинг",
      ],
      resources: KB["SRE/SLO"]!.resources,
    },
    "Incident Response": {
      cat: KB["Incident Response"]!.cat,
      learn: [
        "On-call, політики ескалації, runbook'и",
        "Роль incident commander, дисципліна 'спочатку мітигувати'",
        "Безоцінкові постмортеми",
      ],
      resources: KB["Incident Response"]!.resources,
    },
    "Chaos Engineering": {
      cat: KB["Chaos Engineering"]!.cat,
      learn: ["Впровадження збоїв на основі гіпотези, обмеження радіуса ураження", "Базовий стабільний стан, умови скасування"],
      resources: KB["Chaos Engineering"]!.resources,
    },
    Helm: {
      cat: KB.Helm!.cat,
      learn: ["Charts, шаблони, values.yaml", "Releases, upgrade/rollback, репозиторії"],
      resources: KB.Helm!.resources,
    },
    "Container Registry": {
      cat: KB["Container Registry"]!.cat,
      learn: [
        "Теги образів проти незмінних дайджестів",
        "Шари, адресовані за контентом, ефективність push/pull",
        "Сканування вразливостей, підписання образів",
      ],
      resources: KB["Container Registry"]!.resources,
    },
    "VPC/Networking": {
      cat: KB["VPC/Networking"]!.cat,
      learn: [
        "Підмережі (публічні/приватні), таблиці маршрутизації",
        "Internet Gateway проти NAT Gateway",
        "Security groups проти network ACL, VPC peering/Transit Gateway",
      ],
      resources: KB["VPC/Networking"]!.resources,
    },
    IAM: {
      cat: KB.IAM!.cat,
      learn: [
        "Користувачі/ролі/policy, найменші привілеї",
        "Прийняття ролі (role assumption), тимчасові credentials",
        "Permissions boundaries",
      ],
      resources: KB.IAM!.resources,
    },
    "Load Balancing": {
      cat: KB["Load Balancing"]!.cat,
      learn: ["L4 проти L7 балансування навантаження", "Health checks, sticky sessions, термінація TLS", "Інтеграція з автомасштабуванням"],
      resources: KB["Load Balancing"]!.resources,
    },
    "Secrets Management": {
      cat: KB["Secrets Management"]!.cat,
      learn: [
        "Зашифроване зберігання, контроль доступу через IAM",
        "Автоматична ротація, аудит-трейли",
        "Введення в runtime проти запечених credentials",
      ],
      resources: KB["Secrets Management"]!.resources,
    },
    "Auto Scaling": {
      cat: KB["Auto Scaling"]!.cat,
      learn: [
        "Політики масштабування: target tracking, step, за розкладом",
        "Health checks і заміна інстансів",
        "Інтеграція з балансувальниками навантаження",
      ],
      resources: KB["Auto Scaling"]!.resources,
    },
    Vault: {
      cat: KB.Vault!.cat,
      learn: ["KV secrets engine, динамічні секрети", "Policies (контроль доступу за шляхами)", "Auth methods, audit devices"],
      resources: KB.Vault!.resources,
    },
    Nginx: {
      cat: KB.Nginx!.cat,
      learn: [
        "Reverse proxy, директиви upstream/балансування навантаження",
        "Термінація TLS, віддача статичних файлів",
        "Обмеження частоти запитів, переписування заголовків",
      ],
      resources: KB.Nginx!.resources,
    },
    Vagrant: {
      cat: KB.Vagrant!.cat,
      learn: ["Vagrantfile, boxes, провайдери (VirtualBox/VMware)", "Провізіонування (shell/Ansible), синхронізовані директорії"],
      resources: KB.Vagrant!.resources,
    },
    Packer: {
      cat: KB.Packer!.cat,
      learn: ["Шаблони, builders (amazon-ebs, docker, ...)", "Provisioners (shell/Ansible), запечені в образ"],
      resources: KB.Packer!.resources,
    },
    "Configuration Drift": {
      cat: KB["Configuration Drift"]!.cat,
      learn: ["Виявлення дрейфу: terraform plan, Ansible --check", "Запобігання: обмеження прямого доступу, узгодження через GitOps"],
      resources: KB["Configuration Drift"]!.resources,
    },
    // ---------- QA-напрям ----------
    Selenium: {
      cat: KB.Selenium!.cat,
      learn: [
        "Стратегії локаторів (id/CSS/XPath), явні проти неявних очікувань",
        "Page Object Model, Selenium Grid для паралельних/cross-browser прогонів",
        "Архітектура WebDriver, драйвери браузерів",
      ],
      resources: KB.Selenium!.resources,
    },
    Cypress: {
      cat: KB.Cypress!.cat,
      learn: [
        "Автоматичні повторні спроби (retry-ability), cy.intercept для заглушення мережі",
        "Кастомні команди, fixtures, cy.session для повторного використання автентифікації",
        "Модель same-origin і її практичні межі порівняно з Playwright",
      ],
      resources: KB.Cypress!.resources,
    },
    Appium: {
      cat: KB.Appium!.cat,
      learn: [
        "Мобільна автоматизація на основі протоколу WebDriver (iOS/Android)",
        "Пошук нативних елементів (accessibility id, селектори UiAutomator/XCUITest)",
        "Компроміси між реальним пристроєм і емулятором/симулятором",
      ],
      resources: KB.Appium!.resources,
    },
    "Page Object Model": {
      cat: KB["Page Object Model"]!.cat,
      learn: [
        "Інкапсулювати локатори/дії для сторінки чи компонента, перевірки лишати в тесті",
        "Компонувати спільні компоненти (хедер/навігацію) замість дублювання локаторів",
        "Уникати «God object» — моделювати навколо бізнес-дій, а не сирих селекторів",
      ],
      resources: KB["Page Object Model"]!.resources,
    },
    "Test Automation Framework": {
      cat: KB["Test Automation Framework"]!.cat,
      learn: [
        "Гібридні фреймворки: POM + data-driven + keyword-driven на одному шарі driver/утиліт",
        "Ізоляція тестів, незалежний setup/teardown для кожного тесту",
        "Вибір, що автоматизувати, а що лишити мануальним (ROI: повторюваність, стабільність, бізнес-цінність)",
      ],
      resources: KB["Test Automation Framework"]!.resources,
    },
    "Cucumber/BDD": {
      cat: KB["Cucumber/BDD"]!.cat,
      learn: [
        "Gherkin (Given/When/Then), Scenario Outline + Examples для data-driven сценаріїв",
        "Step definitions, що мапують Gherkin на код автоматизації",
        "Узгодження сценаріїв з нетехнічними стейкхолдерами до написання автоматизації",
      ],
      resources: KB["Cucumber/BDD"]!.resources,
    },
    "Visual Regression Testing": {
      cat: KB["Visual Regression Testing"]!.cat,
      learn: [
        "Порівняння скріншотів проти узгодженого базового варіанта для виявлення регресій макета/CSS",
        "Обробка навмисних візуальних змін: воркфлоу підтвердження базового варіанта",
        "Доповнює (не замінює) функціональні/DOM-перевірки",
      ],
      resources: KB["Visual Regression Testing"]!.resources,
    },
    "Robot Framework": {
      cat: KB["Robot Framework"]!.cat,
      learn: [
        "Keyword-driven синтаксис, читабельний для людей без програмування",
        "Бібліотеки (SeleniumLibrary, RequestsLibrary) для веб/API автоматизації",
      ],
      resources: KB["Robot Framework"]!.resources,
    },
    "Data-Driven Testing": {
      cat: KB["Data-Driven Testing"]!.cat,
      learn: [
        "Параметризувати один тест багатьма наборами вхідних даних замість дублювання тіл тестів",
        "Джерела даних: inline масиви, fixtures CSV/JSON, таблиці",
      ],
      resources: KB["Data-Driven Testing"]!.resources,
    },
    Postman: {
      cat: KB.Postman!.cat,
      learn: [
        "Колекції, середовища/змінні, pre-request і test скрипти",
        "Ланцюжкування запитів (витягти значення, зберегти, повторно використати через {{var}})",
        "Newman для запуску колекцій headlessly в CI",
      ],
      resources: KB.Postman!.resources,
    },
    Newman: {
      cat: KB.Newman!.cat,
      learn: ["Запуск колекції Postman з командного рядка", "Інтеграція прогонів колекції в CI pipeline"],
      resources: KB.Newman!.resources,
    },
    "Contract Testing": {
      cat: KB["Contract Testing"]!.cat,
      learn: [
        "Контракти на основі консюмера: консюмер визначає очікування, провайдер верифікує незалежно",
        "Виявляє зміни, що ламають інтеграцію, раніше й дешевше за повні e2e інтеграційні тести",
        "Pact — найпоширеніша реалізація",
      ],
      resources: KB["Contract Testing"]!.resources,
    },
    WireMock: {
      cat: KB.WireMock!.cat,
      learn: [
        "Заглушення HTTP-відповідей (включно з конкретними сценаріями помилок) для тестів",
        "Збіг запитів, перевірка, що виклики відбулись як очікувалось",
      ],
      resources: KB.WireMock!.resources,
    },
    SoapUI: {
      cat: KB.SoapUI!.cat,
      learn: ["Тестування SOAP (на основі WSDL) і REST API одним інструментом", "Перевірки, data-driven тестові кроки"],
      resources: KB.SoapUI!.resources,
    },
    "API Testing": {
      cat: KB["API Testing"]!.cat,
      learn: [
        "Перевіряти статус-код + форму/значення тіла, а не лише щось одне",
        "Негативні тести: відсутні/невалідні поля, немає/просрочена автентифікація, значення поза діапазоном",
        "Валідація схеми (JSON Schema/Zod) для виявлення структурного дрейфу",
      ],
      resources: KB["API Testing"]!.resources,
    },
    JMeter: {
      cat: KB.JMeter!.cat,
      learn: [
        "Thread Groups (користувачі, ramp-up), Samplers (запити), Listeners (результати)",
        "Тестові дані на основі CSV, щоб уникнути throttling одного акаунта",
        "Запуск headlessly (non-GUI режим) в CI",
      ],
      resources: KB.JMeter!.resources,
    },
    k6: {
      cat: KB.k6!.cat,
      learn: [
        "Скрипти навантажувальних тестів на JavaScript, CI-нативні за дизайном",
        "Сценарії/executors (constant-arrival-rate, ramping-vus), thresholds як гейти pass/fail",
      ],
      resources: KB.k6!.resources,
    },
    TestRail: {
      cat: KB.TestRail!.cat,
      learn: [
        "Організація тест-кейсів у suites/runs, запис результатів на кожен прогін",
        "Трекінг покриття й pass rate протягом циклу релізу",
      ],
      resources: KB.TestRail!.resources,
    },
    BrowserStack: {
      cat: KB.BrowserStack!.cat,
      learn: [
        "Запуск Selenium/Playwright/Appium тестів проти реальних віддалених браузерів/пристроїв",
        "Матриці cross-browser без фізичної лабораторії пристроїв",
      ],
      resources: KB.BrowserStack!.resources,
    },
    "Sauce Labs": {
      cat: KB["Sauce Labs"]!.cat,
      learn: ["Хмарний grid для cross-browser/cross-device автоматизованого тестування", "Паралельне виконання в масштабі в CI"],
      resources: KB["Sauce Labs"]!.resources,
    },
    "axe-core": {
      cat: KB["axe-core"]!.cat,
      learn: [
        "Автоматизоване виявлення порушень WCAG (лейбли, контраст, ARIA), вбудовується в тести",
        "Виявляє приблизно третину реальних проблем доступності — поєднуйте з ручним тестуванням",
      ],
      resources: KB["axe-core"]!.resources,
    },
    Lighthouse: {
      cat: KB.Lighthouse!.cat,
      learn: [
        "Автоматизовані аудити: продуктивність, доступність, SEO, best practices",
        "Інтеграція в CI для регресійного гейтування оцінок аудиту",
      ],
      resources: KB.Lighthouse!.resources,
    },
    JIRA: {
      cat: KB.JIRA!.cat,
      learn: [
        "Воркфлоу багів/issue: Open → Triaged → In Progress → Resolved → In Testing → Closed/Reopened",
        "Плагіни Zephyr/Xray для управління тест-кейсами й трасуванням всередині JIRA",
      ],
      resources: KB.JIRA!.resources,
    },
    Allure: {
      cat: KB.Allure!.cat,
      learn: [
        "Перетворення сирого виводу test runner'а на оглядовий звіт (кроки, скріншоти, тренди history)",
        "Тегування тестів за фічею/severity для категоризованої звітності про провали",
      ],
      resources: KB.Allure!.resources,
    },
    "Charles Proxy": {
      cat: KB["Charles Proxy"]!.cat,
      learn: [
        "HTTP(S) дебаг-проксі: перегляд реальних запитів на рівні провідних даних (включно з трафіком мобільних застосунків)",
        "Симуляція мережевих умов, повтор/зміна запитів",
      ],
      resources: KB["Charles Proxy"]!.resources,
    },
    "Boundary Value Analysis": {
      cat: KB["Boundary Value Analysis"]!.cat,
      learn: [
        "Тестувати межу валідного діапазону плюс значення безпосередньо з обох її сторін",
        "Поєднується з еквівалентним розбиттям, щоб кількість тестів лишалась малою, але результативною",
      ],
      resources: KB["Boundary Value Analysis"]!.resources,
    },
    "Equivalence Partitioning": {
      cat: KB["Equivalence Partitioning"]!.cat,
      learn: ["Розбити вхідні дані на класи, які система має обробляти однаково, тестувати один представник на клас"],
      resources: KB["Equivalence Partitioning"]!.resources,
    },
    "Decision Table Testing": {
      cat: KB["Decision Table Testing"]!.cat,
      learn: [
        "Систематично перерахувати кожну комбінацію незалежних вхідних умов",
        "Корисно, коли поведінка залежить від кількох взаємодіючих правил",
      ],
      resources: KB["Decision Table Testing"]!.resources,
    },
    "State Transition Testing": {
      cat: KB["State Transition Testing"]!.cat,
      learn: [
        "Моделювати стани/події/переходи, тестувати і валідні, і невалідні переходи",
        "Підтверджує, що система дійсно дотримується власних правил станів",
      ],
      resources: KB["State Transition Testing"]!.resources,
    },
    "Smoke Testing": {
      cat: KB["Smoke Testing"]!.cat,
      learn: [
        "Широка, поверхнева перевірка прийняття збірки перед глибшим тестуванням",
        "Відрізняється від sanity-тестування (вузького, глибокого, після конкретного фіксу)",
      ],
      resources: KB["Smoke Testing"]!.resources,
    },
    "Regression Testing": {
      cat: KB["Regression Testing"]!.cat,
      learn: [
        "Повторний прогін існуючих тестів для підтвердження, що зміна не зламала попередню функціональність",
        "Автоматизувати повторюване ядро, тримати цільову підмножину на кожен PR",
      ],
      resources: KB["Regression Testing"]!.resources,
    },
    "Exploratory Testing": {
      cat: KB["Exploratory Testing"]!.cat,
      learn: [
        "Одночасне навчання, дизайн тестів і виконання за місією, а не за скриптом",
        "Session-based test management: обмежена в часі хартія плюс нотатки для звітності",
      ],
      resources: KB["Exploratory Testing"]!.resources,
    },
    "Accessibility Testing": {
      cat: KB["Accessibility Testing"]!.cat,
      learn: [
        "WCAG (зазвичай рівень AA): контраст, ролі/лейбли ARIA, порядок фокусу, навігація лише клавіатурою",
        "Автоматизовані інструменти (axe-core, Lighthouse) виявляють частину — ручне тестування з екранним читачем все ще потрібне",
      ],
      resources: KB["Accessibility Testing"]!.resources,
    },
    "Test Data Management": {
      cat: KB["Test Data Management"]!.cat,
      learn: [
        "Синтетичні/генеровані дані для обсягу й крайніх випадків, скрипти seed/reset для відомого початкового стану",
        "Ізоляція тестових даних на тест/shard, щоб уникнути колізій при паралельному прогоні",
      ],
      resources: KB["Test Data Management"]!.resources,
    },
  };
}
