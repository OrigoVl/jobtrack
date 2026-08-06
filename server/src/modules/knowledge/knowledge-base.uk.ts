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

    // ---------- Product track additions ----------
    "Product Ops": {
      cat: KB["Product Ops"]!.cat,
      learn: [
        "Володіє стандартизацією тулінгу/процесів і синтезом фідбеку між PM-командами, звільняючи PM для стратегічної роботи",
        "Типові результати: єдина таксономія фідбеку, підтримка roadmap-тулінгу, регулярні метрики/звітність",
      ],
      resources: KB["Product Ops"]!.resources,
    },
    "TAM/SAM/SOM": {
      cat: KB["TAM/SAM/SOM"]!.cat,
      learn: [
        "TAM (весь ринок) → SAM (реалістично обслуговуваний) → SOM (реалістично досяжний, з огляду на конкуренцію/GTM-спроможність)",
        "Використовуйте це, щоб перевірити, чи інциатива взагалі варта розробки, а не лише чи вона технічно чудова",
      ],
      resources: KB["TAM/SAM/SOM"]!.resources,
    },
    "Business Model Canvas": {
      cat: KB["Business Model Canvas"]!.cat,
      learn: [
        "9 блоків: сегменти, ціннісні пропозиції, канали, стосунки, виручка, ресурси, активності, партнерства, витрати",
        "Перевіряє, що продукт вирішує реальну проблему І вписується в життєздатний бізнес, а не просто хороша ідея",
      ],
      resources: KB["Business Model Canvas"]!.resources,
    },
    "Value Proposition Canvas": {
      cat: KB["Value Proposition Canvas"]!.cat,
      learn: [
        "Мапить jobs/pains/gains клієнта проти pain relievers/gain creators продукту",
        "Використовується рано в дискавері, щоб перевірити відповідність перед інвестуванням у розробку",
      ],
      resources: KB["Value Proposition Canvas"]!.resources,
    },
    "Product-Market Fit": {
      cat: KB["Product-Market Fit"]!.cat,
      learn: [
        "Сигнали: сильне органічне зростання, висока ретеншн, скорочення циклів продажу, вхідний попит перевищує витрати",
        "Не бінарний чи постійний стан — може ерозувати зі зміною ринку чи конкурентного ландшафту",
      ],
      resources: KB["Product-Market Fit"]!.resources,
    },
    "Product-Led Growth": {
      cat: KB["Product-Led Growth"]!.cat,
      learn: [
        "Сам продукт рухає залучення/конверсію/розширення — безкоштовні тріали, in-product upsell, віральність",
        "Часто поєднується з sales-led мотивом для більших/ентерпрайз-акаунтів ('product-led sales')",
      ],
      resources: KB["Product-Led Growth"]!.resources,
    },
    "Go-to-Market Strategy": {
      cat: KB["Go-to-Market Strategy"]!.cat,
      learn: [
        "Покриває позиціонування, цільовий сегмент, канал, ціноутворення і план запуску/sales enablement для релізу",
        "Роботу PM з роадмапом і GTM-план PMM варто будувати спільно, а не передавати в останній момент",
      ],
      resources: KB["Go-to-Market Strategy"]!.resources,
    },
    "Jobs-to-be-Done": {
      cat: KB["Jobs-to-be-Done"]!.cat,
      learn: [
        "Формулює дослідження навколо 'progress', якого клієнт намагається досягти, а не продукту чи демографії",
        "Розкриває конкурентів, яких інакше не розглянули б — будь-хто, хто конкурує за ту саму підлеглу 'роботу'",
      ],
      resources: KB["Jobs-to-be-Done"]!.resources,
    },
    "Customer Interviews": {
      cat: KB["Customer Interviews"]!.cat,
      learn: [
        "Запитуйте про конкретну минулу поведінку/факти, не гіпотетичні думки чи прогнози (див. The Mom Test)",
        "Щотижневі дотики (безперервне дискавері) кращі за нерегулярні великі дослідницькі 'спринти'",
      ],
      resources: KB["Customer Interviews"]!.resources,
    },
    "Competitive Analysis": {
      cat: KB["Competitive Analysis"]!.cat,
      learn: [
        "Positioning maps і win/loss-інтерв'ю розкривають більше, ніж чек-лист-матриця фіч",
        "Використовуйте JTBD-лінзу — конкуренти за ту саму підлеглу роботу, а не лише буквальні феча-в-фічу суперники",
      ],
      resources: KB["Competitive Analysis"]!.resources,
    },
    "Product Vision & Strategy": {
      cat: KB["Product Vision & Strategy"]!.cat,
      learn: [
        "Vision: довгострокова амбітна картина. Strategy: конкретний план (сегменти/ставки) на коротшому горизонті",
        "Документ бачення має бути достатньо конкретним, щоб щось виключати, і достатньо абстрактним, щоб переживати багато циклів роадмапу",
      ],
      resources: KB["Product Vision & Strategy"]!.resources,
    },
    "Design Thinking": {
      cat: KB["Design Thinking"]!.cat,
      learn: [
        "Empathize → Define → Ideate → Prototype → Test, з PM, що типово веде перші/останні стадії",
        "Пропуск стадії (наприклад, Empathize прямо в Prototype) ризикує вирішити погано визначену проблему",
      ],
      resources: KB["Design Thinking"]!.resources,
    },
    MVP: {
      cat: KB.MVP!.cat,
      learn: [
        "Найменша річ, що тестує найризиковіше припущення чи доставляє основну цінність вузькому сегменту",
        "'Скоротити скоуп, поки не влізе в дедлайн' — не MVP, якщо те, що залишилось, більше нічого не тестує значуще",
      ],
      resources: KB.MVP!.resources,
    },
    "Opportunity Solution Tree": {
      cat: KB["Opportunity Solution Tree"]!.cat,
      learn: [
        "Outcome → можливості (потреби/болі) → кандидатські рішення → експерименти, все явно зв'язане",
        "Запобігає стрибку від метрики прямо до улюбленого рішення без мапування проміжного простору",
      ],
      resources: KB["Opportunity Solution Tree"]!.resources,
    },
    "Voice of Customer": {
      cat: KB["Voice of Customer"]!.cat,
      learn: [
        "Систематичне захоплення/тегування/синтез фідбеку з каналів у теми, за якими команда може діяти",
        "Потребує консистентної таксономії плюс видимий зворотний контур до того, хто підняв фідбек",
      ],
      resources: KB["Voice of Customer"]!.resources,
    },
    "RICE Prioritization": {
      cat: KB["RICE Prioritization"]!.cat,
      learn: [
        "Score = (Reach x Impact x Confidence) / Effort — найкраще для порівняння багатьох різнорідних ідей",
        "Настільки хороший, наскільки чесні 4 оцінки, що його живлять — Confidence має реально дисконтувати вгадування",
      ],
      resources: KB["RICE Prioritization"]!.resources,
    },
    "MoSCoW Prioritization": {
      cat: KB["MoSCoW Prioritization"]!.cat,
      learn: [
        "Must / Should / Could / Won't have — швидка, спільна мова для скоупінгу одного релізу під тиском часу",
        "Ламається, коли 'Must Have' втрачає дефіцитність — обмежте кількість чи запитайте 'реліз провалиться без цього?'",
      ],
      resources: KB["MoSCoW Prioritization"]!.resources,
    },
    "Kano Model": {
      cat: KB["Kano Model"]!.cat,
      learn: [
        "Basic/must-be, Performance і Delighter фічі мають різні криві задоволеності",
        "Попереджає проти надмірних інвестицій у базові фічі поза 'достатньо добре', голодуючи delighters, і навпаки",
      ],
      resources: KB["Kano Model"]!.resources,
    },
    "Product Roadmapping": {
      cat: KB["Product Roadmapping"]!.cat,
      learn: [
        "Формати Now/Next/Later чи тематичні чесно комунікують впевненість проти жорстко датованого роадмапу",
        "Налаштовуйте формулювання (не сам план) для аудиторій керівників проти продажів проти розробки",
      ],
      resources: KB["Product Roadmapping"]!.resources,
    },
    "User Story Mapping": {
      cat: KB["User Story Mapping"]!.cat,
      learn: [
        "Розташовуйте історії вздовж реального workflow користувача (backbone), щоб візуально виявити зрізи MVP і прогалини",
        "Вертикальне розбиття (тонка, end-to-end цінність) краще за розбиття за технічним шаром для інкрементальної доставки",
      ],
      resources: KB["User Story Mapping"]!.resources,
    },
    "Backlog Refinement": {
      cat: KB["Backlog Refinement"]!.cat,
      learn: [
        "Регулярна сесія для уточнення вимог, розбиття великих історій, оцінки й перевпорядкування перед плануванням",
        "Історія має відповідати Definition of Ready тут — а не виявлятись надто великою на плануванні спринту",
      ],
      resources: KB["Backlog Refinement"]!.resources,
    },
    OKRs: {
      cat: KB.OKRs!.cat,
      learn: [
        "Objectives (якісні, амбітні) + Key Results (вимірювані outcome, не завдання), 2-4 на ціль",
        "Прив'язка досягнення прямо до performance-ревʼю штовхає команди занижувати безпечні цілі — розв'яжіть це",
      ],
      resources: KB.OKRs!.resources,
    },
    "North Star Metric": {
      cat: KB["North Star Metric"]!.cat,
      learn: [
        "Одна метрика, що найкраще захоплює доставлену цінність і корелює з довгостроковим бізнес-успіхом",
        "Має бути leading, впливовим для команди індикатором — не lagging outcome, як сира виручка",
      ],
      resources: KB["North Star Metric"]!.resources,
    },
    "Cohort Analysis": {
      cat: KB["Cohort Analysis"]!.cat,
      learn: [
        "Групуйте користувачів за спільною датою старту, трекайте ретеншн/виручку по cohort окремо з часом",
        "Розкриває напрямок тренду, який агрегована метрика може маскувати (плоска MAU, що приховує гіршання ретеншну per-cohort)",
      ],
      resources: KB["Cohort Analysis"]!.resources,
    },
    "Funnel Analysis": {
      cat: KB["Funnel Analysis"]!.cat,
      learn: [
        "Вимірюйте конверсію між кожними послідовними кроками до цілі, щоб знайти найкрутіше відносне падіння",
        "Поєднуйте кількісне ДЕ з якісним дослідженням (інтерв'ю, записи сесій) для ЧОМУ",
      ],
      resources: KB["Funnel Analysis"]!.resources,
    },
    "AARRR / Pirate Metrics": {
      cat: KB["AARRR / Pirate Metrics"]!.cat,
      learn: [
        "Acquisition, Activation, Retention, Referral, Revenue — локалізує, в якій стадії фаннела живе проблема",
        "Організовує growth-експерименти за стадією фаннела, а не випадковим тестуванням змін",
      ],
      resources: KB["AARRR / Pirate Metrics"]!.resources,
    },
    "Churn Analysis": {
      cat: KB["Churn Analysis"]!.cat,
      learn: [
        "Logo churn (кількість клієнтів) проти revenue churn (долари) можуть сильно розходитись — трекайте обидва",
        "Сегментуйте відтеклих клієнтів за планом/cohort/онбордингом, щоб знайти реальні паттерни, не лише topline rate",
      ],
      resources: KB["Churn Analysis"]!.resources,
    },
    Confluence: {
      cat: KB.Confluence!.cat,
      learn: [
        "Центральний, з посиланнями дім для PRD, документів бачення/стратегії і логів рішень — не розкидані Docs/Slack",
        "Цінність з консистентного шаблону на тип документа плюс доступна для пошуку, зрозуміла структура простору",
      ],
      resources: KB.Confluence!.resources,
    },
    Amplitude: {
      cat: KB.Amplitude!.cat,
      learn: [
        "Продуктова аналітика на рівні користувача, керована подіями — cohorts, ретеншн, фаннели, поведінкова сегментація",
        "Найкраще для 'що ця група користувачів робила в продукті з часом', не для питань джерела трафіку",
      ],
      resources: KB.Amplitude!.resources,
    },
    Mixpanel: {
      cat: KB.Mixpanel!.cat,
      learn: [
        "Продуктова аналітика на основі подій зі суттєвим перекриттям з Amplitude (фаннели, ретеншн, cohorts)",
        "Якість аналізу обмежена планом трекінгу, що його живить, а не тим, який інструмент вибрано",
      ],
      resources: KB.Mixpanel!.resources,
    },
    Productboard: {
      cat: KB.Productboard!.cat,
      learn: [
        "Агрегує/тегує клієнтський фідбек проти структурованого бэклога insights і фіч",
        "Генерує роадмап-перегляди для стейкхолдерів, розв'язані від деталей виконання в JIRA",
      ],
      resources: KB.Productboard!.resources,
    },
    Pendo: {
      cat: KB.Pendo!.cat,
      learn: [
        "Платформа прийняття в застосунку: аналітика використання фіч плюс in-app гайди/тултіпи/NPS без релізу розробки",
        "Дозволяє PM ітерувати над підказками онбордингу/прийняття незалежно від циклу релізу розробки",
      ],
      resources: KB.Pendo!.resources,
    },
    "Aha!": {
      cat: KB["Aha!"]!.cat,
      learn: [
        "Структурована ієрархія: стратегічні цілі → інциативи → фічі → зв'язані тікети JIRA/Azure DevOps",
        "Генерує roadmap-перегляди для конкретних аудиторій (публічний проти внутрішнього) з тих самих підлеглих даних",
      ],
      resources: KB["Aha!"]!.resources,
    },

    // ---------- SysAdmin track additions ----------
    ITIL: {
      cat: KB.ITIL!.cat,
      learn: [
        "Управління incident vs problem vs change vs service request",
        "SLA, пріоритет (impact x urgency), багаторівнева підтримка (L1/L2/L3)",
        "Change Advisory Board (CAB), Requests for Change (RFC), стандартні vs термінові зміни",
      ],
      resources: KB.ITIL!.resources,
    },
    MFA: {
      cat: KB.MFA!.cat,
      learn: [
        "Типи факторів: знання, володіння, властивість; push vs number-matching vs FIDO2/апаратні ключі",
        "Атаки MFA fatigue і чому number-matching/апаратні ключі стійкіші до фішингу, ніж простий push",
        "Рекомендації NIST SP 800-63B щодо паролів: довжина замість примусової ротації, у парі з MFA",
      ],
      resources: KB.MFA!.resources,
    },
    "Endpoint Protection": {
      cat: KB["Endpoint Protection"]!.cat,
      learn: [
        "Сигнатурний AV vs EDR: поведінковий моніторинг, телеметрія, реакція isolate/kill/rollback",
        "Частота патчингу (Patch Tuesday), поетапні кільця розгортання, термінове позапланове патчування",
        "Поширений корпоративний EDR: Microsoft Defender for Endpoint, CrowdStrike Falcon, SentinelOne",
      ],
      resources: KB["Endpoint Protection"]!.resources,
    },
    "Ticketing Systems": {
      cat: KB["Ticketing Systems"]!.cat,
      learn: [
        "Життєвий цикл incident/request, відстеження SLA, категоризація, шляхи ескалації",
        "ServiceNow (корпоративний ITSM) vs Zendesk (підтримка клієнтів) vs Freshservice/Jira Service Management (ITSM середнього ринку)",
        "Написання відтворюваного тікета: симптом, виконані кроки, середовище, доказ",
      ],
      resources: KB["Ticketing Systems"]!.resources,
    },
    "IT Asset Management": {
      cat: KB["IT Asset Management"]!.cat,
      learn: [
        "CMDB: відстеження обладнання, ліцензій на софт, і їхніх взаємозв'язків/залежностей",
        "Чекліст онбордингу/офбордингу, пов'язаний з призначенням активів і поверненням ліцензій",
        "Автоматичне виявлення в мережі vs ручне відстеження в таблиці",
      ],
      resources: KB["IT Asset Management"]!.resources,
    },
    DNS: {
      cat: KB.DNS!.cat,
      learn: [
        "Типи записів: A/AAAA/CNAME/MX/TXT/NS/PTR, і ланцюжок резолюції (рекурсивний → root → TLD → авторитетний)",
        "TTL і кешування на кожному хопі — чому поширення не миттєве",
        "AD-інтегровані зони DNS і SRV-записи (_ldap._tcp, _kerberos._tcp)",
      ],
      resources: KB.DNS!.resources,
    },
    DHCP: {
      cat: KB.DHCP!.cat,
      learn: [
        "Процес DORA (Discover/Offer/Request/Acknowledge), час лізингу та продовження",
        "APIPA (169.254.x.x) як діагностичний сигнал повністю недосяжного DHCP-сервера",
        "Резервації для принтерів/серверів; DHCP snooping для блокування несанкціонованих DHCP-серверів",
      ],
      resources: KB.DHCP!.resources,
    },
    VPN: {
      cat: KB.VPN!.cat,
      learn: [
        "Site-to-site vs remote access VPN; IPsec, OpenVPN, WireGuard, SSL/TLS VPN",
        "Zero-trust/SASE як альтернатива широкому доступу на рівні мережі через VPN",
        "Поширені збої: проблеми NAT-T passthrough, розбіжність IKE Phase 1/2, таймаути простою",
      ],
      resources: KB.VPN!.resources,
    },
    Subnetting: {
      cat: KB.Subnetting!.cat,
      learn: [
        "Нотація CIDR, маски підмереж, резервування мережевої/broadcast-адреси",
        "Розмір підмережі з вимоги кількості хостів (округлення до наступної степені 2 мінус 2)",
        "VLAN як доповнення на рівні 2 до IP subnetting для ізоляції трафіку",
      ],
      resources: KB.Subnetting!.resources,
    },
    "TCP/IP": {
      cat: KB["TCP/IP"]!.cat,
      learn: [
        "7 рівнів моделі OSI vs 4-рівнева модель TCP/IP",
        "TCP (орієнтований на з'єднання, надійний) vs UDP (без з'єднання, малі накладні витрати), і коли використовувати кожен",
        "Відомі порти (22/25/53/80/443/3389 тощо) і читання помилки 'connection refused'",
      ],
      resources: KB["TCP/IP"]!.resources,
    },
    Firewalls: {
      cat: KB.Firewalls!.cat,
      learn: [
        "Stateful vs stateless фільтрація; позиція default-deny з вузькими явними дозволами",
        "Дизайн DMZ: обмеження шляху скомпрометованого публічного сервера до внутрішніх активів",
        "Сегментація мережі для обмеження горизонтального переміщення після зламу",
      ],
      resources: KB.Firewalls!.resources,
    },
    SNMP: {
      cat: KB.SNMP!.cat,
      learn: [
        "Дерево MIB, OID, SNMP GET vs traps для agentless моніторингу пристроїв",
        "Слабкість текстового community string SNMPv2c vs автентифікація/шифрування SNMPv3",
        "Коли використовувати SNMP (мережеве обладнання) vs встановлений агент моніторингу (сервери, якими керуєш)",
      ],
      resources: KB.SNMP!.resources,
    },
    "Active Directory": {
      cat: KB["Active Directory"]!.cat,
      learn: [
        "Ієрархія forest/tree/domain/OU; основа на LDAP і Kerberos",
        "Типи/scope груп (безпека vs розсилка, domain local/global/universal) і паттерн AGDLP",
        "FSMO-ролі, trust-відношення, і реплікація (repadmin, залежність від DNS)",
        "Delegation of Control для адміністрування за принципом найменших привілеїв",
      ],
      resources: KB["Active Directory"]!.resources,
    },
    "Windows Server": {
      cat: KB["Windows Server"]!.cat,
      learn: [
        "Основні ролі: AD DS, DNS, DHCP, File and Storage Services, IIS, RDS, Hyper-V, Certificate Services",
        "Пріоритет GPO (LSDOU), Enforced/Block Inheritance",
        "NTFS vs права шари; управління патчами (WSUS/SCCM/Intune)",
      ],
      resources: KB["Windows Server"]!.resources,
    },
    "Group Policy": {
      cat: KB["Group Policy"]!.cat,
      learn: [
        "Пріоритет GPO: Local → Site → Domain → OU (LSDOU), Enforced vs Block Inheritance",
        "Поширені сценарії: налаштування безпеки, розгортання софту, підключення дисків, блокування екрана",
        "gpupdate /force і gpresult для усунення несправностей застосування політики",
      ],
      resources: KB["Group Policy"]!.resources,
    },
    VMware: {
      cat: KB.VMware!.cat,
      learn: [
        "ESXi (bare-metal гіпервізор) vs vCenter Server (централізована площина управління)",
        "vMotion (живе перенесення), DRS (балансування навантаження), HA (автоматичний перезапуск VM при відмові хоста)",
        "Snapshots vs справжні бекапи — чому snapshot не є стратегією DR",
      ],
      resources: KB.VMware!.resources,
    },
    "Hyper-V": {
      cat: KB["Hyper-V"]!.cat,
      learn: [
        "Type 1 гіпервізор, що постачається як роль Windows Server; Live Migration як еквівалент vMotion",
        "Управління через Hyper-V Manager, PowerShell, Failover Cluster Manager/System Center VMM",
        "Checkpoint-и (диференціюючі диски) і чому довгі ланцюжки погіршують продуктивність VM",
      ],
      resources: KB["Hyper-V"]!.resources,
    },
    RAID: {
      cat: KB.RAID!.cat,
      learn: [
        "Компроміси RAID 0/1/5/6/10: продуктивність, резервність, ефективність обсягу, ризик ребілду",
        "Чому RAID 10 переважний для навантажень БД з інтенсивним записом над штрафом парності RAID 5/6",
        "RAID — не бекап — він захищає від відмови диска, не від видалення/пошкодження/втрати сайту",
      ],
      resources: KB.RAID!.resources,
    },
    "NAS and SAN": {
      cat: KB["NAS and SAN"]!.cat,
      learn: [
        "NAS: файлове сховище через мережу (SMB/NFS) — просте, загальне надання файлів",
        "SAN: блокове сховище через Fibre Channel/iSCSI — вища продуктивність для баз даних/віртуалізації",
        "Вибір залежно від того, чи потребує навантаження безпосередній блоковий доступ, чи просто спільну папку",
      ],
      resources: KB["NAS and SAN"]!.resources,
    },
    "NTFS Permissions": {
      cat: KB["NTFS Permissions"]!.cat,
      learn: [
        "NTFS-права (детальні, завжди діють) vs права шари (лише мережа, грубіші)",
        "Ефективне право при мережевому доступі — суворіше з двох",
        "Найкраща практика: відкрите право шари, реальний контроль доступу повністю через NTFS",
      ],
      resources: KB["NTFS Permissions"]!.resources,
    },
    SSH: {
      cat: KB.SSH!.cat,
      learn: [
        "Автентифікація за ключем (ssh-keygen, authorized_keys) vs паролем",
        "Вимкнення парольної автентифікації (PasswordAuthentication no) як стандартний крок посилення захисту",
        "PowerShell remoting (WinRM) як нативний для Windows еквівалент віддаленого адміністрування",
      ],
      resources: KB.SSH!.resources,
    },
    "Entra ID": {
      cat: KB["Entra ID"]!.cat,
      learn: [
        "Хмарна ідентичність для SaaS/M365 через SSO, окремо від on-prem AD, що керує внутрішньою мережею",
        "Синхронізація Azure AD Connect (password hash sync vs pass-through auth), hybrid join",
        "Політики Conditional Access та Intune поверх on-prem GPO під час миграції",
      ],
      resources: KB["Entra ID"]!.resources,
    },
    DFS: {
      cat: KB.DFS!.cat,
      learn: [
        "DFS Namespaces: уніфікований логічний шлях через файлові шари кількох серверів",
        "DFS Replication: синхронізація даних між серверами/сайтами для резервування і швидкості в філіалах",
        "Прозора миграція шар, коли користувачі вже мапляться на шлях DFS, а не прямий UNC-шлях",
      ],
      resources: KB.DFS!.resources,
    },
    WSUS: {
      cat: KB.WSUS!.cat,
      learn: [
        "Схвалення/розповсюдження оновлень Microsoft внутрішньо, замість того щоб кожна машина тягла з інтернету",
        "Обмежений обсяг/звітність порівняно з SCCM/Intune — лише оновлення Microsoft",
        "Підходить меншим, повністю on-prem середовищам без повного набору управління кінцевими точками",
      ],
      resources: KB.WSUS!.resources,
    },
    PowerShell: {
      cat: KB.PowerShell!.cat,
      learn: [
        "Конвенція іменування cmdlet Verb-Noun; object pipeline (проти простих текстових pipe у Bash)",
        "Remoting (WinRM): Invoke-Command vs Enter-PSSession",
        "Обробка помилок (try/catch/finally, $ErrorActionPreference), модуль ActiveDirectory",
      ],
      resources: KB.PowerShell!.resources,
    },
    Zabbix: {
      cat: KB.Zabbix!.cat,
      learn: [
        "Компроміси agent-based vs agentless (SNMP/WMI) моніторингу",
        "Тригери, пороги, і налаштування для уникнення alert fatigue",
        "Дашборди для видимості всього парку одразу, понад сирі алерти",
      ],
      resources: KB.Zabbix!.resources,
    },
    Nagios: {
      cat: KB.Nagios!.cat,
      learn: [
        "Модель плагінів: незалежні скрипти перевірки, що повертають стандартизований код виходу (0/1/2/3) плюс рядок статусу",
        "Написання кастомної перевірки без торкання ядра Nagios",
        "Маршрутизація алертів за серйозністю, щоб уникнути page для лише інформаційних умов",
      ],
      resources: KB.Nagios!.resources,
    },
    "Windows Event Viewer": {
      cat: KB["Windows Event Viewer"]!.cat,
      learn: [
        "Категорії логів: Application, System, Security, Setup — і що перевіряти для чого",
        "Ключові Event ID, варті запам'ятовування (4625 невдалий логін, 6008 неочікуване вимкнення)",
        "Централізована агрегація логів (Windows Event Forwarding, syslog) vs ручна перевірка кожного сервера",
      ],
      resources: KB["Windows Event Viewer"]!.resources,
    },
    "Backup and Disaster Recovery": {
      cat: KB["Backup and Disaster Recovery"]!.cat,
      learn: [
        "Повний/інкрементний/диференційний бекап; RTO і RPO як бізнес-обґрунтовані вхідні дані дизайну",
        "Правило бекапу 3-2-1 (і 3-2-1-1-0) — чому air-gapped копія нівелює ransomware, що атакує бекапи",
        "Hot/warm/cold DR-сайти; тестування плану DR (tabletop і живі тести failover), а не довіра непротестованому плану",
      ],
      resources: KB["Backup and Disaster Recovery"]!.resources,
    },
    SCCM: {
      cat: KB.SCCM!.cat,
      learn: [
        "Повний on-prem набір управління кінцевими точками: патчинг, розгортання софту, imaging OS, інвентаризація",
        "Багатша цілізація/звітність, ніж WSUS, але потребує реальної інфраструктури й експертизи",
        "Кільця розгортання (pilot → broad → critical) для виявлення поганих оновлень перед розгортанням на весь парк",
      ],
      resources: KB.SCCM!.resources,
    },
    Intune: {
      cat: KB.Intune!.cat,
      learn: [
        "Хмаро-нативний MDM: патчинг, розгортання застосунків, застосування Conditional Access без вимоги корпоративної мережі",
        "Підходить гібридним/віддаленим командам, де пристрої ніколи не торкаються внутрішньої LAN",
        "Працює разом з Entra ID hybrid join під час миграції з on-prem у хмару",
      ],
      resources: KB.Intune!.resources,
    },

    // ---------- Design track additions ----------
    Figma: {
      cat: KB.Figma!.cat,
      learn: [
        "Спільне редагування в реальному часі, коментарі й посилання на прототип замінюють ручну передачу файлів",
        "Компоненти/variants + Auto Layout для консистентних, змінних за розміром UI-частин",
        "Dev Mode генерує вимірювання/токени/фрагменти коду прямо для handoff",
      ],
      resources: KB.Figma!.resources,
    },
    Sketch: {
      cat: KB.Sketch!.cat,
      learn: [
        "Векторний UI-дизайн інструмент лише для macOS, побудований навколо великої екосистеми плагінів",
        "Передував домінуванню Figma — досі використовується командами, залученими в його плагіни чи локальні файлові процеси",
      ],
      resources: KB.Sketch!.resources,
    },
    "Adobe XD": {
      cat: KB["Adobe XD"]!.cat,
      learn: [
        "Інструмент UI/UX-дизайну й прототипування від Adobe, інтегрований з Creative Cloud (активи Illustrator/Photoshop)",
        "Adobe припинила активний розвиток нових функцій XD — Figma тепер за замовчуванням для нових команд",
      ],
      resources: KB["Adobe XD"]!.resources,
    },
    FigJam: {
      cat: KB.FigJam!.cat,
      learn: [
        "Цифрова дошка для брейнштормінгу, афінних карт і карт подорожі — не піксельно-точний UI",
        "Тісно інтегрована з Figma, але свідомо окремий, вільніший простір для співпраці",
      ],
      resources: KB.FigJam!.resources,
    },
    Miro: {
      cat: KB.Miro!.cat,
      learn: [
        "Універсальна онлайн-дошка для воркшопів, ретро і синтезу дослідження з розподіленими командами",
        "Перетинається з FigJam — команди зазвичай стандартизуються на одному, а не використовують обидва",
      ],
      resources: KB.Miro!.resources,
    },
    Zeplin: {
      cat: KB.Zeplin!.cat,
      learn: [
        "Спеціалізований інструмент передачі дизайну розробнику: специфікації, style guides й експортовані активи з імпортованих дизайнів",
        "Нативний Dev Mode Figma тепер покриває багато з цього для команд лише на Figma — Zeplin лишається релевантним для кількох дизайн-інструментів",
      ],
      resources: KB.Zeplin!.resources,
    },
    Maze: {
      cat: KB.Maze!.cat,
      learn: [
        "Немодероване тестування інтерактивних прототипів Figma в масштабі — heatmaps, шляхи кліків, успіх/час завдання",
        "Немає живого модератора, тож не може досліджувати неочікувану поведінку так, як модерована сесія",
      ],
      resources: KB.Maze!.resources,
    },
    UserTesting: {
      cat: KB.UserTesting!.cat,
      learn: [
        "Рекрутує з великої панелі реальних користувачів; записує відео/аудіо їх, що думають вголос, виконуючи завдання",
        "Швидший і ширший доступ, ніж планування власних модерованих сесій, за ціну відсутності уточнюючих питань у реальному часі",
      ],
      resources: KB.UserTesting!.resources,
    },
    "Design Systems": {
      cat: KB["Design Systems"]!.cat,
      learn: [
        "Бібліотека компонентів + design tokens + гайдлайни використання + керування, а не просто «файл Figma з повторними частинами»",
        "Бібліотека — артефакт, який продукує система — консистентність приходить з принципів і процесу за нею",
      ],
      resources: KB["Design Systems"]!.resources,
    },
    Wireframing: {
      cat: KB.Wireframing!.cat,
      learn: [
        "Низько-фідельний, здебільшого сірошкальний структурний план — макет/ієрархія, свідомо позбавлений візуальної стилізації",
        "Дозволяє оцінити рішення структури/флоу без зміщення фідбеку кольором/типографікою",
      ],
      resources: KB.Wireframing!.resources,
    },
    "Usability Testing": {
      cat: KB["Usability Testing"]!.cat,
      learn: [
        "Модероване (присутній дослідник, може досліджувати) проти немодерованого (швидше, масштабується, без уточнень у реальному часі)",
        "~5 учасників на сегмент виявляють більшість поширених проблем — фікс і перетест кращі за один великий раунд",
      ],
      resources: KB["Usability Testing"]!.resources,
    },
    "User Research": {
      cat: KB["User Research"]!.cat,
      learn: [
        "Кількісне (скільки/наскільки) знаходить, куди дивитись; якісне (чому) пояснює, що фактично відбувається",
        "Підбирайте метод під тип питання — опитування, інтерв'ю, юзабіліті-тести, карткове сортування, дослідження-дневники",
      ],
      resources: KB["User Research"]!.resources,
    },
    "Information Architecture": {
      cat: KB["Information Architecture"]!.cat,
      learn: [
        "Як контент/навігація структуровані й підписані на основі фактичних мисленнєвих моделей користувачів, а не org-схеми",
        "Карткове сортування (генеративне), потім tree testing (оцінювальне) — стандартна послідовність перевірки",
      ],
      resources: KB["Information Architecture"]!.resources,
    },
    "Accessibility (a11y)": {
      cat: KB["Accessibility (a11y)"]!.cat,
      learn: [
        "Ніколи не покладайтесь лише на колір; перевіряйте контраст, порядок фокусу і навігацію лише клавіатурою",
        "Ролі/лейбли ARIA для будь-якого кастомного (не нативного) інтерактивного компонента",
      ],
      resources: KB["Accessibility (a11y)"]!.resources,
    },
    WCAG: {
      cat: KB.WCAG!.cat,
      learn: [
        "4.5:1 контраст для звичайного тексту на AA (3:1 для великого тексту); AAA суворіший (7:1) і рідко загальна ціль",
        "AA — практичний базовий рівень, на який посилається більшість юридичних вимог доступності",
      ],
      resources: KB.WCAG!.resources,
    },
    Persona: {
      cat: KB.Persona!.cat,
      learn: [
        "Корисні персони побудовані з реальних паттернів дослідження, а не демографічного наповнення, до якого ніхто не звертається",
        "Команди звертаються до хорошої персони, приймаючи компроміси, а не лише як до плакату на стіні",
      ],
      resources: KB.Persona!.resources,
    },
    "User Journey Mapping": {
      cat: KB["User Journey Mapping"]!.cat,
      learn: [
        "Етапи, дії, думки/емоції, болі й можливості через весь наскрізний досвід",
        "Виявляє тертя, яке представлення однієї фічі пропускає, наприклад взаємодію з підтримкою, яку сам редизайн UI не виправить",
      ],
      resources: KB["User Journey Mapping"]!.resources,
    },
    "Heuristic Evaluation": {
      cat: KB["Heuristic Evaluation"]!.cat,
      learn: [
        "3-5 оцінювачів незалежно переглядають UI проти 10 евристик юзабіліті Нільсена, потім об'єднують знахідки",
        "Пріоритезуйте фікси за серйозністю x частотою x впливом, а не як єдиний прохід по чекліста",
      ],
      resources: KB["Heuristic Evaluation"]!.resources,
    },
    Prototyping: {
      cat: KB.Prototyping!.cat,
      learn: [
        "Підбирайте фідельність під те, що намагаєтесь дізнатись — low-fi для структури/флоу, hi-fi для візуалів/тексту/мікровзаємодій",
        "Інтерактивні прототипи виявляють проблеми юзабіліті на рівні флоу, яких статичний mockup не може",
      ],
      resources: KB.Prototyping!.resources,
    },
    "Interaction Design": {
      cat: KB["Interaction Design"]!.cat,
      learn: [
        "Паттерни взаємодії, фідбек і поведінка — не лише візуальний шар",
        "Обґрунтовано прогностичними моделями (закон Фіттса, закон Хіка) і встановленими конвенціями (закон Якоба)",
      ],
      resources: KB["Interaction Design"]!.resources,
    },
    Typography: {
      cat: KB.Typography!.cat,
      learn: [
        "Обмежена, свідома типографічна шкала (H1-H3/body/caption), застосована консистентно до тієї ж семантичної ролі",
        "Line-height приблизно 1.4-1.6x розміру шрифту для читабельного основного тексту",
      ],
      resources: KB.Typography!.resources,
    },
    "Color Theory": {
      cat: KB["Color Theory"]!.cat,
      learn: [
        "Комплементарні (протилежні на колі) для контрасту/акцентів; аналогічні (сусідні) для цілісних, низько-контрастних палітр",
        "Ніколи не покладайтесь лише на відтінок для значення — поєднуйте з іконкою/лейблом/паттерном для доступності",
      ],
      resources: KB["Color Theory"]!.resources,
    },
    "Material Design": {
      cat: KB["Material Design"]!.cat,
      learn: [
        "Дизайн-система Google: компоненти, токени й гайдлайни для Android і веб",
        "Широко використовується як референсна база навіть поза продуктами, специфічними для Android",
      ],
      resources: KB["Material Design"]!.resources,
    },
    "Human Interface Guidelines": {
      cat: KB["Human Interface Guidelines"]!.cat,
      learn: [
        "Платформні конвенції Apple (iOS/iPadOS/macOS) для навігації, тап-зон і поведінки нативних компонентів",
        "Джерело широко цитованої вимоги мінімального розміру тап-зони 44x44pt у мобільному дизайні",
      ],
      resources: KB["Human Interface Guidelines"]!.resources,
    },
    "Card Sorting": {
      cat: KB["Card Sorting"]!.cat,
      learn: [
        "Відкрите (учасники створюють власні групи) проти закритого (сортують у попередньо визначені категорії) — генеративне проти оцінювального",
        "Використовується для проєктування/перевірки інформаційної архітектури на основі фактичних мисленнєвих моделей користувачів",
      ],
      resources: KB["Card Sorting"]!.resources,
    },
    "Design Tokens": {
      cat: KB["Design Tokens"]!.cat,
      learn: [
        "Названі, платформо-незалежні змінні (color.primary.500) як єдине джерело правди для дизайну й коду",
        "Дозволяє ребрендинг/темізацію і системні фікси контрасту по всьому великому продукту без ручного пошуку й заміни",
      ],
      resources: KB["Design Tokens"]!.resources,
    },
    "Atomic Design": {
      cat: KB["Atomic Design"]!.cat,
      learn: [
        "Атоми -> молекули -> організми -> шаблони -> сторінки — спільний словник для складності компонентів",
        "Уточнює, де фактично живе дублікація (зазвичай рівень атома) при консолідації неконсистентних компонентів",
      ],
      resources: KB["Atomic Design"]!.resources,
    },
    "Design Critique": {
      cat: KB["Design Critique"]!.cat,
      learn: [
        "Формулюється навколо мети/проблеми користувача, а не особистого смаку — «I like / I wish / What if» тримає фідбек дієвим",
        "Відрізняється від design review (гейт для затвердження) — критика генерує опції, поки робота в процесі",
      ],
      resources: KB["Design Critique"]!.resources,
    },
    "Dark Patterns": {
      cat: KB["Dark Patterns"]!.cat,
      learn: [
        "UI/UX паттерни, що маніпулюють користувачами до рішень, вигідних бізнесу за їхній рахунок",
        "Confirmshaming, roach motel і sneak-into-basket — поширені названі паттерни, що дедалі більше привертають регуляторну увагу",
      ],
      resources: KB["Dark Patterns"]!.resources,
    },
    "Empathy Map": {
      cat: KB["Empathy Map"]!.cat,
      learn: [
        "Швидкий синтез того, що користувач каже/думає/робить/відчуває в конкретному контексті, побудований з сирих нотаток дослідження",
        "Робочий артефакт для спільного розуміння команди — персони — відшліфованіша, придатна для повторного використання дистиляція",
      ],
      resources: KB["Empathy Map"]!.resources,
    },
    Microinteractions: {
      cat: KB.Microinteractions!.cat,
      learn: [
        "Чотири частини: тригер, правила, фідбек і циклі/режими (фреймворк Дена Саффера)",
        "Свідоме проєктування всіх чотирьох, а не лише візуального фідбеку, відрізняє хорошу мікровзаємодію від просто декору",
      ],
      resources: KB.Microinteractions!.resources,
    },
    "Design Handoff": {
      cat: KB["Design Handoff"]!.cat,
      learn: [
        "Прототип (поведінка/флоу) + специфікація (точні значення/стани) — handoff зазвичай потребує обох, а не одного чи іншого",
        "Design tokens кращі за статичний експорт зображень: оновлення поширюється на кожну реалізацію, що на нього посилається",
      ],
      resources: KB["Design Handoff"]!.resources,
    },

    // ---------- Security track additions ----------
    "OWASP Top 10": {
      cat: KB["OWASP Top 10"]!.cat,
      learn: [
        "Категорії ризиків поточного списку (Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable and Outdated Components та інші)",
        "Це документ пріоритизації/обізнаності на основі реальних даних, не повний чек-лист",
      ],
      resources: KB["OWASP Top 10"]!.resources,
    },
    "NIST Cybersecurity Framework": {
      cat: KB["NIST Cybersecurity Framework"]!.cat,
      learn: [
        "П'ять функцій: Identify, Protect, Detect, Respond, Recover",
        "Оцінка зрілості спільною мовою, не приписуючий чек-лист конкретних контролів",
      ],
      resources: KB["NIST Cybersecurity Framework"]!.resources,
    },
    "MITRE ATT&CK": {
      cat: KB["MITRE ATT&CK"]!.cat,
      learn: [
        "Тактики, техніки й процедури (TTPs), організовані за стадією життєвого циклу атаки",
        "Мапінг власного покриття детекції на конкретні ID техніки, не лише абстрактні категорії",
      ],
      resources: KB["MITRE ATT&CK"]!.resources,
    },
    "Zero Trust Architecture": {
      cat: KB["Zero Trust Architecture"]!.cat,
      learn: [
        "Ніколи не довіряти лише за мережевим розташуванням — автентифікувати/авторизувати кожен запит на основі ідентичності, стану пристрою й контексту",
        "Мікросегментація й безперервна перевірка проти старішої моделі периметра/VPN",
      ],
      resources: KB["Zero Trust Architecture"]!.resources,
    },
    "Threat Modeling": {
      cat: KB["Threat Modeling"]!.cat,
      learn: [
        "STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege)",
        "Діаграми потоку даних і межі довіри як початковий артефакт",
      ],
      resources: KB["Threat Modeling"]!.resources,
    },
    "Password Hashing": {
      cat: KB["Password Hashing"]!.cat,
      learn: [
        "bcrypt/scrypt/Argon2 (повільні, адаптивні, солоні) проти швидких хешів загального призначення (MD5/SHA-256) для зберігання паролів",
        "Сіль нейтралізує rainbow-таблиці; work factor слід налаштувати під реальний бюджет часу логіну",
      ],
      resources: KB["Password Hashing"]!.resources,
    },
    "Cryptography Fundamentals": {
      cat: KB["Cryptography Fundamentals"]!.cat,
      learn: [
        "Симетрична (AES) проти асиметричної (RSA/ECC) — компроміс швидкість проти розповсюдження ключів",
        "Хешування проти шифрування; цифрові підписи для цілісності й неспростовності",
      ],
      resources: KB["Cryptography Fundamentals"]!.resources,
    },
    "Penetration Testing": {
      cat: KB["Penetration Testing"]!.cat,
      learn: [
        "Скоупінг і правила взаємодії перед початком тестування — явна письмова авторизація обов'язкова",
        "Recon → сканування → експлуатація → post-exploitation → звітність з рекомендаціями щодо remediation",
      ],
      resources: KB["Penetration Testing"]!.resources,
    },
    SIEM: {
      cat: KB.SIEM!.cat,
      learn: [
        "Агрегація логів по всій організації і кореляція подій для виявлення паттернів, які одне джерело логів не показало б",
        "Налаштування правил кореляції, щоб скоротити шум без втрати реальних сигналів",
      ],
      resources: KB.SIEM!.resources,
    },
    "SQL Injection": {
      cat: KB["SQL Injection"]!.cat,
      learn: [
        "Конкатенація рядків у запит проти параметризованих запитів/prepared statements",
        "Blind, error-based і UNION-based injection — різні техніки для тієї самої кореневої причини",
      ],
      resources: KB["SQL Injection"]!.resources,
    },
    "Cross-Site Scripting (XSS)": {
      cat: KB["Cross-Site Scripting (XSS)"]!.cat,
      learn: [
        "Reflected проти stored проти DOM-based XSS",
        "Кодування виводу залежно від контексту як основний захист; Content-Security-Policy як другий рівень",
      ],
      resources: KB["Cross-Site Scripting (XSS)"]!.resources,
    },
    CSRF: {
      cat: KB.CSRF!.cat,
      learn: [
        "Анти-CSRF токени, атрибут cookie SameSite і перевірки Origin/Referer",
        "Чому GET-запит ніколи не повинен тригерити зміну стану",
      ],
      resources: KB.CSRF!.resources,
    },
    SSRF: {
      cat: KB.SSRF!.cat,
      learn: [
        "Серверні запити, зловживані для досягнення внутрішніх сервісів (ендпоінти метаданих хмари, внутрішні адмін-панелі)",
        "Захист: allowlist призначень, блокування приватних/link-local діапазонів IP, валідація резолвленого IP, не лише рядка URL",
      ],
      resources: KB.SSRF!.resources,
    },
    IDOR: {
      cat: KB.IDOR!.cat,
      learn: [
        "Авторизація на рівні об'єкта перевіряється на кожен запит, не лише автентифікація",
        "Чому це знаходиться просто зміною ID — завжди повторно перевіряти власність на стороні сервера",
      ],
      resources: KB.IDOR!.resources,
    },
    XXE: {
      cat: KB.XXE!.cat,
      learn: [
        "Парсери XML, що резолвлять зовнішні entity за дефолтом — читання локальних файлів чи тригер SSRF",
        "Виправлення: явно вимкнути обробку DTD і резолюцію зовнішніх entity в конфігурації парсера",
      ],
      resources: KB.XXE!.resources,
    },
    "JWT Security": {
      cat: KB["JWT Security"]!.cat,
      learn: [
        "decode проти verify — ніколи не довіряти claims з токена, чий підпис не перевірено",
        "Хардкодити очікуваний алгоритм на стороні сервера; ніколи не приймати alg: none чи довіряти власному заголовку токена",
      ],
      resources: KB["JWT Security"]!.resources,
    },
    "SAST/DAST": {
      cat: KB["SAST/DAST"]!.cat,
      learn: [
        "SAST сканує сирцевий код без його виконання; DAST тестує застосунок, що працює, з-зовні, як атакувальник",
        "Накладання обох плюс сканування залежностей покриває значно більше, ніж будь-який окремо",
      ],
      resources: KB["SAST/DAST"]!.resources,
    },
    "Secure Coding Practices": {
      cat: KB["Secure Coding Practices"]!.cat,
      learn: [
        "Валідація вхідних даних, кодування виводу, параметризовані запити, сервісні акаунти з найменшими привілеями",
        "Управління секретами і сканування залежностей/supply-chain як частина стандартного робочого процесу розробки, не післядумка",
      ],
      resources: KB["Secure Coding Practices"]!.resources,
    },
    "TLS/SSL": {
      cat: KB["TLS/SSL"]!.cat,
      learn: [
        "Handshake: узгодження cipher suite, надання сертифіката, виведення симетричного сесійного ключа",
        "Ланцюжок довіри сертифікатів і валідація (збіг CN/SAN, терміни дії, відкликання через CRL/OCSP)",
      ],
      resources: KB["TLS/SSL"]!.resources,
    },
    "DNS Security": {
      cat: KB["DNS Security"]!.cat,
      learn: [
        "DNS cache poisoning/spoofing і як DNSSEC криптографічно підписує записи для захисту від цього",
        "DNS over HTTPS/TLS для захисту самого запиту від прослуховування",
      ],
      resources: KB["DNS Security"]!.resources,
    },
    "DDoS Protection": {
      cat: KB["DDoS Protection"]!.cat,
      learn: [
        "Об'ємні атаки (пропускна здатність) проти атак на рівні застосунку (дорогі запити) потребують різних заходів",
        "CDN/scrubbing-сервіси проти рейт-лімітування і захисту, свідомого вартості запиту, на рівні застосунку",
      ],
      resources: KB["DDoS Protection"]!.resources,
    },
    "IDS/IPS": {
      cat: KB["IDS/IPS"]!.cat,
      learn: [
        "Детекція (лише сповіщення) проти превенції (активно блокує) — і чому нові правила спочатку мають довести себе в режимі лише детекції",
        "Детекція на основі сигнатур проти детекції на основі аномалій",
      ],
      resources: KB["IDS/IPS"]!.resources,
    },
    "Network Segmentation": {
      cat: KB["Network Segmentation"]!.cat,
      learn: [
        "VLAN/підмережі/правила файрвола, що ізолюють зони, щоб компрометація не могла напряму досягти високоцінного активу",
        "Обмеження латерального руху — ключової стадії більшості реальних зломів — навіть коли захист периметра провалюється",
      ],
      resources: KB["Network Segmentation"]!.resources,
    },
    "Burp Suite": {
      cat: KB["Burp Suite"]!.cat,
      learn: [
        "Робочий процес перехоплюючого проксі: Proxy → Repeater для мануального повтору/підробки",
        "Автоматизований краулінг/сканування (Spider/Scanner) проти мануального, цільового тестування",
      ],
      resources: KB["Burp Suite"]!.resources,
    },
    Nmap: {
      cat: KB.Nmap!.cat,
      learn: [
        "Виявлення хостів, сканування портів, виявлення сервісу/версії (-sV) і скрипти NSE",
        "Запуск сканів проти власної інфраструктури для виявлення ненавмисно доступних сервісів",
      ],
      resources: KB.Nmap!.resources,
    },
    Wireshark: {
      cat: KB.Wireshark!.cat,
      learn: [
        "Захоплення пакетів і перевірка на рівні протоколу з потужними фільтрами відображення",
        "Перевірка, що трафік дійсно зашифрований, як очікувалось; форензик-аналіз захопленого трафіку інциденту",
      ],
      resources: KB.Wireshark!.resources,
    },
    Metasploit: {
      cat: KB.Metasploit!.cat,
      learn: [
        "Модулі експлойта/payload/post-exploitation — використовуються лише з явною письмовою авторизацією",
        "Перевірка, що відома вразливість реально експлуатовна в конкретному середовищі, не лише теоретично присутня",
      ],
      resources: KB.Metasploit!.resources,
    },
    "OWASP ZAP": {
      cat: KB["OWASP ZAP"]!.cat,
      learn: [
        "Безкоштовний, відкритий перехоплюючий проксі з автоматичним сканером",
        "Режим baseline-скану для CI-дружнього DAST проти повного активного скану",
      ],
      resources: KB["OWASP ZAP"]!.resources,
    },
    "Vulnerability Scanning": {
      cat: KB["Vulnerability Scanning"]!.cat,
      learn: [
        "Автоматичні сканери (Nessus, Qualys, OpenVAS), що перевіряють цілі проти бази даних відомих вразливостей/помилок конфігурації",
        "Триаж за серйозністю + експлуатовністю + експозицією, потім дедублювання за кореневою причиною замість трактування кожної знахідки незалежно",
      ],
      resources: KB["Vulnerability Scanning"]!.resources,
    },
    "Kali Linux": {
      cat: KB["Kali Linux"]!.cat,
      learn: [
        "Попередньо завантажений дистрибутив Linux для penetration testing — стандартизоване середовище, не інструмент сам по собі",
        "Лише для використання в явно авторизованих контекстах тестування",
      ],
      resources: KB["Kali Linux"]!.resources,
    },
    "Password Cracking": {
      cat: KB["Password Cracking"]!.cat,
      learn: [
        "Словникові атаки, брутфорс і мутації на основі правил зі словника (John the Ripper, Hashcat)",
        "Використовується захисно для аудиту того, чи реальні хеші паролів організації переживуть спробу зламу реального атакувальника",
      ],
      resources: KB["Password Cracking"]!.resources,
    },
    CyberChef: {
      cat: KB.CyberChef!.cat,
      learn: [
        "Ланцюжок операцій кодування/декодування/шифрування/трансформації для браузера",
        "Деобфускація payload'ів малваре чи даних CTF без написання власних скриптів",
      ],
      resources: KB.CyberChef!.resources,
    },
    Shodan: {
      cat: KB.Shodan!.cat,
      learn: [
        "Пошуковий рушій, що індексує підключені до інтернету пристрої/сервіси скануванням інтернету",
        "Пошук власних ненавмисно доступних пристроїв до того, як це зробить пошук атакувальника",
      ],
      resources: KB.Shodan!.resources,
    },
    Splunk: {
      cat: KB.Splunk!.cat,
      learn: [
        "Прийом логів, мова запитів SPL для пошуку/кореляції, правила сповіщень і дашборди",
        "Написання запиту для кореляції конкретного паттерну (наприклад, невдалі логіни, за якими йде успіх) по прийнятих логах",
      ],
      resources: KB.Splunk!.resources,
    },
  };
}
