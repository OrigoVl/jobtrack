// AI-drafted networking message for a tracked contact — mirrors writing/writing.routes.ts's
// cover letter almost exactly (candidate profile + context -> a short, personalized message),
// just aimed at a contact (recruiter/hiring manager/referral) instead of a job posting. Same
// offline-fallback shape as every other AI feature in this app.
import { z } from "zod";
import { chatJson, llmAvailable } from "../../llm/index.js";
import type { UserId } from "../../db/user-id.js";
import type { Profile } from "../../db/types.js";
import type { Contact } from "./contacts.repo.js";

export type OutreachKind = "intro" | "followup";

const OutreachMessageSchema = z.object({ message: z.string().min(1).max(1500) });

export interface OutreachContext {
  companyName?: string;
  vacancyPosition?: string;
}

export interface OutreachResult {
  message: string;
  offline: boolean;
}

/** Templated, deterministic — no LLM required. Same shape as writing.routes.ts's own offline
 * cover letter fallback and cv-linkedin.service.ts's offlineLinkedInOptimize. */
function offlineOutreachMessage(contact: Contact, kind: OutreachKind, ctx: OutreachContext): string {
  const first = (contact.name.split(" ")[0] || contact.name).trim();
  if (kind === "followup") {
    return (
      `Hi ${first},\n\nJust wanted to follow up on my earlier message${ctx.companyName ? ` about ${ctx.companyName}` : ""} — ` +
      `I'm still very interested and would love to hear any update when you have a moment.\n\n` +
      `Thanks, and looking forward to connecting.`
    );
  }
  return (
    `Hi ${first},\n\nI came across your profile${ctx.companyName ? ` at ${ctx.companyName}` : ""} and wanted to reach out` +
    `${ctx.vacancyPosition ? ` about the ${ctx.vacancyPosition} role` : ""}. I'd love to learn more and share a bit about ` +
    `my background if that's of interest.\n\nBest regards`
  );
}

export async function draftOutreachMessage(
  userId: UserId,
  profile: Profile,
  contact: Contact,
  kind: OutreachKind,
  ctx: OutreachContext = {},
): Promise<OutreachResult> {
  if (!llmAvailable()) return { message: offlineOutreachMessage(contact, kind, ctx), offline: true };
  const instruction =
    kind === "followup"
      ? "Write a brief, polite follow-up message to someone who hasn't replied yet — no guilt-tripping, just a light nudge and a reaffirmation of interest."
      : "Write a brief, warm first-outreach message introducing the candidate and their interest.";
  const out = await chatJson(
    userId,
    "You write short, professional networking messages (LinkedIn/email style) for a job candidate. To the point, no cliches, 3-5 sentences. Don't invent facts not given below.",
    `Candidate skills: ${profile.skills.join(", ") || "—"}.\n` +
      `Candidate CV excerpt: ${(profile.cvText || "").slice(0, 2000)}\n\n` +
      `Contact: ${contact.name}${contact.role ? `, ${contact.role}` : ""}${ctx.companyName ? ` at ${ctx.companyName}` : ""}.\n` +
      `${contact.notes ? `Notes about this contact/relationship: ${contact.notes}\n` : ""}` +
      `${ctx.vacancyPosition ? `Vacancy of interest: ${ctx.vacancyPosition}\n` : ""}` +
      `${instruction}\n` +
      `Format strictly: {"message":"..."}`,
    OutreachMessageSchema,
    // No cache: like writing.routes.ts's cover letter, "regenerate" for this feature just means
    // clicking the same button again — caching would silently return the same text every time
    // despite the deliberately high temperature.
    { maxTokens: 400, temperature: 0.7, tier: "fast", feature: "contact-outreach" },
  );
  if (!out) return { message: offlineOutreachMessage(contact, kind, ctx), offline: true };
  return { message: out.message, offline: false };
}
