import express from "express";
import { getProfile, recordStatusChange } from "../../db/index.js";
import { extractLevel } from "../../shared/tech-dict.js";
import { extractSkills } from "../../shared/skill-extraction.js";
import { demandMap } from "../../shared/demand.js";
import { embeddingsAvailable, semanticSimilarity } from "../../llm/embeddings.js";
import { chat, llmAvailable } from "../../llm/index.js";
import { HttpError, authed } from "../../core/http.js";
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
import {
  listVacancies,
  getVacancy,
  findVacancyByUrl,
  findVacancyByCompanyPosition,
  createVacancy,
  createVacancyMinimal,
  createVacancyFromJson,
  updateVacancy,
  updateVacancyFromJson,
  updateVacancyEnrichment,
  deleteVacancy,
  listVacanciesWithUrl,
} from "./vacancies.repo.js";
import type { UserId } from "../../db/user-id.js";

const r = express.Router();

// ---------- vacancies ----------
// Without ?limit/?offset — the full list (current behavior, needed by the Kanban board for grouping
// by status). With ?limit — a bounded page, in case the list grows.
r.get(
  "/vacancies",
  authed(async (userId, req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const rows = await listVacancies(userId, limit != null ? { limit, offset } : undefined);
    res.json(rows);
  }),
);
r.post(
  "/vacancies",
  authed(async (userId, req, res) => {
    const b = parseVacancyInput(req.body, { partial: false });
    const id = await createVacancy(userId, {
      company: b.company!,
      position: b.position!,
      level: b.level!,
      url: b.url!,
      status: b.status!,
      fit: b.fit!,
      applied: b.applied!,
      next: b.next!,
      notes: b.notes!,
      stack: b.stack!,
    });
    await recordStatusChange(userId, id, b.status!);
    // Auto-enrichment: if a vacancy is added right away with a URL and no explicit stack — try
    // pulling the stack/level/fit from the vacancy text (any public https host, best-effort —
    // see tryAutoEnrichStack).
    if (b.url && b.stack!.length === 0) {
      const enrichment = await tryAutoEnrichStack(userId, b.url);
      if (enrichment) {
        await updateVacancyEnrichment(userId, id, { stack: enrichment.techs, level: enrichment.level || b.level!, fit: enrichment.fit });
      }
    }
    const row = await getVacancy(userId, id);
    res.status(201).json(row!);
  }),
);
r.put(
  "/vacancies/:id",
  authed(async (userId, req, res) => {
    // Express 5: req.params.* is typed as string | string[] (repeated path segments),
    // though for "/:id" the runtime always returns a string.
    const id = String(req.params.id);
    const cur = await getVacancy(userId, id);
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
      stack: patch.stack ?? cur.stack,
    };
    // Auto-enrichment: the URL just appeared/changed and this same request didn't manually
    // edit the stack — pull a fresh stack/level/fit from the link (best-effort, any public
    // https host).
    if (patch.url !== undefined && patch.url !== cur.url && patch.stack === undefined && m.url) {
      const enrichment = await tryAutoEnrichStack(userId, m.url);
      if (enrichment) {
        m.stack = enrichment.techs;
        if (patch.level === undefined) m.level = enrichment.level || m.level;
        if (patch.fit === undefined) m.fit = enrichment.fit;
      }
    }
    await updateVacancy(userId, id, m);
    // Status history — we only log an actual change (not every PUT: most updates
    // edit other fields, e.g. notes or the next-step date, without changing the status).
    if (m.status !== cur.status) await recordStatusChange(userId, Number(id), m.status);
    res.json((await getVacancy(userId, id))!);
  }),
);
r.delete(
  "/vacancies/:id",
  authed(async (userId, req, res) => {
    const id = String(req.params.id);
    // No separate history cleanup: vacancy_status_history has a real FK to vacancies with ON
    // DELETE CASCADE (see db/schema/app.ts) — deleting the vacancy row removes its history too.
    const deleted = await deleteVacancy(userId, id);
    res.json({ ok: true, deleted });
  }),
);

