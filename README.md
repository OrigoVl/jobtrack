# JobTrack — динамічний трекер пошуку роботи (React + Node + SQLite + AI)

Повноцінний легкий full-stack застосунок, що вирішує реальну задачу: **аналізує вакансії та CV, показує прогалини й попит ринку, тренує до співбесід і допомагає з резюме/листами.** Побудований на твоєму стеку зростання: **React + TypeScript + Node.js + SQLite (+ опційно LLM)**.

> **Вимога:** Node.js **≥ 22.5** (краще 24 LTS) — бекенд використовує вбудований модуль `node:sqlite`, тож окрема БД-залежність не потрібна.
> **Пакетний менеджер:** [pnpm](https://pnpm.io) (workspace-монорепо `client` + `server`). Встанови: `corepack enable` (йде разом з Node) або `npm i -g pnpm`.

## Що вміє (v1)

- **🌐 Будь-яка професія** — з LLM навички та **професія/роль визначаються з CV й вакансій** (не лише IT: дизайн, маркетинг, аналітика тощо), і під цю роль підлаштовуються всі AI-поради. Офлайн — fallback на словник IT-технологій.
- **📋 Вакансії** — CRUD, редагування прямо в таблиці, **імпорт з DOU-експорту** (встав HTML → витягне посилання).
- **🔍 Аналіз вакансії** — встав текст → визначає **навички і рівень** (LLM для будь-якої галузі, офлайн — словник), рахує **збіг/прогалини** під твій профіль; з LLM — ще й розумне резюме вимог.
- **🎯 Skill-radar** — графік «твої навички vs попит ринку» (рахується з реального стеку доданих вакансій).
- **📊 Аналітика** — воронка подач (статуси) + попит на технології.
- **🧠 Навчання** — **розумні флеш-картки (SRS, інтервали як в Anki)** + **drill-режим**: 89 практичних задач (JS/TS/React/SQL/Node/NestJS/алгоритми/System Design), фільтри за темою й складністю, відмітка «розвʼязано», **JS-пісочниця з запуском коду**, **прогресивні AI-підказки** та **генерація карток і задач під твою роль/прогалини** (доповнює пул для будь-якої професії).
- **🎤 Мок-інтерв'ю** — симуляція співбесіди: випадкова добірка питань і задач із таймером.
- **🗺️ Роудмапа** + **📅 Інтенсив 21 день** — трекери навчання з персистентним прогресом.
- **🧩 Pet-проєкти** — драбина з 4 проєктів із чек-лістами Definition of Done.
- **📄 CV** — аналіз резюме проти попиту ринку + рекомендації, генератор Skills, **cover letter** та **експорт у PDF**.
- **🏢 Компанії** — нотатки й банк питань «що спитали тут».
- **🗂 Канбан вакансій** — drag-and-drop карток між статусами.

## Швидкий старт

```bash
# з кореня репозиторію — встановлює й client, і server одразу (pnpm workspace)
pnpm install
cp server/.env.example server/.env   # (опційно) впиши OPENAI_API_KEY, щоб увімкнути AI
                                      # два рівні моделі: *_MODEL (швидка) і *_MODEL_SMART (якісні поради/оцінки/генерація)

# піднімає бекенд (:3001) і фронтенд (:5173) одночасно
pnpm dev
```

Відкрий **http://localhost:5173**. База (SQLite) створюється автоматично й засівається 16 вакансіями з твоєї таблиці.

Інші корисні команди з кореня: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format`.

### Прод-режим (один процес)

```bash
pnpm build                     # збере client у client/dist
pnpm --filter jobtrack-server start   # сервер сам віддасть фронтенд на http://localhost:3001
```

### Docker (одна команда)

```bash
docker compose up --build      # застосунок на http://localhost:3001
```

Multi-stage образ збирає фронтенд і запускає API, що роздає статику. БД (SQLite) зберігається у Docker-волюмі `jobtrack-data` (шлях задається змінною `DB_PATH`), тож дані не втрачаються між перезапусками. LLM-ключі — через змінні оточення в `docker-compose.yml`.

## AI-режим (опційно)

Без ключа все працює в **офлайн-режимі** (аналіз за словником технологій, шаблонні листи). Щоб увімкнути розумні функції — впиши у `server/.env`:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Підтримується і Anthropic (`LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=...`).

## Архітектура

Бекенд структурований **по доменних модулях** (feature-based, у стилі layered-архітектури
NestJS, але без зайвого фреймворк-оверхеду): кожен модуль має тонкий `*.routes.ts`
(parse → delegate → respond) і `*.service.ts`/`*.data.ts` з бізнес-логікою, яку можна
юніт-тестити без Express. Наскрізні речі (БД, LLM, конфіг, http/логер-примітиви,
крос-доменні утиліти) винесені в окремі шари верхнього рівня.

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
│       ├── db/              # client (з'єднання+схема+сід), types, kv (профіль/прогрес/SRS), helpers
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
│           ├── projects/, resources/, companies/, analytics/, writing/, mock/, health/
└── client/                  # React + Vite + TS + Router + TanStack Query
    └── src/
        ├── main.tsx, index.css      # entrypoint
        ├── app/App.tsx              # роутинг (React Router), sidebar/shell, providers
        ├── shared/                  # наскрізні речі, спільні для всіх фіч:
        │   ├── api.ts               # єдиний типізований контракт з бекендом (усі HTTP-виклики)
        │   ├── store.tsx            # глобальний стан (Context) + персистентний UI (useUi)
        │   ├── types.ts             # спільні DTO-типи (дзеркалять бекенд)
        │   ├── ui.tsx                # UI-кіт (Btn, Card, Chip, PageHeader, Skeleton…)
        │   └── view-kit.tsx         # дрібні хелпери, спільні для 2+ фіч (Field, fitTone/fitText)
        └── features/                # по одній теці на домен екрана (дзеркалить server/src/modules):
            ├── dashboard/, vacancies/, jobs/, analyzer/, companies/
            ├── cv/                  # перегляд CV + Конструктор CV (cv.tsx, cv-builder.tsx)
            ├── knowledge/           # план навчання (learn.tsx)
            ├── roadmap/, plan21/, projects/, resources/, mock/
            ├── study/               # SRS + drills (study.tsx) + JS-пісочниця (runner.ts)
            └── analytics/           # Skill-radar + графіки (charts.tsx, code-split)
```

## Що далі (ідеї для розвитку)

Календар співбесід із нагадуваннями (Web Notifications), реальний парсинг вакансії за URL (бекенд-проксі до DOU), семантичний пошук по вакансіях (ембединги + pgvector).

### Міграція на Postgres + auth (запланований крок)

Наразі персистентність — на `node:sqlite` (синхронний API, нуль залежностей). Для мультиюзерності потрібно: (1) винести доступ до БД за async-репозиторій, (2) підключити `pg`/Prisma до сервісу `postgres` (уже описаний у `docker-compose.yml`), (3) додати JWT-auth (login + guard на `/api`) і прив'язати дані до `user_id`. Це свідомо винесено окремо, щоб не ламати наявний робочий шар. Фактично це і є **навчальний Проєкт 2** з інтенсиву — доводячи його, ти закриваєш SQL, Nest, auth і Docker на реальному продукті.
