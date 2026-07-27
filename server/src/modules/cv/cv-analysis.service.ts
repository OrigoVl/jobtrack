// Аналіз, глибоке рев'ю та порівняння CV з вакансією — бізнес-логіка, винесена
// з контролерів, щоб роути /cv/* лишались тонкими (parse → delegate → respond).
import { getProfile } from "../../db/index.js";
import { extractTechs } from "../../shared/tech-dict.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { demandMap } from "../../shared/demand.js";

export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const strs = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === "string");

// ---------- /cv/analyze ----------
export interface CvAnalysis {
  demand: Record<string, number>;
  gaps: [string, number][];
  strengths: [string, number][];
  advice: string;
}

export async function cvAnalysis(cvText: string): Promise<CvAnalysis> {
  const profile = getProfile();
  const demand = demandMap();
  const cvTechs = cvText ? extractTechs(cvText).map((t) => t.name) : [];
  const skills = new Set([...profile.skills, ...cvTechs]);
  const gaps = Object.entries(demand)
    .filter(([t]) => !skills.has(t))
    .sort((a, b) => b[1] - a[1]);
  const strengths = Object.entries(demand)
    .filter(([t]) => skills.has(t))
    .sort((a, b) => b[1] - a[1]);
  const role = profile.domain || "фахівець";
  let advice = `Сильні сторони під попит: ${strengths
    .slice(0, 6)
    .map((s) => s[0])
    .join(", ")}. Пріоритетні прогалини: ${gaps
    .slice(0, 5)
    .map((g) => `${g[0]} (${g[1]} вак.)`)
    .join(", ")}.`;
  if (llmAvailable() && cvText) {
    const llm = await chat(
      `Ти кар'єрний коуч для ролі «${role}». Українською, конкретно.`,
      `CV кандидата:\n${cvText.slice(0, 5000)}\n\nПопит ринку (к-сть вакансій за навичкою): ${JSON.stringify(demand)}.\nДай 4-6 конкретних рекомендацій: що підтягнути й що підкреслити в резюме.`,
      { maxTokens: 600, cache: true, tier: "smart" },
    );
    if (llm) advice = llm;
  }
  return { demand, gaps, strengths, advice };
}

// ---------- /cv/review: глибокий рев'ю CV (структуровані, дієві поради) ----------
export interface CvIssue {
  title: string;
  fix: string;
}
export interface CvReview {
  score: number;
  summary: string;
  strengths: string[];
  issues: CvIssue[];
  keywords: string[];
  rewrites: { before: string; after: string }[];
}

// "no-key" — LLM взагалі не налаштований (llmAvailable()===false). "llm-failed" — ключ Є, але
// саме ЦЕЙ запит не дав валідної відповіді (таймаут/помилка провайдера/обрив JSON по maxTokens).
// Раніше обидва випадки показували ОДНАКОВИЙ текст "Увімкни LLM у server/.env" — що вводило в
// оману, коли LLM насправді ввімкнений і просто цей один запит не вдався (саме це репортував
// користувач: LLM в .env є, а повідомлення каже його увімкнути).
type FallbackReason = "no-key" | "llm-failed";

function fallbackSummary(reason: FallbackReason): string {
  return reason === "no-key"
    ? "Базова офлайн-перевірка. Увімкни LLM у server/.env для глибокого персонального рев'ю."
    : "AI тимчасово не відповів, тож показано базову перевірку за словником. Спробуй ще раз за хвилину.";
}