// parse ONE vacancy by its URL and update the stack
r.post(
  "/vacancies/:id/fetch",
  aiLimiter,
  authed(async (userId, req, res) => {
    const id = String(req.params.id);
    const v = await getVacancy(userId, id);
    if (!v) throw new HttpError(404, "Vacancy not found");
    if (!v.url) throw new HttpError(400, "This vacancy has no URL");
    const text = await fetchVacancyText(v.url);
    const a = await quickAnalyze(userId, text);
    await updateVacancyEnrichment(userId, v.id, { stack: a.techs, level: a.level || v.level, fit: a.fit });
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
  authed(async (_userId, req, res) => {
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
  authed(async (userId, _req, res) => {
    const rows = await listVacanciesWithUrl(userId);
    const results: Array<{ id: number; company: string; techs?: string[]; level?: string; fit?: Fit; error?: string }> = [];
    for (const v of rows) {
      try {
        const text = await fetchVacancyText(v.url);
        if (text.length < 200) {
          results.push({ id: v.id, company: v.company, error: "empty/unavailable" });
          continue;
        }
        const a = await quickAnalyze(userId, text);
        await updateVacancyEnrichment(userId, v.id, { stack: a.techs, level: a.level || v.level, fit: a.fit });
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
  authed(async (userId, req, res) => {
    const text = parseText(req.body, "text");
    const profile = await getProfile(userId);
    // extractSkills (stack extraction), summary (a text-based fit assessment), and semanticFit
    // (embeddings similarity between CV↔vacancy) are three independent calls over the same text; none
    // needs the others' result — run in parallel.
    const [techs, summary, semanticFit] = await Promise.all([
      extractSkills(userId, text),
      llmAvailable()
        ? chat(
            userId,
            "You are a recruiter. Be concise, in English.",
            `Here is the vacancy text. List 5-8 key requirements as one list, and in 1 sentence assess whether a candidate with these skills fits: ${profile.skills.join(", ")}.\n\n${text.slice(0, 4000)}`,
            { maxTokens: 500, cache: true },
          )
        : Promise.resolve(null),
      embeddingsAvailable() && profile.cvText ? semanticSimilarity(userId, text, profile.cvText) : Promise.resolve(null),
    ]);
    const level = extractLevel(text);
    const gap = techs.filter((t) => !profile.skills.includes(t));
    const match = techs.filter((t) => profile.skills.includes(t));
    res.json({ techs, level, gap, match, summary, fit: computeFit(match, gap, await demandMap(userId)), semanticFit });
  }),
);

// Import vacancies from a DOU export (HTML/text) — extract links and immediately auto-enrich
// the stack of each new vacancy from its page (best-effort, with a polite pause between requests —
// as in /vacancies/fetch-all), so a separate manual "Analyze all" click after import isn't needed.
r.post(
  "/vacancies/import",
  aiLimiter,
  authed(async (userId, req, res) => {
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
      if (await findVacancyByUrl(userId, url)) continue;
      const id = await createVacancyMinimal(userId, { company, position: "(imported)", url, status: "Want to apply" });
      await recordStatusChange(userId, id, "Want to apply");
      newIds.push({ id, url });
      added.push({ company, url });
    }
    for (const { id, url } of newIds) {
      const enrichment = await tryAutoEnrichStack(userId, url);
      if (enrichment) {
        await updateVacancyEnrichment(userId, id, { stack: enrichment.techs, level: enrichment.level || "", fit: enrichment.fit });
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
async function upsertJsonVacancy(userId: UserId, item: JsonVacancyItem): Promise<{ result: "added" | "updated"; id: number }> {
  let existing = item.url ? await findVacancyByUrl(userId, item.url) : undefined;
  if (!existing && item.company && item.position) {
    existing = await findVacancyByCompanyPosition(userId, item.company, item.position);
  }
  if (existing) {
    await updateVacancyFromJson(userId, existing.id, item);
    if (item.status !== existing.status) await recordStatusChange(userId, existing.id, item.status);
    return { result: "updated", id: existing.id };
  }
  const id = await createVacancyFromJson(userId, item);
  await recordStatusChange(userId, id, item.status);
  return { result: "added", id };
}

r.post(
  "/vacancies/import-json",
  aiLimiter,
  authed(async (userId, req, res) => {
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
        const { result, id } = await upsertJsonVacancy(userId, item);
        if (result === "added") added++;
        else updated++;
        // Auto-enrichment only for NEW vacancies with a link: the job-tracker.json format
        // doesn't include a stack, and for existing ones (updated) we don't touch the stack on
        // every resync, so we don't overwrite something that may have already been fine-tuned
        // manually in the app.
        if (result === "added" && item.url) {
          const enrichment = await tryAutoEnrichStack(userId, item.url);
          if (enrichment) {
            await updateVacancyEnrichment(userId, id, {
              stack: enrichment.techs,
              level: enrichment.level || item.level,
              fit: enrichment.fit,
            });
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

r.get(
  "/vacancies/export",
  authed(async (userId, _req, res) => {
    const rows = await listVacancies(userId);
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
  }),
);

export default r;
