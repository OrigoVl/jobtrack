// What the bot does with an INCOMING message. Split out of telegram.routes.ts for the reason every
// other module here splits routes from services: the route stays a thin "parse the update, hand it
// over, always 200", and this is the part worth testing without Express.
//
// Every function takes an explicit `userId: UserId` that the route resolved from the chat id via
// telegram.repo.ts#getUserIdByChatId. That lookup is this module's ONLY authentication: a chat that
// isn't in `telegram_links` gets no userId, and therefore reaches none of this. It's a deliberately
// different seam from core/http.ts's authed(), because there is no HTTP session here to read — the
// binding was established once, through a one-time token the user generated while signed in.
import { recordStatusChange } from "../../db/index.js";
import { contextLogger } from "../../core/logger.js";
import type { UserId } from "../../db/user-id.js";
import { assertSafeVacancyUrl } from "../../shared/validation.js";
import { localDateIn } from "../../shared/time.js";
import {
  createVacancyMinimal,
  findVacancyByUrl,
  getVacancy,
  listVacancyReminderRows,
  updateVacancyEnrichment,
  updateVacancyImportedTitle,
  updateVacancyStatus,
} from "../vacancies/vacancies.repo.js";
import { extractTitleCompany, quickAnalyze, safeFetchVacancyText } from "../vacancies/vacancy-analysis.service.js";
import { listCalendarEvents } from "../calendar/calendar.repo.js";
import { getNotificationSettings } from "../notifications/notifications.repo.js";
import { callLine } from "../notifications/notifications.service.js";
import type { VacancyStatus } from "../../shared/validation.js";

/** What the bot should say back. Returning text instead of sending it keeps these functions pure
 * enough to test, and leaves the single "actually call the Bot API" line in the route. */
export interface CommandReply {
  text: string;
  /** A vacancy the reply is about — the route hangs the quick-action keyboard off it. */
  vacancyId?: number;
}

export const HELP_TEXT = [
  "Zorya bot commands:",
  "",
  "/add <url> — track a vacancy from a link",
  "/today — interviews and next steps for today",
  "/help — this message",
  "",
  "You'll also get interview reminders, follow-up nudges and job alerts here.",
  "Turn individual ones off on the Account page.",
].join("\n");

/**
 * Tracks a vacancy from a pasted link — the single most useful thing the bot can accept, since
 * browsing job boards is a phone activity and the app is not.
 *
 * Reuses the exact import path the web UI's bulk import already uses (assertSafeVacancyUrl ->
 * findVacancyByUrl -> createVacancyMinimal -> recordStatusChange) rather than a second, subtly
 * different one — including the SSRF guard, which matters more here than there: this URL arrives
 * from a chat message, and assertSafeVacancyUrl is what rejects private/internal addresses.
 *
 * Enrichment is deliberately NOT awaited by the caller (see enrichInBackground below): fetching and
 * analyzing the page takes seconds, and a bot that goes quiet that long reads as broken.
 */
export async function handleAddCommand(userId: UserId, rawUrl: string): Promise<CommandReply> {
  if (!rawUrl) return { text: "Send a link with it, like:\n/add https://example.com/jobs/123" };
  let url: string;
  try {
    url = assertSafeVacancyUrl(rawUrl);
  } catch {
    return { text: "That doesn't look like a usable vacancy link (needs to be a public https:// URL)." };
  }
  const existing = await findVacancyByUrl(userId, url);
  if (existing) {
    return {
      text: `Already tracked: ${existing.position || "(untitled)"} — ${existing.company || "?"}\nStatus: ${existing.status}`,
      vacancyId: existing.id,
    };
  }
  const id = await createVacancyMinimal(userId, { company: "", position: "(imported)", url, status: "Want to apply" });
  await recordStatusChange(userId, id, "Want to apply");
  return { text: "✅ Added to your tracker. Reading the page for details…", vacancyId: id };
}

/**
 * Best-effort follow-up for handleAddCommand: fills in stack/level/fit and the real title, exactly
 * as the web import's own post-processing loop does. Returns a message worth sending, or null when
 * nothing was learned (offline LLM, an unreadable page) — the bot stays silent rather than
 * announcing a non-result.
 */