function heuristicReview(cvText: string, reason: FallbackReason = "no-key"): CvReview {
  const text = cvText || "";
  const issues: CvIssue[] = [];
  if (!/\d/.test(text))
    issues.push({ title: "Немає цифр і результатів", fix: "Додай метрики: «пришвидшив X на 40%», «зменшив час збірки з 8 до 2 хв»." });
  if (!/\b(ai|llm|gpt|ml|rag|prompt|openai|anthropic)\b/i.test(text))
    issues.push({ title: "Слабко розкрито AI-досвід", fix: "Опиши які саме AI-інструменти/фічі використовував і який ефект дали." });
  if (text.length < 800) issues.push({ title: "Замало деталей", fix: "Розкрий досвід буллетами «дія → технологія → результат»." });
  if (!/\b(led|built|shipped|reduced|improved|designed|launched|створив|запустив|оптимізував|зменшив)\b/i.test(text)) {
    issues.push({
      title: "Мало дієслів дії/результату",
      fix: "Починай буллети з сильних дієслів і фокусуйся на результаті, а не процесі.",
    });
  }
  return {
    score: Math.max(30, 80 - issues.length * 12),
    summary: fallbackSummary(reason),
    strengths: [],
    issues,
    keywords: [],
    rewrites: [],
  };
}

export async function reviewCv(cvText: string): Promise<CvReview & { offline: boolean }> {
  const profile = getProfile();
  const role = profile.domain || "фахівець";
  const demand = demandMap();
  if (!llmAvailable()) return { offline: true, ...heuristicReview(cvText) };
  const out = await chat(
    `Ти досвідчений технічний рекрутер і кар'єрний коуч для ролі «${role}». Даєш чесний, дієвий фідбек по резюме. Відповідай ЛИШЕ валідним JSON українською.`,
    `Резюме кандидата:\n${cvText}\n\n` +
      `Попит ринку (навички з вакансій): ${JSON.stringify(demand)}.\n` +
      `Оціни резюме за принципами: фокус на РЕЗУЛЬТАТАХ (а не процесі), кількісні метрики, сильні дієслова, ATS-ключові слова під попит, конкретика по AI/інструментах (що саме і який ефект).\n` +
      `Поверни JSON строго: {"score":<0-100>,"summary":"1-2 речення загального враження",` +
      `"strengths":["3-5 сильних сторін"],` +
      `"issues":[{"title":"проблема","fix":"як виправити конкретно"}],` +
      `"keywords":["6-12 ключових слів/навичок, які варто додати під попит і ATS"],` +
      `"rewrites":[{"before":"слабке формулювання з резюме","after":"переписане, з результатом і метрикою"}]}`,
    // maxTokens 2200 (не 1200) — рев'ю зі score+summary+3-5 strengths+кількома issues+6-12
    // keywords+кількома rewrites (кожен: повне "before" І "after" речення) охоче виходить довшим
    // за 1200 токенів; при обриві генерації по лімiту JSON лишається синтаксично невалідним і
    // безшумно (HTTP 200, тому й не ловилось перевіркою r.ok вище) падає в офлайн-евристику —
    // саме так виглядав репортований баг ("натискаю Поради — отримую generic-текст").
    { json: true, maxTokens: 2200, temperature: 0.4, cache: true, tier: "smart" },
  );
  // offline:true (НЕ false) — далі йде та сама офлайн-евристика, що й при вимкненому LLM
  // (llmAvailable()===false вище). Хибне "offline:false" тут означало, що клієнт (і сам
  // користувач) не міг відрізнити справжній глибокий AI-рев'ю від дефолтного офлайн-фолбеку —
  // саме так виглядав звіт користувача "натискаю Поради — отримую generic-текст, offline:false".
  if (!out || typeof out.score !== "number") return { offline: true, ...heuristicReview(cvText, "llm-failed") };
  return {
    offline: false,
    score: Math.max(0, Math.min(100, Math.round(out.score))),
    summary: typeof out.summary === "string" ? out.summary : "",
    strengths: strs(out.strengths),
    issues: arr(out.issues)
      .filter((x): x is { title: string; fix?: unknown } => !!x && typeof (x as { title?: unknown }).title === "string")
      .map((x) => ({ title: x.title, fix: typeof x.fix === "string" ? x.fix : "" })),
    keywords: strs(out.keywords),
    rewrites: arr(out.rewrites)
      .filter(
        (x): x is { before: string; after: string } =>
          !!x && typeof (x as { before?: unknown }).before === "string" && typeof (x as { after?: unknown }).after === "string",
      )
      .map((x) => ({ before: x.before, after: x.after })),
  };
}

