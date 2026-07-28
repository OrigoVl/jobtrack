// A ladder of 4 pet projects (from the prep plan). Each one closes a specific gap
// and provides ready proof of skills on GitHub. DoD = Definition of Done (readiness criteria).
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
    subtitle: "React-only app",
    phase: "Phase 1",
    tech: ["React", "TypeScript", "TanStack Query", "Zustand"],
    goal: "Close gap #1 (React + TS + working with data). A GitHub repo search with a list, details, and favorites.",
    dod: [
      { id: "p1-1", text: "Repository search via the GitHub API with debounce" },
      { id: "p1-2", text: "Results list + loading / error / empty states" },
      { id: "p1-3", text: "Caching and pagination via TanStack Query" },
      { id: "p1-4", text: "Repository details page (route)" },
      { id: "p1-5", text: '"Favorites" in global state (Zustand) + persisted to localStorage' },
      { id: "p1-6", text: "Strict typing for props and API responses (no any)" },
      { id: "p1-7", text: "Deployed (Vercel/Netlify) + README" },
    ],
  },
  {
    id: "p2",
    name: "TaskFlow",
    subtitle: "Full-stack task tracker",
    phase: "Phases 2-3",
    tech: ["NestJS", "PostgreSQL", "Prisma", "JWT", "Docker"],
    goal: "Close gap #2 (SQL + Nest + auth + Docker). A full backend with authorization and a relational database.",
    dod: [
      { id: "p2-1", text: "Prisma schema + migrations (users, tasks, projects)" },
      { id: "p2-2", text: "Task CRUD with DTOs + class-validator" },
      { id: "p2-3", text: "Auth: register/login (JWT + bcrypt), protected routes" },
      { id: "p2-4", text: "Relations and filters; deliberately reproduce and fix an N+1" },
      { id: "p2-5", text: "Consistent error format + Swagger/OpenAPI" },
      { id: "p2-6", text: "Dockerfile + docker compose (API + Postgres)" },
      { id: "p2-7", text: "Unit + e2e tests (auth flow), README with setup/run instructions" },
    ],
  },
  {
    id: "p3",
    name: "TaskFlow Live",
    subtitle: "Real-time extension",
    phase: "Phase 4",
    tech: ["WebSockets", "Socket.IO", "Redis", "NestJS Gateway"],
    goal: "Demonstrate real-time skills (Clover, Galaktica, NovaPay all ask for this). Live task updates across tabs/users.",
    dod: [
      { id: "p3-1", text: "Nest Gateway (Socket.IO): live task updates between clients" },
      { id: "p3-2", text: "Optimistic UI on the frontend" },
      { id: "p3-3", text: "Presence — who's currently online" },
      { id: "p3-4", text: "Redis pub/sub for scaling WebSocket" },
      { id: "p3-5", text: "README describing the event-driven architecture" },
    ],
  },
  {
    id: "p4",
    name: "TaskFlow AI",
    subtitle: "LLM integration",
    phase: "Phase 5",
    tech: ["LLM API", "Streaming", "Tool calling"],
    goal: "Highlight your ace card — AI integration. Smart features on top of TaskFlow.",
    dod: [
      { id: "p4-1", text: '"Tasks from text": an LLM parses free-form text into structured tasks' },
      { id: "p4-2", text: "Streaming responses in the UI (SSE/stream)" },
      { id: "p4-3", text: "Structured responses (JSON schema / tool calling)" },
      { id: "p4-4", text: "API key kept secure on the backend + error/limit handling" },
      { id: "p4-5", text: "README with demo screenshots/gif" },
    ],
  },
];
