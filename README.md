# JobTrack — динамічний трекер пошуку роботи (React + Node + SQLite + AI)

Повноцінний легкий full-stack застосунок: **аналізує вакансії та CV, показує прогалини й попит ринку, тренує до співбесід і допомагає з резюме/листами.** Стек: **React + TypeScript + Node.js + SQLite (+ опційно LLM)**.

> **Вимога:** Node.js **≥ 22.5** (краще 24 LTS) — бекенд використовує вбудований модуль `node:sqlite`, окрема БД-залежність не потрібна.
> **Пакетний менеджер:** [pnpm](https://pnpm.io) (workspace-монорепо `client` + `server`). Встанови: `corepack enable` або `npm i -g pnpm`.

## Що вміє

- **🌐 Будь-яка професія** — з LLM навички та роль визначаються з CV й вакансій (не лише IT), і під це підлаштовуються AI-поради. Офлайн — fallback на словник IT-технологій.
- **📋 Вакансії** — CRUD, редагування прямо в таблиці, кольорове маркування статусу (таблиця + Канбан), автопідтягування стеку/рівня/fit за посиланням (з будь-якого публічного сайту вакансій) при додаванні/зміні URL, імпорт з DOU-експорту, імпорт/експорт JSON (upsert за `url`/company+position).
- **🔔 Нагадування** — опційні браузерні Web Notifications про прострочені/сьогоднішні «наступні кроки».
- **🔍 Аналіз вакансії** — навички і рівень (LLM або офлайн-словник), збіг/прогалини під профіль, семантична схожість CV↔вакансія (embeddings, з OpenAI-ключем).
- **🎯 Skill-radar** — «твої навички vs попит ринку» з реального стеку доданих вакансій (recency-weighted).
- **📊 Аналітика** — воронка подач (поточна + «коли-небудь досягли етапу»), конверсія між етапами, середній час у статусі, попит на технології.
- **🧠 Навчання** — флеш-картки на FSRS (як в Anki) + drill-режим (89 задач: JS/TS/React/SQL/Node/NestJS/алгоритми/System Design), JS-пісочниця, AI-підказки, генерація карток/задач під роль.
- **🎤 Мок-інтерв'ю** — випадкова добірка питань і задач із таймером та AI-оцінкою відповіді.
- **🗺️ Роудмапа** + **📅 Інтенсив 21 день** — трекери навчання з персистентним прогресом.
- **🧩 Pet-проєкти** — драбина з 4 проєктів із чек-лістами Definition of Done.
- **📄 CV** — аналіз проти попиту ринку, генератор Skills, cover letter (ручний текст / вибір із трекера / посилання з автозавантаженням), Конструктор CV з live-прев'ю і експортом у PDF.
- **🏢 Компанії** — нотатки й банк питань «що спитали тут».
- **🗂 Канбан вакансій** — drag-and-drop між статусами (з клавіатури теж).

## Швидкий старт

```bash
# з кореня репозиторію — встановлює й client, і server одразу (pnpm workspace)
pnpm install
cp server/.env.example server/.env   # (опційно) впиши OPENAI_API_KEY, щоб увімкнути AI

# піднімає бекенд (:3001) і фронтенд (:5173) одночасно
pnpm dev
```

Відкрий **http://localhost:5173**. База (SQLite) створюється автоматично.

Інші корисні команди з кореня: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`,
`pnpm test:coverage`, `pnpm test:e2e` (Playwright, потребує `pnpm build`).

### Прод-режим (один процес)

```bash
pnpm build                            # збере client у client/dist
pnpm --filter jobtrack-server start   # сервер сам віддасть фронтенд на http://localhost:3001
```

### Docker (одна команда)

```bash
docker compose up --build      # застосунок на http://localhost:3001
```

Multi-stage образ збирає фронтенд і запускає API, що роздає статику. БД (SQLite) зберігається у Docker-волюмі `jobtrack-data` (шлях — `DB_PATH`). LLM-ключі — через змінні оточення в `docker-compose.yml`.

## AI-режим (опційно)

Без ключа все працює в **офлайн-режимі** (аналіз за словником технологій, шаблонні листи). Щоб увімкнути AI — впиши у `server/.env`:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Підтримується і Anthropic (`LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=...`). Якщо задані **обидва** ключі, `client.ts` автоматично пробує другий провайдер, якщо перший повністю провалився (outage/rate-limit).

`server/src/config/env.ts` валідує `.env` через Zod при старті (fail-fast) і перевіряє, що ключ саме для вибраного `LLM_PROVIDER` заданий (а не будь-який) — інакше попередження в консоль замість тихого «напів-увімкненого» AI.

### Технічні деталі LLM-шару

- **Два рівні моделі** (`tier: "fast" | "smart"`) — дешева модель для екстракції/форматування, сильніша — для глибокого аналізу (рев'ю CV, match, cover letter, генерація).
- **`chatJson<T>()`** (`server/src/llm/client.ts`) — `chat()` у json-режимі + Zod-валідація структури + один self-repair retry, якщо відповідь не пройшла схему. Кожен call-site лише декларує очікувану форму.
- Кешування за хешем вхідних даних, одна повторна спроба на транзієнтні помилки (`429`/`5xx`), tier-aware timeout, логування помилок провайдера й обрізаних JSON-відповідей, облік токенів (`normalizeUsage()`).

### Алгоритмічні покращення (не-LLM, детерміновані)

Швидше/дешевше за LLM там, де завдання не потребує «розуміння» тексту — усі offline-тестовані:

- **FSRS** (`study/fsrs.ts`) — spaced-repetition алгоритм для SRS-флешкарток (той самий, що в Anki).
- **TF-IDF** (`jobs/job-ranking.ts`) — ранжування зовнішніх вакансій у `/jobs/search`.
- **Fuzzy-matching / Левенштейн** (`shared/fuzzy-match.ts`) — толерантність до друкарських помилок у назвах технологій.
- **Ймовірнісний fit-score** (`vacancies/vacancy-text.ts`) — логістична функція замість грубого «5 match = high».
- **Recency-weighted попит** (`shared/demand.ts`) — експоненційне згасання ваги вакансії за віком (half-life 90 днів).
- **SimHash-дедублікація** (`jobs/job-dedupe.ts`) — злиття near-duplicate вакансій з різних агрегаторів.
- **Векторні embeddings** (`llm/embeddings.ts`) — OpenAI `text-embedding-3-small` для семантичної схожості CV↔вакансія (лише з OpenAI-ключем).
- **Funnel-конверсія та середній час у статусі** (`db/vacancy-history.ts`) — похідні метрики з журналу зміни статусів.

## Логування

Структуроване JSON-логування на `pino` (у dev — кольоровий вивід через `pino-pretty`, у прод — чистий JSON у stdout).

- `pino-http` логує кожен HTTP-запит з унікальним `reqId`; `AsyncLocalStorage` прокидує його в сервіси без прямого доступу до `req`.
- Глобальний `redact` — `Authorization`/`Cookie`/`password`/`apiKey` ніколи не потраплять у лог.
- `unhandledRejection`/`uncaughtException` логуються структуровано, а не губляться в stderr.

Для продової агрегації логів (JSON у stdout, сумісно з будь-яким колектором) підійде
**[Axiom](https://axiom.co/)** чи **[Better Stack Logs](https://betterstack.com/logs)** (обидва мають готовий pino-транспорт і щедрий безкоштовний план) або self-hosted **[Dozzle](https://dozzle.dev/)** над `docker logs` для персонального використання.

## CI та якість коду

GitHub Actions (`.github/workflows/ci.yml`) на кожен push/PR у `main` ганяє:

1. **Lint · Typecheck · Test · Build** — для client і server, з baseline-порогами покривності тестів.
2. **E2E (Playwright)** — ключові наскрізні флоу на прод-білді, офлайн-режимі LLM (детермінований, без платних API), послідовно (`workers: 1`).

Локально `husky` + `lint-staged` автоматично прогонять Prettier перед кожним комітом.
Dependabot (`.github/dependabot.yml`) щотижня пропонує оновлення npm/Docker/Actions.

## Безпека

- `helmet()` з реальним Content-Security-Policy, глобальний rate-limit на `/api` (600 запитів/15хв на IP), окремий суворіший ліміт для AI-ендпоінтів (30/15хв — вони коштують грошей на LLM).
- Timeout на всі виклики LLM-провайдерів, SSRF-захист для парсингу вакансій за URL (блокує localhost/приватні/link-local IP, включно з cloud-metadata-адресами), обмеження типів файлів для завантаження (`multer`).
- `CORS_ORIGIN`/`TRUST_PROXY` — явно вимикаються за замовчуванням, вмикаються лише якщо реально потрібні.
- JS-пісочниця для drill-практики (`study/runner.ts`) виконується в ізольованому Web Worker з жорстким таймаутом — не в головному потоці.
- Docker-образ запускає процес від непривілейованого користувача.

**⚠️ Немає авторизації.** Застосунок свідомо однокористувацький (див. "Міграція на Postgres + auth" нижче) — будь-хто з мережевим доступом до порту 3001 бачить і редагує всі дані без логіну. Прийнятно для `localhost`/домашньої мережі, але **не виставляй порт напряму в публічний інтернет** без reverse-proxy з Basic Auth/OAuth (Caddy/nginx/Cloudflare Tunnel) чи VPN.

## Архітектура

Бекенд структурований **по доменних модулях** (feature-based, layered-стиль без фреймворк-оверхеду): кожен модуль має тонкий `*.routes.ts` (parse → delegate → respond) і `*.service.ts`/`*.data.ts` з бізнес-логікою, яку можна юніт-тестити без Express.

```
jobtrack/
├── Dockerfile, docker-compose.yml   # контейнеризація (multi-stage)
├── server/                  # Node (ESM) + TypeScript + Express + node:sqlite
│   └── src/
│       ├── index.ts         # entrypoint: app.listen()
│       ├── app.ts           # збірка Express-застосунку (middleware → /api → статика → errorHandler)
│       ├── routes.ts        # агрегує всі modules/*/*.routes.ts в один Router
│       ├── config/env.ts    # єдина типізована точка доступу до process.env
│       ├── core/            # http (HttpError/asyncHandler), logger (pino), error-handler
│       ├── db/              # client (з'єднання+схема+сід), types, kv, helpers
│       ├── llm/             # OpenAI/Anthropic-клієнт з graceful fallback + кеш відповідей
│       ├── shared/          # tech-dict, skill-extraction, validation (DTO+SSRF), demand, hash, slug, upload
│       └── modules/         # по одній теці на домен API:
│           ├── vacancies/   # CRUD вакансій + аналіз тексту вакансії
│           ├── jobs/        # пошук у зовнішніх агрегаторах (DOU/Remotive/Arbeitnow)
│           ├── cv/          # профіль, CV-конструктор, рев'ю/match, LinkedIn-імпорт, upload
│           ├── knowledge/   # статична + LLM-персоналізована база знань
│           ├── roadmap/     # roadmap.sh-стиль карта навичок з реальних даних
│           ├── plan21/      # динамічний 21-денний інтенсив (прогалини: вакансії − CV)
│           ├── study/       # SRS-картки + drills (статичні + LLM-згенеровані)
│           └── projects/, resources/, companies/, analytics/, writing/, mock/, health/
└── client/                  # React + Vite + TS + Router + TanStack Query
    └── src/
        ├── main.tsx, index.css      # entrypoint
        ├── app/App.tsx              # роутинг (React Router), sidebar/shell, providers
        ├── shared/                  # наскрізні речі, спільні для всіх фіч:
        │   ├── api.ts               # єдиний типізований контракт з бекендом
        │   ├── queries/             # TanStack Query хуки по домену (кеш, інвалідація, оптимістичні мутації)
        │   ├── toast.tsx            # ToastProvider/useToast
        │   ├── ui-state.ts          # useUi — персистентний UI-стан вкладок
        │   ├── types.ts             # спільні DTO-типи (дзеркалять бекенд)
        │   └── ui.tsx               # UI-кіт (Btn, Card, Chip, PageHeader, Skeleton…)
        └── features/                # по одній теці на домен екрана (дзеркалить server/src/modules):
            ├── dashboard/, vacancies/, jobs/, analyzer/, companies/
            ├── cv/                  # перегляд CV + Конструктор CV (cv.tsx, cv-builder/*)
            ├── knowledge/           # план навчання (learn.tsx)
            ├── roadmap/, plan21/, projects/, resources/, mock/
            ├── study/               # SRS + drills (study.tsx) + JS-пісочниця (runner.ts)
            └── analytics/           # Skill-radar + графіки (charts.tsx, code-split)
```

Дані та мутації йдуть через **TanStack Query** (`shared/queries/*`) — кожен домен має власний хук з типізованим ключем кешу; toggle-мутації роблять оптимістичне оновлення з відкатом при помилці мережі. Немає глобального "god context" — сторінки підписуються лише на потрібні їм дані.

## Що далі (ідеї для розвитку)

- Повноцінний календар співбесід (зараз лише базові Web Notifications).
- Дедуплікація при ручному додаванні вакансії (SimHash-дедуп зараз лише для `/jobs/search` і імпорту).
- Зберігати embedding кожної доданої вакансії й зробити семантичний пошук/рекомендації по всій БД (варто розглянути `sqlite-vec` замість брутфорс-косинуса в JS).
- `POST /cv/match` офлайн-фолбек досі не використовує `semanticFit` — лише token-overlap.

### Міграція на Postgres + auth (запланований крок)

Наразі персистентність — на `node:sqlite` (синхронний API, нуль залежностей). Для мультиюзерності потрібно: (1) винести доступ до БД за async-репозиторій, (2) підключити `pg`/Prisma до сервісу `postgres` (уже описаний у `docker-compose.yml`), (3) додати JWT-auth (login + guard на `/api`) і прив'язати дані до `user_id`. Свідомо винесено окремо, щоб не ламати наявний робочий шар.