export async function enrichAddedVacancy(userId: UserId, vacancyId: number): Promise<string | null> {
  const vacancy = await getVacancy(userId, vacancyId);
  if (!vacancy?.url) return null;
  const text = await safeFetchVacancyText(vacancy.url);
  if (!text) return null;
  const analysis = await quickAnalyze(userId, text);
  await updateVacancyEnrichment(userId, vacancyId, { stack: analysis.techs, level: analysis.level || "", fit: analysis.fit });
  const guess = await extractTitleCompany(userId, text);
  if (guess) {
    // extractTitleCompany guarantees at least ONE of company/position, not both — an empty guess
    // must never overwrite the "(imported)" placeholder with a blank, same rule as the web import.
    const title: { company?: string; position?: string } = {};
    if (guess.position) title.position = guess.position;
    if (guess.company) title.company = guess.company;
    if (title.company || title.position) await updateVacancyImportedTitle(userId, vacancyId, title);
  }
  const label = [guess?.position, guess?.company].filter(Boolean).join(" — ");
  if (!label && analysis.techs.length === 0) return null;
  return [label ? `📌 ${label}` : null, analysis.techs.length ? `Stack: ${analysis.techs.slice(0, 8).join(", ")}` : null]
    .filter(Boolean)
    .join("\n");
}

/** "What do I need to care about today" — the read-only counterpart to the push notifications, for
 * when the user wants to ask rather than wait to be told. */
export async function handleTodayCommand(userId: UserId, nowMs = Date.now()): Promise<CommandReply> {
  const { timezone } = await getNotificationSettings(userId);
  const today = localDateIn(timezone, nowMs);
  const [events, vacancyRows] = await Promise.all([
    listCalendarEvents(userId, { from: new Date(nowMs).toISOString(), to: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString() }),
    listVacancyReminderRows(userId),
  ]);
  const nextSteps = vacancyRows.filter((v) => v.next === today);
  if (events.length === 0 && nextSteps.length === 0) return { text: "Nothing scheduled for today. 🎉" };
  const lines = [
    // The call link goes on its own line under the event, not appended to it: Telegram auto-links
    // a bare URL in plain text, and a URL sitting mid-sentence after an em dash is far harder to
    // hit with a thumb than one that owns its line.
    ...events
      .flatMap((e) => [`• ${e.title || "(untitled)"} — ${formatLocalTime(e.startAt, timezone)}`, callLine(e.meetingUrl)])
      .filter(Boolean),
    ...nextSteps.map((v) => `• Next step: ${[v.position, v.company].filter(Boolean).join(" — ") || "(untitled)"}`),
  ];
  return { text: ["Today:", ...lines].join("\n") };
}

/** Renders an instant in the user's own zone — the timezone is already loaded here for the date
 * comparison, and showing "14:00 UTC" to someone who thinks in local time is the kind of detail
 * that makes a reminder actively misleading. Falls back to the raw instant if Intl rejects the
 * stored zone, rather than throwing inside a bot reply. */
function formatLocalTime(startAt: string, timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timeZone || "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
      new Date(startAt),
    );
  } catch {
    return startAt;
  }
}

/**
 * Applies an inline button tap. Goes through recordStatusChange (the single write point every
 * status change in the app already funnels through) rather than a bare column update, so the
 * status history and the apply-streak stay correct whether a status was changed from the web UI or
 * from a phone.
 */
export async function applyStatusChange(userId: UserId, vacancyId: number, status: VacancyStatus): Promise<string> {
  // Scoped read first: getVacancy takes the userId, so a forged callback naming someone else's
  // vacancy id resolves to nothing here rather than updating a row across the tenancy boundary.
  const vacancy = await getVacancy(userId, vacancyId);
  if (!vacancy) return "That vacancy is gone.";
  if (vacancy.status === status) return `Already ${status}.`;
  await updateVacancyStatus(userId, vacancyId, status);
  await recordStatusChange(userId, vacancyId, status);
  return `Status → ${status}`;
}

/** Dispatches a plain text message. `/start` is handled by the route itself (it's the one command
 * that works BEFORE a link exists), so it never reaches here. */
export async function handleCommand(userId: UserId, text: string): Promise<CommandReply> {
  const trimmed = text.trim();
  // Telegram appends "@botname" to commands in group chats; harmless here but cheap to tolerate.
  const [rawCommand = "", ...rest] = trimmed.split(/\s+/);
  const command = rawCommand.split("@")[0]!.toLowerCase();
  const argument = rest.join(" ");
  try {
    switch (command) {
      case "/add":
        return await handleAddCommand(userId, argument);
      case "/today":
        return await handleTodayCommand(userId);
      case "/help":
      case "/start":
        return { text: HELP_TEXT };
      default:
        // A bare URL with no command at all is the obvious thing a user will try — treat it as
        // /add rather than answering with a help message they didn't ask for.
        if (/^https?:\/\//i.test(trimmed)) return await handleAddCommand(userId, trimmed);
        return { text: `Unknown command.\n\n${HELP_TEXT}` };
    }
  } catch (err) {
    // The webhook must answer 200 regardless (Telegram retries otherwise), so a failure has to
    // become a reply rather than a throw.
    contextLogger().error({ err, userId, command }, "Telegram command failed");
    return { text: "Something went wrong handling that. Try again in a moment." };
  }
}