// ---------- /cv/match: порівняння CV з конкретною вакансією ----------
function tokenizeSkills(text: string): string[] {
  const stop = new Set(["and", "the", "for", "with", "you", "our", "der", "die", "und", "та", "і", "в", "на", "до", "з", "що", "як"]);
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .match(/[a-zа-яїєґ0-9+#.]{2,}/gi) || [],
    ),
  ).filter((t) => t.length > 2 && !stop.has(t));
}
export interface CvMatch {
  score: number;
  verdict: string;
  matched: string[];
  missing: string[];
  suggestions: { title: string; fix: string }[];
  tailoredSummary: string;
}
function heuristicMatch(cvText: string, jobText: string, reason: FallbackReason = "no-key"): CvMatch {
  const cv = new Set(tokenizeSkills(cvText));
  const jobTokens = tokenizeSkills(jobText);
  const matched = jobTokens.filter((t) => cv.has(t));
  const missing = jobTokens.filter((t) => !cv.has(t));
  const score = jobTokens.length ? Math.round((matched.length / jobTokens.length) * 100) : 0;
  return {
    score,
    verdict:
      reason === "no-key"
        ? "Базове офлайн-порівняння за ключовими словами. Увімкни LLM для точного gap-аналізу."
        : "AI тимчасово не відповів, тож показано базове порівняння за ключовими словами. Спробуй ще раз за хвилину.",
    matched: matched.slice(0, 20),
    missing: missing.slice(0, 20),
    suggestions: [],
    tailoredSummary: "",
  };
}

export async function matchCv(cvText: string, jobTitle: string, jobText: string): Promise<CvMatch & { offline: boolean }> {
  const combined = `${jobTitle}\n${jobText}`;
  if (!llmAvailable()) return { offline: true, ...heuristicMatch(cvText, combined) };
  const out = await chat(
    "Ти технічний рекрутер. Порівнюєш резюме кандидата з вимогами КОНКРЕТНОЇ вакансії й даєш точковий gap-аналіз. Відповідай ЛИШЕ валідним JSON українською. Не вигадуй досвід, якого немає в резюме.",
    `Вакансія: ${jobTitle}\nВимоги/опис/стек:\n${jobText}\n\nРезюме кандидата:\n${cvText}\n\n` +
      `Поверни JSON строго: {"score":<0-100 наскільки CV підходить під цю вакансію>,` +
      `"verdict":"1-2 речення вердикт",` +
      `"matched":["вимоги/навички, які кандидат вже покриває"],` +
      `"missing":["чого бракує саме під цю вакансію (навички/ключові слова)"],` +
      `"suggestions":[{"title":"що зробити","fix":"конкретна дія під цю вакансію"}],` +
      `"tailoredSummary":"переписаний під цю вакансію summary 2-3 речення, лише на основі реального досвіду кандидата"}`,
    // maxTokens 1800 (не 1000) — той самий ризик обриву генерації, що й у reviewCv вище.
    { json: true, maxTokens: 1800, temperature: 0.4, cache: true, tier: "smart" },
  );
  // Той самий фікс, що й у reviewCv вище: це офлайн-евристика, а не результат LLM.
  if (!out || typeof out.score !== "number") return { offline: true, ...heuristicMatch(cvText, combined, "llm-failed") };
  return {
    offline: false,
    score: Math.max(0, Math.min(100, Math.round(out.score))),
    verdict: typeof out.verdict === "string" ? out.verdict : "",
    matched: strs(out.matched),
    missing: strs(out.missing),
    suggestions: arr(out.suggestions)
      .filter((x): x is { title: string; fix?: unknown } => !!x && typeof (x as { title?: unknown }).title === "string")
      .map((x) => ({ title: x.title, fix: typeof x.fix === "string" ? x.fix : "" })),
    tailoredSummary: typeof out.tailoredSummary === "string" ? out.tailoredSummary : "",
  };
}
