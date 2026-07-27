import express from "express";
import db, { getProfile, recordStatusChange, deleteHistoryForVacancy, type VacancyRow, j, withStack } from "../../db/index.js";
import { extractLevel } from "../../shared/tech-dict.js";
import { extractSkills } from "../../shared/skill-extraction.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { HttpError, asyncHandler } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import {
  parseVacancyInput,
  parseJsonVacancyItem,
  parseText,
  parsePagination,
  type Fit,
  type JsonVacancyItem,
} from "../../shared/validation.js";
import { fetchVacancyText, computeFit, quickAnalyze, tryAutoEnrichStack } from "./vacancy-analysis.service.js";

const r = express.Router();

// ---------- vacancies ----------
// Без ?limit/?offset — весь список (поточна поведінка, потрібна Kanban-дошці для групування
// за статусом). З ?limit — обмежена сторінка, на випадок якщо список виросте.
r.get("/vacancies", (req, res) => {
  const { limit, offset } = parsePagination(req.query);
  const rows = (limit != null
    ? db.prepare("SELECT * FROM vacancies ORDER BY id DESC LIMIT ? OFFSET ?").all(limit, offset)
    : db.prepare("SELECT * FROM vacancies ORDER BY id DESC").all()) as unknown as VacancyRow[];
  res.json(rows.map(withStack));
});
r.post(
  "/vacancies",
  asyncHandler(async (req, res) => {
    const b = parseVacancyInput(req.body, { partial: false });
    const info = db
      .prepare("INSERT INTO vacancies (company,position,level,url,status,fit,applied,next,notes,stack) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(b.company!, b.position!, b.level!, b.url!, b.status!, b.fit!, b.applied!, b.next!, b.notes!, JSON.stringify(b.stack));
    const id = Number(info.lastInsertRowid);
    recordStatusChange(id, b.status!);
    // Автозбагачення: якщо додають вакансію одразу з посиланням і без явного стеку — спробувати
    // стягнути стек/рівень/fit з тексту вакансії (будь-який публічний https-хост, best-effort —
    // див. tryAutoEnrichStack).
    if (b.url && b.stack!.length === 0) {
      const enrichment = await tryAutoEnrichStack(b.url);
      if (enrichment) {
        db.prepare("UPDATE vacancies SET stack=?,level=?,fit=? WHERE id=?").run(
          JSON.stringify(enrichment.techs),
          enrichment.level || b.level!,
          enrichment.fit,
          id,
        );
      }
    }
    const row = db.prepare("SELECT * FROM vacancies WHERE id=?").get(id) as unknown as VacancyRow;
    res.status(201).json(withStack(row));
  }),
);
r.put(
  "/vacancies/:id",
  asyncHandler(async (req, res) => {
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
    // Автозбагачення: URL щойно з'явився/змінився і в цьому ж запиті стек не редагували
    // вручну — стягнути свіжий стек/рівень/fit із посилання (best-effort, будь-який публічний
    // https-хост).
    if (patch.url !== undefined && patch.url !== cur.url && patch.stack === undefined && m.url) {
      const enrichment = await tryAutoEnrichStack(m.url);
      if (enrichment) {
        m.stack = enrichment.techs;
        if (patch.level === undefined) m.level = enrichment.level || m.level;
        if (patch.fit === undefined) m.fit = enrichment.fit;
      }
    }
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
    // Історія статусів — журналюємо лише реальну зміну (не кожен PUT: більшість оновлень
    // редагують інші поля, напр. нотатки чи дату наступного кроку, без зміни статусу).
    if (m.status !== cur.status) recordStatusChange(Number(id), m.status);
    res.json(withStack(db.prepare("SELECT * FROM vacancies WHERE id=?").get(id) as unknown as VacancyRow));
  }),
);
r.delete("/vacancies/:id", (req, res) => {
  const id = String(req.params.id);
  const info = db.prepare("DELETE FROM vacancies WHERE id=?").run(id);
  deleteHistoryForVacancy(Number(id));
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

// імпорт вакансій з DOU-експорту (HTML/текст) — витягуємо посилання й одразу автозбагачуємо
// стек кожної нової вакансії з її сторінки (best-effort, з ввічливою паузою між запитами —
// як у /vacancies/fetch-all), тож окремий ручний клік "Спарсити всі" після імпорту не потрібен.
r.post(
  "/vacancies/import",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const html = parseText(req.body, "html", { min: 1, max: 500000 });
    const re = /https:\/\/jobs\.dou\.ua\/companies\/([^/"'\s]+)\/vacancies\/(\d+)/g;
    const seen = new Set<string>();
    const newIds: { id: number; url: string }[] = [];
    const added: { company: string; url: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(html))) {
      const dupId = match[2] ?? "";
      if (!dupId || seen.has(dupId)) continue;
      seen.add(dupId);
      const url = (match[0] ?? "") + "/";
      const company = (match[1] ?? "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      if (db.prepare("SELECT id FROM vacancies WHERE url=?").get(url)) continue;
      const info = db
        .prepare("INSERT INTO vacancies (company,position,url,status) VALUES (?,?,?,?)")
        .run(company, "(імпортовано)", url, "Хочу подати");
      const id = Number(info.lastInsertRowid);
      recordStatusChange(id, "Хочу подати");
      newIds.push({ id, url });
      added.push({ company, url });
    }
    for (const { id, url } of newIds) {
      const enrichment = await tryAutoEnrichStack(url);
      if (enrichment) {
        db.prepare("UPDATE vacancies SET stack=?,level=?,fit=? WHERE id=?").run(
          JSON.stringify(enrichment.techs),
          enrichment.level || "",
          enrichment.fit,
          id,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 400)); // ввічлива пауза
    }
    res.json({ added: added.length, items: added });
  }),
);

// ---------- імпорт/експорт у форматі зовнішнього трекера (напр. job-tracker.json) ----------
// Формат: масив {company, pos, level, fit, status, applied, next, notes, url} — сумісний із
// файлом, який користувач сам веде поза застосунком (напр. інший AI-чат/таблиця), щоб можна
// було "скинути" оновлений файл і синхронізувати дані без ручного передрукування.
function upsertJsonVacancy(item: JsonVacancyItem): { result: "added" | "updated"; id: number } {
  let existing = item.url
    ? (db.prepare("SELECT * FROM vacancies WHERE url=?").get(item.url) as unknown as VacancyRow | undefined)
    : undefined;
  if (!existing && item.company && item.position) {
    existing = db
      .prepare("SELECT * FROM vacancies WHERE lower(company)=lower(?) AND lower(position)=lower(?)")
      .get(item.company, item.position) as unknown as VacancyRow | undefined;
  }
  if (existing) {
    db.prepare("UPDATE vacancies SET company=?,position=?,level=?,url=?,status=?,fit=?,applied=?,next=?,notes=? WHERE id=?").run(
      item.company,
      item.position,
      item.level,
      item.url,
      item.status,
      item.fit,
      item.applied,
      item.next,
      item.notes,
      existing.id,
    );
    if (item.status !== existing.status) recordStatusChange(existing.id, item.status);
    return { result: "updated", id: existing.id };
  }
  const info = db
    .prepare("INSERT INTO vacancies (company,position,level,url,status,fit,applied,next,notes,stack) VALUES (?,?,?,?,?,?,?,?,?,'[]')")
    .run(item.company, item.position, item.level, item.url, item.status, item.fit, item.applied, item.next, item.notes);
  const id = Number(info.lastInsertRowid);
  recordStatusChange(id, item.status);
  return { result: "added", id };
}

r.post(
  "/vacancies/import-json",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const body = req.body as unknown;
    const items = Array.isArray(body)
      ? body
      : Array.isArray((body as { items?: unknown })?.items)
        ? (body as { items: unknown[] }).items
        : null;
    if (!items) throw new HttpError(400, "Очікується масив вакансій (або {items:[...]})");
    if (items.length > 1000) throw new HttpError(400, "Забагато елементів за один імпорт (максимум 1000)");
    let added = 0;
    let updated = 0;
    const errors: { index: number; message: string }[] = [];
    for (const [index, raw] of items.entries()) {
      try {
        const item = parseJsonVacancyItem(raw);
        const { result, id } = upsertJsonVacancy(item);
        if (result === "added") added++;
        else updated++;
        // Автозбагачення лише для НОВИХ вакансій із посиланням: формат job-tracker.json не
        // містить stack, а для вже наявних (updated) не чіпаємо стек при кожній ресинхронізації,
        // щоб не перезаписувати те, що, можливо, вже уточнили вручну в застосунку.
        if (result === "added" && item.url) {
          const enrichment = await tryAutoEnrichStack(item.url);
          if (enrichment) {
            db.prepare("UPDATE vacancies SET stack=?,level=?,fit=? WHERE id=?").run(
              JSON.stringify(enrichment.techs),
              enrichment.level || item.level,
              enrichment.fit,
              id,
            );
          }
        }
      } catch (e) {
        errors.push({ index, message: e instanceof HttpError ? e.message : "Невідома помилка" });
      }
    }
    res.json({ added, updated, skipped: errors.length, errors });
  }),
);

r.get("/vacancies/export", (_req, res) => {
  const rows = db.prepare("SELECT * FROM vacancies ORDER BY id DESC").all() as unknown as VacancyRow[];
  const items = rows.map((v) => ({
    company: v.company,
    pos: v.position,
    level: v.level,
    fit: v.fit,
    status: v.status,
    applied: v.applied,
    next: v.next,
    notes: v.notes,
    url: v.url,
  }));
  res.setHeader("Content-Disposition", 'attachment; filename="job-tracker.json"');
  res.json(items);
});

export default r;
