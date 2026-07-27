// Словник технологій для офлайн-аналізу тексту вакансій/CV.
// canonical -> { cat, re } де re — регулярка з алясами.
export interface TechDef {
  cat: string;
  re: RegExp;
}

export const TECHS: Record<string, TechDef> = {
  JavaScript: { cat: "Core", re: /\b(javascript|js|es6\+?|ecmascript)\b/i },
  TypeScript: { cat: "Core", re: /\b(typescript|ts)\b/i },
  React: { cat: "Frontend", re: /\breact(\.js|js)?\b/i },
  "Next.js": { cat: "Frontend", re: /\bnext\.?js\b/i },
  Vue: { cat: "Frontend", re: /\bvue(\.js|js)?\b/i },
  Nuxt: { cat: "Frontend", re: /\bnuxt\b/i },
  Angular: { cat: "Frontend", re: /\bangular\b/i },
  RxJS: { cat: "Frontend", re: /\brxjs\b/i },
  TailwindCSS: { cat: "Frontend", re: /\btailwind(css)?\b/i },
  "HTML/CSS": { cat: "Frontend", re: /\b(html5?|css3?|scss|sass)\b/i },
  "Node.js": { cat: "Backend", re: /\bnode(\.js|js)?\b/i },
  NestJS: { cat: "Backend", re: /\bnest(\.js|js)?\b/i },
  Express: { cat: "Backend", re: /\bexpress(\.js|js)?\b/i },
  GraphQL: { cat: "Backend", re: /\bgraphql\b/i },
  "REST API": { cat: "Backend", re: /\b(rest\s?api|restful|openapi|swagger)\b/i },
  WebSockets: { cat: "Backend", re: /\b(websocket|socket\.io|ws)\b/i },
  PostgreSQL: { cat: "Database", re: /\b(postgre?s(ql)?|pg)\b/i },
  MySQL: { cat: "Database", re: /\bmysql\b/i },
  MongoDB: { cat: "Database", re: /\bmongo(db)?\b/i },
  Redis: { cat: "Database", re: /\bredis\b/i },
  Prisma: { cat: "Database", re: /\bprisma\b/i },
  SQL: { cat: "Database", re: /\bsql\b/i },
  Docker: { cat: "DevOps", re: /\bdocker\b/i },
  Kubernetes: { cat: "DevOps", re: /\b(kubernetes|k8s)\b/i },
  AWS: { cat: "DevOps", re: /\b(aws|amazon web services|lambda|s3|ec2)\b/i },
  Azure: { cat: "DevOps", re: /\bazure\b/i },
  GCP: { cat: "DevOps", re: /\b(gcp|google cloud)\b/i },
  "CI/CD": { cat: "DevOps", re: /\b(ci\/cd|github actions|gitlab ci|jenkins)\b/i },
  Kafka: { cat: "DevOps", re: /\b(kafka|rabbitmq|message queue|event-driven)\b/i },
  Jest: { cat: "Testing", re: /\b(jest|vitest)\b/i },
  Playwright: { cat: "Testing", re: /\b(playwright|cypress|e2e)\b/i },
  Git: { cat: "Tools", re: /\bgit\b/i },
  "AI/LLM": { cat: "AI", re: /\b(ai|llm|openai|anthropic|claude|gpt|cursor|copilot|rag|embeddings?|prompt)\b/i },
  Python: { cat: "Other", re: /\bpython\b/i },
  Go: { cat: "Other", re: /\b(golang|\bgo\b)\b/i },
};

export interface TechMatch {
  name: string;
  cat: string;
}

export function extractTechs(text: unknown): TechMatch[] {
  const t = String(text || "");
  const found: TechMatch[] = [];
  for (const [name, def] of Object.entries(TECHS)) {
    if (def.re.test(t)) found.push({ name, cat: def.cat });
  }
  return found;
}

export function extractLevel(text: unknown): string {
  const t = String(text || "").toLowerCase();
  if (/\bsenior\b|\blead\b|\barchitect\b/.test(t)) return "Senior";
  if (/\bmiddle\b|\bmid\b/.test(t)) return "Middle";
  if (/\bjunior\b|\btrainee\b/.test(t)) return "Junior";
  return "";
}
