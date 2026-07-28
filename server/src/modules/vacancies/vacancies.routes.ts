import express from "express";
import db, { getProfile, recordStatusChange, deleteHistoryForVacancy, type VacancyRow, j, withStack } from "../../db/index.js";
import { extractLevel } from "../../shared/tech-dict.js";
import { extractSkills } from "../../shared/skill-extraction.js";
import { demandMap } from "../../shared/demand.js";
import { embeddingsAvailable, semanticSimilarity } from "../../llm/embeddings.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { HttpError, asyncHandler } from "../../core/http.js";
import { contextLogger } from "../../core/logger.js";
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
// Without ?limit/?offset — the full list (current behavior, needed by the Kanban board for grouping
// by status). With ?limit — a bounded page, in case the list grows.
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
    // Auto-enrichment: if a vacancy is added right away with a URL and no explicit stack — try
    // pulling the stack/level/fit from the vacancy text (any public https host, best-effort —
    // see tryAutoEnrichStack).
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
    // Express 5: req.params.* is typed as string | string[] (repeated path segments),
    // though for "/:id" the runtime always returns a string.
    const id = String(req.params.id);
    const cur = db.prepare("SELECT * FROM vacancies WHERE id=?").get(id) as unknown as VacancyRow | undefined;
    if (!cur) throw new HttpError(404, "Vacancy not found");
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
    // Auto-enrichment: the URL just appeared/changed and this same request didn't manually
    // edit the stack — pull a fresh stack/level/fit from the link (best-effort, any public
    // https host).
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
    // Status history — we only log an actual change (not every PUT: most updates
    // edit other fields, e.g. notes or the next-step date, without changing the status).
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

// parse ONE vacancy by its URL and update the stack
r.post(
  "/vacancies/:id/fetch",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const v = db.prepare("SELECT * FROM vacancies WHERE id=?").get(id) as unknown as VacancyRow | undefined;
    if (!v) throw new HttpError(404, "Vacancy not found");
    if (!v.url) throw new HttpError(400, "This vacancy has no URL");
    const text = await fetchVacancyText(v.url);
    const a = await quickAnalyze(text);
    db.prepare("UPDATE vacancies SET stack=?,level=?,fit=? WHERE id=?").run(JSON.stringify(a.techs), a.level || v.level, a.fit, v.id);
    res.json({ id: v.id, ...a });
  }),
);

// fetch the "raw" text of a vacancy page from any URL, without tying it to a saved
// vacancy (for forms where the user just wants to paste a URL and get the text — e.g. a cover letter).
// Unlike tryAutoEnrichStack (best-effort, never throws), here we throw a real error:
// the user is explicitly waiting for the result of a specific action, so a "silent null" would only confuse them.
r.post(
  "/vacancies/fetch-url",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const url = parseText(req.body, "url", { min: 5, max: 2000 });
    const text = await fetchVacancyText(url);
    if (text.length < 50) throw new HttpError(422, "Could not extract text from the page (it may be empty or protected against scraping).");
    res.json({ text: text.slice(0, 8000) });
  }),
);

// parse ALL vacancies that have a URL
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
          results.push({ id: v.id, company: v.company, error: "empty/unavailable" });
          continue;
        }
        const a = await quickAnalyze(text);
        db.prepare("UPDATE vacancies SET stack=?,level=?,fit=? WHERE id=?").run(JSON.stringify(a.techs), a.level || v.level, a.fit, v.id);
        results.push({ id: v.id, company: v.company, techs: a.techs, level: a.level, fit: a.fit });
      } catch (e) {
        results.push({ id: v.id, company: v.company, error: (e as Error).message });
      }
      await new Promise((resolve) => setTimeout(resolve, 400)); // polite pause
    }
    const failed = results.filter((r) => r.error).length;
    // The user only sees errors per individual vacancy in results; an aggregate log is needed to
    // notice a systemic problem (e.g. a source started blocking scraping en masse),
    // rather than guessing from individual rows in the UI.
    if (failed > 0) contextLogger().warn({ processed: results.length, failed }, "Bulk vacancy re-parse: some URLs failed");
    res.json({ processed: results.length, results });
  }),
);

// analysis of vacancy text (offline dictionary + optionally LLM)
r.post(
  "/vacancies/analyze",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const text = parseText(req.body, "text");
    const profile = getProfile();
    // extractSkills (stack extraction), summary (a text-based fit assessment), and semanticFit
    // (embeddings similarity between CV↔vacancy) are three independent calls over the same text; none
    // needs the others' result — run in parallel.
    const [techs, summary, semanticFit] = await Promise.all([
      extractSkills(text),
      llmAvailable()
        ? chat(
            "You are a recruiter. Be concise, in English.",
            `Here is the vacancy text. List 5-8 key requirements as one list, and in 1 sentence assess whether a candidate with these skills fits: ${profile.skills.join(", ")}.\n\n${text.slice(0, 4000)}`,
            { maxTokens: 500, cache: true },
          )
        : Promise.resolve(null),
      embeddingsAvailable() && profile.cvText ? semanticSimilarity(text, profile.cvText) : Promise.resolve(null),
    ]);
    const level = extractLevel(text);
    const gap = techs.filter((t) => !profile.skills.includes(t));
    const match = techs.filter((t) => profile.skills.includes(t));
    res.json({ techs, level, gap, match, summary, fit: computeFit(match, gap, demandMap()), semanticFit });
  }),
);

// Import vacancies from a DOU export (HTML/text) — extract links and immediately auto-enrich
// the stack of each new vacancy from its page (best-effort, with a polite pause between requests —
// as in /vacancies/fetch-all), so a separate manual "Analyze all" click after import isn't needed.
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
        .run(company, "(imported)", url, "Want to apply");
      const id = Number(info.lastInsertRowid);
      recordStatusChange(id, "Want to apply");
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
      await new Promise((resolve) => setTimeout(resolve, 400)); // polite pause
    }
    res.json({ added: added.length, items: added });
  }),
);

// ---------- import/export in an external tracker's format (e.g. job-tracker.json) ----------
// Format: an array of {company, pos, level, fit, status, applied, next, notes, url} — compatible
// with a file the user maintains themselves outside the app (e.g. another AI chat/spreadsheet),
// so they can "drop" the updated file and sync data without manually retyping it.
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
    if (!items) throw new HttpError(400, "Expected an array of vacancies (or {items:[...]})");
    if (items.length > 1000) throw new HttpError(400, "Too many items in one import (max 1000)");
    let added = 0;
    let updated = 0;
    const errors: { index: number; message: string }[] = [];
    for (const [index, raw] of items.entries()) {
      try {
        const item = parseJsonVacancyItem(raw);
        const { result, id } = upsertJsonVacancy(item);
        if (result === "added") added++;
        else updated++;
        // Auto-enrichment only for NEW vacancies with a link: the job-tracker.json format
        // doesn't include a stack, and for existing ones (updated) we don't touch the stack on
        // every resync, so we don't overwrite something that may have already been fine-tuned
        // manually in the app.
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
        errors.push({ index, message: e instanceof HttpError ? e.message : "Unknown error" });
      }
    }
    if (errors.length > 0) {
      contextLogger().warn({ total: items.length, added, updated, failed: errors.length }, "JSON vacancy import: some items failed");
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
