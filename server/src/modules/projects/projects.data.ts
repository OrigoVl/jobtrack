// Драбина з 4 pet-проєктів (з плану підготовки). Кожен закриває конкретну прогалину
// й дає готовий доказ навичок на GitHub. DoD = Definition of Done (критерії готовності).
export interface ProjectDodItem {
  id: string;
  text: string;
}

export interface Project {
  id: string;
  name: string;
  subtitle: string;
  phase: string;
  tech: string[];
  goal: string;
  dod: ProjectDodItem[];
}

export const PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Repo Explorer",
    subtitle: "React-only застосунок",
    phase: "Фаза 1",
    tech: ["React", "TypeScript", "TanStack Query", "Zustand"],
    goal: "Закрити прогалину №1 (React + TS + робота з даними). Пошук репозиторіїв GitHub зі списком, деталями й обраним.",
    dod: [
      { id: "p1-1", text: "Пошук репозиторіїв через GitHub API з debounce" },
      { id: "p1-2", text: "Список результатів + стани loading / error / empty" },
      { id: "p1-3", text: "Кешування й пагінація через TanStack Query" },
      { id: "p1-4", text: "Сторінка деталей репозиторію (роут)" },
      { id: "p1-5", text: "«Обране» у глобальному стані (Zustand) + збереження в localStorage" },
      { id: "p1-6", text: "Строга типізація props і відповідей API (без any)" },
      { id: "p1-7", text: "Задеплоєно (Vercel/Netlify) + README" },
    ],
  },
  {
    id: "p2",
    name: "TaskFlow",
    subtitle: "Full-stack трекер задач",
    phase: "Фази 2–3",
    tech: ["NestJS", "PostgreSQL", "Prisma", "JWT", "Docker"],
    goal: "Закрити прогалину №2 (SQL + Nest + auth + Docker). Повноцінний бекенд із авторизацією та реляційною БД.",
    dod: [
      { id: "p2-1", text: "Prisma-схема + міграції (users, tasks, projects)" },
      { id: "p2-2", text: "CRUD задач з DTO + class-validator" },
      { id: "p2-3", text: "Auth: реєстрація/логін (JWT + bcrypt), захищені маршрути" },
      { id: "p2-4", text: "Зв'язки та фільтри; свідомо відтворити й полагодити N+1" },
      { id: "p2-5", text: "Єдиний формат помилок + Swagger/OpenAPI" },
      { id: "p2-6", text: "Dockerfile + docker compose (API + Postgres)" },
      { id: "p2-7", text: "Unit + e2e тести (auth flow), README з інструкцією запуску" },
    ],
  },
  {
    id: "p3",
    name: "TaskFlow Live",
    subtitle: "Real-time розширення",
    phase: "Фаза 4",
    tech: ["WebSockets", "Socket.IO", "Redis", "NestJS Gateway"],
    goal: "Показати real-time (просять Clover, Galaktica, NovaPay). Живі оновлення задач між вкладками/користувачами.",
    dod: [
      { id: "p3-1", text: "Nest Gateway (Socket.IO): live-оновлення задач між клієнтами" },
      { id: "p3-2", text: "Оптимістичний UI на фронті" },
      { id: "p3-3", text: "Presence — хто зараз онлайн" },
      { id: "p3-4", text: "Redis pub/sub для масштабування WebSocket" },
      { id: "p3-5", text: "README з описом event-driven архітектури" },
    ],
  },
  {
    id: "p4",
    name: "TaskFlow AI",
    subtitle: "LLM-інтеграція",
    phase: "Фаза 5",
    tech: ["LLM API", "Streaming", "Tool calling"],
    goal: "Підкреслити твій козир — AI-інтеграцію. Розумні фічі поверх TaskFlow.",
    dod: [
      { id: "p4-1", text: "«Задачі з тексту»: LLM парсить довільний текст у структуровані задачі" },
      { id: "p4-2", text: "Стрімінг відповіді у UI (SSE/stream)" },
      { id: "p4-3", text: "Структуровані відповіді (JSON schema / tool calling)" },
      { id: "p4-4", text: "Захист ключа на бекенді + обробка помилок/лімітів" },
      { id: "p4-5", text: "README з демо-скриншотами/gif" },
    ],
  },
];
