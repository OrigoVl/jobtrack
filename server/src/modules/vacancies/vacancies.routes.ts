import express from "express";
import db, { getProfile, type VacancyRow, j, withStack } from "../../db/index.js";
import { extractLevel } from "../../shared/tech-dict.js";
import { extractSkills } from "../../shared/skill-extraction.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { HttpError, asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { parseVacancyInput, parseText, type Fit } from "../../shared/validation.js";
import { fetchVacancyText, computeFit, quickAnalyze } from "./vacancy-analysis.service.js";

const r = express.Router();

// ---------- vacancies ----------
r.get("/vacancies", (_q, res) => {
  const rows = db.prepare("SELECT * FROM vacancies ORDER BY id DESC").all() as unknown as VacancyRow[];
  res.json(rows.map(withStack));
});
r.post("/vacancies", (req, res) => {
  const b = parseVacancyInput(req.body, { partial: false });
  const info = db
    .prepare("INSERT INTO vacancies (company,position,level,url,status,fit,applied,next,notes,stack) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(b.company!, b.position!, b.level!, b.url!, b.status!, b.fit!, b.applied!, b.next!, b.notes!, JSON.stringify(b.stack));
  const row = db.prepare("SELECT * FROM vacancies WHERE id=?").get(Number(info.lastInsertRowid)) as unknown as VacancyRow;
  res.status(201).json(withStack(row));
});
r.put("/vacancies/:id", (req, res) => {
  // Express 5: req.params.* типізовано як string | string[] (повторювані сегменти шляху),
  // хоча для "/:id" рантайм завжди повертає string.
  const id = String(req.params.id);
  const cur = db.prepare("SELECT * FROM vacancies WHERE id=?").get(id) as unknown as VacancyRow | undefined;
  if (!cur) throw new HttpError(404, "Вакансію не знайдено");
  const patch = parseVacancyInput(req.body, { partial: true });
  const m = {
    company: patch.company ?? cur.company,
    position: patch.position ?? cur.position,
    level: patch.level ?? cur.level,
    url: patch.url ?? cur.url,
    status: patch.status ?? cur.status,
    fit: patch.fit ?? cur.fit,
    applied: patch.applied ?? cur.applied,
    next: patch.next ?? cur.next,
    notes: patch.notes ?? cur.notes,
    stack: patch.stack ?? j(cur.stack),
  };
  db.prepare("UPDATE vacancies SET company=?,position=?,level=?,url=?,status=?,fit=?,applied=?,next=?,notes=?,stack=? WHERE id=?").run(
    m.company,
    m.position,
    m.level,
    m.url,
    m.status,
    m.fit,
    m.applied,
    m.next,
    m.notes,
    JSON.stringify(m.stack),
    id,
  );
  res.json(withStack(db.prepare("SELECT * FROM vacancies WHERE id=?").get(id) as unknown as VacancyRow));
});
r.delete("/vacancies/:id", (req, res) => {
  const id = String(req.params.id);
  const info = db.prepare("DELETE FROM vacancies WHERE id=?").run(id);
  res.json({ ok: true, deleted: Number(info.changes) });
});

// спарсити ОДНУ вакансію за посиланням і оновити стек
r.post(
  "/vacancies/:id/fetch",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const v = db.prepare("SELECT * FROM vacancies WHERE id=?").get(id) as unknown as VacancyRow | undefined;
    if (!v) throw new HttpError(404, "Вакансію не знайдено");
    if (!v.url) throw new HttpError(400, "У вакансії немає посилання");
    const text = await fetchVacancyText(v.url);
    const a = await quickAnalyze(text);
    db.prepare("UPDATE vacancies SET stack=?,level=?,fit=? WHERE id=?").run(JSON.stringify(a.techs), a.level || v.level, a.fit, v.id);
    res.json({ id: v.id, ...a });
  }),
);

// спарсити ВСІ вакансії з посиланнями
r.post(
  "/vacancies/fetch-all",
  aiLimiter,
  asyncHandler(async (_req, res) => {
    const rows = db.prepare("SELECT * FROM vacancies WHERE url IS NOT NULL AND url<>''").all() as unknown as VacancyRow[];
    const results: Array<{ id: number; company: string; techs?: string[]; level?: string; fit?: Fit; error?: string }> = [];
    for (const v of rows) {
      try {
        const text = await fetchVacancyText(v.url);
        if (text.length < 200) {
          results.push({ id: v.id, company: v.company, error: "порожньо/недоступно" });
          continue;
        }
        const a = await quickAnalyze(text);
        db.prepare("UPDATE vacancies SET stack=?,level=?,fit=? WHERE id=?").run(JSON.stringify(a.techs), a.level || v.level, a.fit, v.id);
        results.push({ id: v.id, company: v.company, techs: a.techs, level: a.level, fit: a.fit });
      } catch (e) {
        results.push({ id: v.id, company: v.company, error: (e as Error).message });
      }
      await new Promise((resolve) => setTimeout(resolve, 400)); // ввічлива пауза
    }
    res.json({ processed: results.length, results });
  }),
);

// аналіз тексту вакансії (офлайн словник + опційно LLM)
r.post(
  "/vacancies/analyze",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const text = parseText(req.body, "text");
    const techs = await extractSkills(text);
    const level = extractLevel(text);
    const profile = getProfile();
    const gap = techs.filter((t) => !profile.skills.includes(t));
    const match = techs.filter((t) => profile.skills.includes(t));
    let summary = null;
    if (llmAvailable()) {
      summary = await chat(
        "Ти рекрутер. Стисло українською.",
        `Ось текст вакансії. Виділи 5-8 ключових вимог одним списком і 1 реченням оціни, чи підходить кандидат з навичками: ${profile.skills.join(", ")}.\n\n${text.slice(0, 4000)}`,
        { maxTokens: 500, cache: true },
      );
    }
    res.json({ techs, level, gap, match, summary, fit: computeFit(match, gap) });
  }),
);

// імпорт вакансій з DOU-експорту (HTML/текст) — витягуємо посилання
r.post("/vacancies/import", (req, res) => {
  const html = parseText(req.body, "html", { min: 1, max: 500000 });
  const re = /https:\/\/jobs\.dou\.ua\/companies\/([^/"'\s]+)\/vacancies\/(\d+)/g;
  const seen = new Set<string>();
  const added: { company: string; url: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    const url = m[0] + "/";
    const company = m[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (db.prepare("SELECT id FROM vacancies WHERE url=?").get(url)) continue;
    db.prepare("INSERT INTO vacancies (company,position,url,status) VALUES (?,?,?,?)").run(company, "(імпортовано)", url, "Хочу подати");
    added.push({ company, url });
  }
  res.json({ added: added.length, items: added });
});

export default r;
