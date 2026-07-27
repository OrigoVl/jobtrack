// Побудова структурованого CV-документа (конструктор): порожній шаблон і
// LLM-парсинг довільного тексту резюме у структуру CvDocSchema.
import { getProfile, getKvJson } from "../../db/index.js";
import { chat } from "../../llm/index.js";
import { CvDocSchema, CvThemeSchema, type CvDoc } from "./cv.schemas.js";

export function emptyCvDoc(): CvDoc {
  const p = getProfile();
  return {
    name: "",
    title: p.domain || "",
    contact: "",
    summary: "",
    photo: "",
    skills: p.skills || [],
    experience: [],
    education: [],
    projects: [],
    languages: [],
    theme: CvThemeSchema.parse(undefined),
  };
}

export async function parseCvDocFromText(cvText: string): Promise<CvDoc> {
  const out = await chat(
    "Ти парсиш резюме у структуру. Відповідай ЛИШЕ валідним JSON. Зберігай мову оригіналу.",
    `Розбий резюме на структуру. Резюме:\n${cvText}\n\n` +
      `Формат строго: {"name":"","title":"","contact":"email/лінки","summary":"2-4 речення","skills":["..."],` +
      `"experience":[{"role":"","company":"","period":"","bullets":["результат-орієнтовані пункти"]}],"education":["..."],"projects":["..."],` +
      `"languages":[{"name":"English","level":"B2|C1|Рідна тощо"}]}`,
    // Повне резюме (кілька місць роботи × кілька буллетів + освіта/проєкти/мови) — 1500
    // токенів реально не вистачало на насичені CV (той самий клас обрізання JSON, що й
    // у reviewCv/matchCv), і generation тихо обрізався по maxTokens ще до закриття JSON.
    { json: true, maxTokens: 2600, temperature: 0.3, cache: true, tier: "smart" },
  );
  const doc = CvDocSchema.parse(out || {});
  const prev = getKvJson<CvDoc>("cvDoc");
  if (prev?.theme) doc.theme = CvThemeSchema.parse(prev.theme);
  return doc;
}
