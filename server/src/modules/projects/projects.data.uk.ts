// Ukrainian mirror of projects.data.ts. Names and tech stacks stay untranslated (proper nouns).
import type { Project } from "./projects.data.js";

export const PROJECTS_UK: Project[] = [
  {
    id: "p1",
    name: "Repo Explorer",
    subtitle: "Застосунок лише на React",
    phase: "Фаза 1",
    tech: ["React", "TypeScript", "TanStack Query", "Zustand"],
    goal: "Закрити прогалину №1 (React + TS + робота з даними). Пошук репозиторіїв GitHub зі списком, деталями та обраним.",
    dod: [
      { id: "p1-1", text: "Пошук репозиторіїв через GitHub API з debounce" },
      { id: "p1-2", text: "Список результатів + стани завантаження / помилки / порожнього результату" },
      { id: "p1-3", text: "Кешування та пагінація через TanStack Query" },
      { id: "p1-4", text: "Сторінка деталей репозиторію (маршрут)" },
      { id: "p1-5", text: "«Обране» у глобальному стані (Zustand) + збереження в localStorage" },
      { id: "p1-6", text: "Строга типізація для props та відповідей API (без any)" },
      { id: "p1-7", text: "Розгорнуто (Vercel/Netlify) + README" },
    ],
  },
  {
    id: "p2",
    name: "TaskFlow",
    subtitle: "Full-stack трекер задач",
    phase: "Фази 2-3",
    tech: ["NestJS", "PostgreSQL", "Prisma", "JWT", "Docker"],
    goal: "Закрити прогалину №2 (SQL + Nest + авторизація + Docker). Повноцінний бекенд з авторизацією та реляційною базою даних.",
    dod: [
      { id: "p2-1", text: "Схема Prisma + міграції (users, tasks, projects)" },
      { id: "p2-2", text: "CRUD для задач з DTO + class-validator" },
      { id: "p2-3", text: "Автентифікація: реєстрація/логін (JWT + bcrypt), захищені маршрути" },
      { id: "p2-4", text: "Зв'язки та фільтри; свідомо відтворити та виправити N+1" },
      { id: "p2-5", text: "Уніфікований формат помилок + Swagger/OpenAPI" },
      { id: "p2-6", text: "Dockerfile + docker compose (API + Postgres)" },
      { id: "p2-7", text: "Unit + e2e тести (флоу автентифікації), README з інструкціями з налаштування/запуску" },
    ],
  },
  {
    id: "p3",
    name: "TaskFlow Live",
    subtitle: "Розширення для реального часу",
    phase: "Фаза 4",
    tech: ["WebSockets", "Socket.IO", "Redis", "NestJS Gateway"],
    goal: "Продемонструвати навички роботи в реальному часі (це вимагають Clover, Galaktica, NovaPay). Live-оновлення задач між вкладками/користувачами.",
    dod: [
      { id: "p3-1", text: "Nest Gateway (Socket.IO): live-оновлення задач між клієнтами" },
      { id: "p3-2", text: "Optimistic UI на фронтенді" },
      { id: "p3-3", text: "Presence — хто зараз онлайн" },
      { id: "p3-4", text: "Redis pub/sub для масштабування WebSocket" },
      { id: "p3-5", text: "README з описом event-driven архітектури" },
    ],
  },
  {
    id: "p4",
    name: "TaskFlow AI",
    subtitle: "Інтеграція з LLM",
    phase: "Фаза 5",
    tech: ["LLM API", "Streaming", "Tool calling"],
    goal: "Показати свій козир — інтеграцію з AI. Розумні фічі поверх TaskFlow.",
    dod: [
      { id: "p4-1", text: "«Задачі з тексту»: LLM перетворює довільний текст на структуровані задачі" },
      { id: "p4-2", text: "Стрімінг відповідей в UI (SSE/stream)" },
      { id: "p4-3", text: "Структуровані відповіді (JSON schema / tool calling)" },
      { id: "p4-4", text: "API-ключ безпечно зберігається на бекенді + обробка помилок/лімітів" },
      { id: "p4-5", text: "README зі скриншотами/gif демо" },
    ],
  },
];
