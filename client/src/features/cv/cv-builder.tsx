import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useConfirm } from "../../shared/use-confirm";
import {
  useApplyCvUpload,
  useCreateCvProfile,
  useCvProfiles,
  useCvReviewJobStatus,
  useDeleteCvProfile,
  useDuplicateCvProfile,
  useProfile,
  useRenameCvProfile,
  useStartCvReviewJob,
  useVacancies,
} from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Dropdown, PageHeader, Section, Segmented, Select, Spinner } from "../../shared/ui";
import { SkillsInput } from "../../shared/view-kit";
import type { CvDoc, CvExperience, CvMatch, CvPreset, CvReview, CvTailorResult, CvTheme, Vacancy } from "../../shared/types";
import { DEFAULT_ORDER, cvDocToText, exportCvDoc, themeOf } from "./builder/cv-doc-utils";
import { GeneralSection } from "./builder/basic-info-card";
import type { SummaryStyle } from "./builder/basic-info-card";
import { ExperienceCard } from "./builder/experience-card";
import {
  AwardsSection,
  CertificationsSection,
  EducationSection,
  LanguagesSection,
  ProjectsSection,
  PublicationsSection,
  ReferencesSection,
  VolunteerSection,
} from "./builder/extra-sections-cards";
import { AppearancePanel } from "./builder/appearance-panel";
import { LayoutPresetsPanel } from "./builder/layout-presets-panel";
import { CvPreviewPanel } from "./builder/cv-preview-panel";
import { ResumeCompleteness } from "./builder/resume-completeness";
import { ShareLinkCard } from "./builder/share-link-card";
import { ReportsPanel } from "./builder/reports-panel";
import { CvReviewProgress } from "./builder/cv-review-progress";
import { ProfileSwitcher } from "./builder/profile-switcher";

// Only CONTENT sections — "what's in the CV". Appearance/layout is deliberately NOT one of these
// (see `editorMode` below): choosing a template or reordering blocks is a different job from
// typing your work history, so it lives one level up as its own editor mode rather than as a
// thirteenth peer accordion at the bottom of the content list.
type SectionKey =
  | "general"
  | "experience"
  | "skills"
  | "projects"
  | "education"
  | "certifications"
  | "awards"
  | "publications"
  | "volunteer"
  | "languages"
  | "references";

/** Which half of the editor column is showing: the content sections, or the appearance/layout
 * controls. Two clearly separate jobs, so they're a mode switch rather than neighbours in one list. */
type EditorMode = "content" | "design";

/** The content sections most CVs legitimately never fill in — folded behind one "additional
 * sections" disclosure so the primary list stays short and every row in it is one the user is
 * actually expected to act on. Typed as `CvDoc` keys so the "does this CV use any of them"
 * check below can index the doc directly. */
const EXTRA_SECTIONS = ["awards", "publications", "volunteer", "references"] as const satisfies readonly (keyof CvDoc & SectionKey)[];
const EXTRA_SECTION_KEYS = new Set<SectionKey>(EXTRA_SECTIONS);

// Mirrors the server's cv-profiles.service.ts#MAX_CV_PROFILES — this constant is UI-only (disables
// the "+" tab button and shows a tooltip); the server remains the actual source of truth and
// returns its own CV_PROFILE_LIMIT error if the two ever drift out of sync.
const MAX_CV_PROFILES = 5;

// Shared by "Compare" and "Tailor" (both need the same vacancy → plain-text job description) —
// same fields already shown in the tracker table (stack/notes), assembled into one block.
function vacancyJobText(vac: Vacancy): string {
  return [vac.stack.length ? `Stack: ${vac.stack.join(", ")}` : "", vac.notes].filter(Boolean).join("\n") || vac.position;
}
function vacancyLabel(vac: Vacancy): string {
  return `${vac.position}${vac.company ? ` @ ${vac.company}` : ""}`;
}

/* ---------- CV Builder ---------- */
export function CvBuilder({ llm }: { llm: boolean }) {
  const { t } = useTranslation(["cv", "common"]);
  const { data: profile } = useProfile();
  const { data: vacancies = [] } = useVacancies();
  const applyCvUpload = useApplyCvUpload();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [doc, setDoc] = useState<CvDoc | null>(null);
  const [busy, setBusy] = useState("");
  const [presets, setPresets] = useState<CvPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  // One-step undo stash for the AI "improve bullet(s)" actions — see improveBullet(s)/undoBullet(s)
  // below. Keyed by experience index (whole-entry rewrite) / `${i}-${bulletIndex}` (single bullet).
  const [bulletUndo, setBulletUndo] = useState<Record<string, { before: string; after: string }>>({});
  const [bulletsUndo, setBulletsUndo] = useState<Record<number, { before: string[]; after: string[] }>>({});
  // The CV Builder's tab strip — which of the account's (up to MAX_CV_PROFILES) named CV versions
  // is currently open. Persisted only for the SPA session (useUi, see shared/ui-state.ts), same as
  // activeSection below — a fresh page load always falls back to the first tab via the effect a
  // little further down, once useCvProfiles() resolves.
  const { data: cvProfiles } = useCvProfiles();
  const [activeProfileId, setActiveProfileId] = useUi<number | null>("cvbuilder.activeProfileId", null);
  const createProfileMutation = useCreateCvProfile();
  const duplicateProfileMutation = useDuplicateCvProfile();
  const renameProfileMutation = useRenameCvProfile();
  const deleteProfileMutation = useDeleteCvProfile();
  // Every per-tab piece of local UI state below (review dismissal, compare/tailor results, which
  // report tab is showing) is keyed by profile so switching tabs never leaks one CV's compare
  // result into another's. `0` is never a real profile id (Postgres identity starts at 1) — safe
  // as the "profiles haven't loaded yet" placeholder.
  const profileKey = activeProfileId ?? 0;
  // The review itself is no longer local state: it's derived from the backgrounded review job
  // below (useCvReviewJobStatus) so it survives navigating away from CV Builder while the AI call
  // is still running. `reviewDismissedAt` hides a completed review the user explicitly closed —
  // keyed by finishedAt (not a plain boolean) so a NEW job's result isn't hidden by an old dismissal.
  const [reviewDismissedAt, setReviewDismissedAt] = useUi<string | null>(`cvbuilder.reviewDismissedAt:${profileKey}`, null);
  const startReviewJob = useStartCvReviewJob();
  const { data: reviewJob } = useCvReviewJobStatus();
  const reviewRunning = reviewJob?.status === "running";
  const review: CvReview | null =
    reviewJob?.status === "done" && reviewJob.result && reviewJob.finishedAt !== reviewDismissedAt ? reviewJob.result : null;
  // ReportsPanel only ever calls this with `null` (its "hide" action) — there's no separate "set a
  // review value" case now that the value itself is derived from the job above.
  const setReview = (v: CvReview | null) => setReviewDismissedAt(v === null ? (reviewJob?.finishedAt ?? "dismissed") : null);
  const [match, setMatch] = useUi<CvMatch | null>(`cvbuilder.match:${profileKey}`, null);
  const [matchVacId, setMatchVacId] = useUi<number>(`cvbuilder.matchVac:${profileKey}`, 0);
  // Own busy flag for match (not the shared `busy` string below) — otherwise starting one while
  // another is still in flight steals its loading spinner via the shared variable. `activeReport`
  // picks which report shows in the single reports card below, so generating a second one is a
  // tab switch, not a re-stack that shoves the first one off-screen (which looked like it "closed"
  // when both were rendered as separate, independently-ordered blocks).
  const [busyMatch, setBusyMatch] = useState(false);
  const [busyTailor, setBusyTailor] = useState(false);
  // Result of "Tailor CV" (POST /cv/tailor): the candidate's own skills/bullets reordered by
  // relevance to the selected vacancy + a rewritten summary when the LLM produced one. Kept
  // separate from `doc` on purpose — tailoring never touches the live builder doc until the
  // user explicitly clicks "Apply to CV" in the tailor tab below, so switching vacancies to
  // compare/tailor for never risks silently overwriting what's being edited.
  const [tailored, setTailored] = useUi<CvTailorResult | null>(`cvbuilder.tailored:${profileKey}`, null);
  const [activeReport, setActiveReport] = useUi<"review" | "match" | "tailor">(`cvbuilder.activeReport:${profileKey}`, "review");
  const [dismissedSuggest, setDismissedSuggest] = useState(false);
  // Single exclusive accordion — one section open at a time, so there's never more scrolling than
  // one section's worth of fields.
  const [activeSection, setActiveSection] = useUi<SectionKey | null>("cvbuilder.activeSection", "general");
  // Content vs. appearance. Appearance used to be the last item of the accordion list above,
  // which read as "the 12th thing to fill in" even though it isn't content at all — and buried
  // template/photo/section-order behind a scroll past every content section. As a mode switch it
  // sits at the top of the editor column, next to the live preview it actually affects.
  const [editorMode, setEditorMode] = useUi<EditorMode>("cvbuilder.editorMode", "content");
  // Whether the "additional sections" disclosure (awards/publications/volunteer/references) is
  // expanded. Defaults to open only when this CV already uses one of them — `useUi` re-reads its
  // `initial` on every render until the key is actually written, so this still lands correctly on
  // the render where `doc` first arrives, and the user's own toggle wins from then on.
  const [moreOpen, setMoreOpen] = useUi("cvbuilder.moreSectionsOpen", !!doc && EXTRA_SECTIONS.some((k) => (doc[k] ?? []).length > 0));
  // Drives the first-run start card in the content column (see the render below). "Empty" is
  // judged on the fields a CV can't do without — the optional sections deliberately don't count,
  // or a doc holding nothing but one award would skip the card that's meant to get it started.
  // Per-profile: adding a second CV tab starts from the same blank slate the first one did.
  const docIsEmpty =
    !!doc &&
    !doc.name.trim() &&
    !doc.title.trim() &&
    !doc.summary.trim() &&
    doc.experience.length === 0 &&
    doc.skills.length === 0 &&
    doc.projects.length === 0 &&
    doc.education.length === 0;
  const [startedManually, setStartedManually] = useUi(`cvbuilder.startedManually:${profileKey}`, false);
  // Which experience entry the live preview asked to focus (click sync) — applied once by
  // ExperienceCard, not held/forced every render (see its own render-time reset guard).
  const [expFocusIndex, setExpFocusIndex] = useState<number | null>(null);
  // Tracks what's actually been persisted (a JSON snapshot, not just a boolean) so both the
  // autosave effect and the beforeunload guard below can tell "has anything changed since the
  // last successful save" without keeping a second copy of the doc around.
  const lastSavedRef = useRef("");
  const [autosaving, setAutosaving] = useState(false);
  // Mirrors `lastSavedRef` as render-visible state (a ref alone can't drive the header's status
  // line). Maintained by the autosave effect below, which already does the same comparison —
  // it's what lets the header say "all changes saved" honestly instead of only claiming it after
  // this session happened to perform a save, and lets Save go quiet when there's nothing to save.
  const [dirty, setDirty] = useState(false);
  // Falls back to the first (lowest-position) tab once the profile list loads, or if the
  // previously-active tab got deleted (in another tab of the browser, or via this tab's own
  // ProfileTabs) and no longer exists.
  useEffect(() => {
    if (cvProfiles && cvProfiles.length > 0 && !cvProfiles.some((p) => p.id === activeProfileId)) {
      setActiveProfileId(cvProfiles[0].id);
    }
  }, [cvProfiles, activeProfileId, setActiveProfileId]);
  useEffect(() => {
    if (activeProfileId == null) return;
    // Clears the previous tab's doc immediately (rather than leaving it on screen mid-fetch) —
    // the `if (!doc ...)` skeleton guard below covers this the same way it covers first load.
    setDoc(null);
    lastSavedRef.current = "";
    setBulletUndo({});
    setBulletsUndo({});
    api
      .cvDoc(activeProfileId)
      .then((d) => {
        setDoc(d);
        lastSavedRef.current = JSON.stringify(d);
      })
      .catch(() => undefined);
    api
      .cvPresets(activeProfileId)
      .then((r) => setPresets(r.presets))
      .catch(() => undefined);
  }, [activeProfileId]);
  // Debounced autosave, ~1.5s after the last edit — so a save doesn't fire on every keystroke,
  // but an accidental navigation/close moments after editing still isn't a real risk. Silent (no
  // toast) on both success and failure: this runs constantly while typing, and a toast on every
  // tick would be noise; the explicit "Зберегти" button remains the visible, toast-confirmed
  // action, and the beforeunload guard below is the actual safety net if autosave keeps failing.
  useEffect(() => {
    if (!doc || activeProfileId == null) return;
    const serialized = JSON.stringify(doc);
    if (serialized === lastSavedRef.current) {
      setDirty(false);
      return;
    }
    setDirty(true);
    const timer = setTimeout(async () => {
      setAutosaving(true);
      try {
        const saved = await api.saveCvDoc(activeProfileId, doc);
        lastSavedRef.current = JSON.stringify(saved);
        setDoc(saved);
      } catch {
        // Left unsaved — beforeunload below still guards against silently losing it.
      } finally {
        setAutosaving(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [doc, activeProfileId]);
  // Browsers show their own generic text here regardless of `returnValue`'s content — the
  // `preventDefault()`/`returnValue` pair is just what triggers the native confirmation dialog.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (doc && JSON.stringify(doc) !== lastSavedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [doc]);
  if (!doc || activeProfileId == null) return <CardsSkeleton count={2} />;
  const set = (p: Partial<CvDoc>) => setDoc({ ...doc, ...p });
  const setExp = (i: number, p: Partial<CvExperience>) =>
    set({ experience: doc.experience.map((e, idx) => (idx === i ? { ...e, ...p } : e)) });
  const theme = themeOf(doc);
  const setTheme = (p: Partial<CvTheme>) => setDoc((prev) => (prev ? { ...prev, theme: { ...themeOf(prev), ...p } } : prev));
  const sectionOrder = theme.order ?? DEFAULT_ORDER;
  const moveSection = (from: number, to: number) => {
    if (from === to || to < 0 || to >= sectionOrder.length) return;
    const arr = [...sectionOrder];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setTheme({ order: arr });
  };
  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) {
      toast(t("builder.toasts.enterPresetName"), "error");
      return;
    }
    const next = [...presets.filter((p) => p.name.toLowerCase() !== name.toLowerCase()), { name, theme }];
    setBusy("preset");
    try {
      const r = await api.saveCvPresets(activeProfileId, next);
      setPresets(r.presets);
      setPresetName("");
      toast(t("builder.toasts.presetSaved", { name }), "success");
    } finally {
      setBusy("");
    }
  };
  const applyPreset = (p: CvPreset) => {
    setTheme(p.theme);
    toast(t("builder.toasts.presetApplied", { name: p.name }), "info");
  };
  const addSkill = (k: string) => {
    if (doc.skills.some((s) => s.toLowerCase() === k.toLowerCase())) {
      toast(t("builder.toasts.skillAlreadyExists", { skill: k }), "info");
      return;
    }
    set({ skills: [...doc.skills, k] });
    toast(t("builder.toasts.skillAdded", { skill: k }), "success");
  };
  const applyRewrite = (before: string, after: string) => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/gi, " ")
        .split(/\s+/)
        .filter(Boolean);
    const b = new Set(norm(before));
    let best = { ei: -1, bi: -1, score: 0 };
    doc.experience.forEach((e, ei) =>
      e.bullets.forEach((bl, bi) => {
        const t = norm(bl);
        if (!t.length || !b.size) return;
        const overlap = t.filter((w) => b.has(w)).length / Math.max(t.length, b.size);
        if (overlap > best.score) best = { ei, bi, score: overlap };
      }),
    );
    if (best.score >= 0.3) {
      set({
        experience: doc.experience.map((e, ei) =>
          ei === best.ei ? { ...e, bullets: e.bullets.map((bl, bi) => (bi === best.bi ? after : bl)) } : e,
        ),
      });
      toast(
        t("builder.toasts.bulletUpdated", {
          entry: doc.experience[best.ei].role || t("builder.toasts.entryFallback", { n: best.ei + 1 }),
        }),
        "success",
      );
      return;
    }
    navigator.clipboard?.writeText(after).catch(() => undefined);
    toast(t("builder.toasts.bulletNotFound"), "info");
  };
  const doMatch = async () => {
    const vac = vacancies.find((v) => v.id === matchVacId);
    if (!vac) {
      toast(t("builder.toasts.selectVacancy"), "error");
      return;
    }
    setBusyMatch(true);
    try {
      const r = await api.matchVacancy(cvDocToText(doc), vacancyLabel(vac), vacancyJobText(vac));
      setMatch(r);
      setActiveReport("match");
      toast(r.offline ? t("builder.toasts.matchOffline") : t("builder.toasts.matchReady"), r.offline ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("builder.toasts.matchError"), "error");
    } finally {
      setBusyMatch(false);
    }
  };
  // Adapts the CV to the selected vacancy: reorders the candidate's own skills/experience
  // bullets by relevance (a deterministic algorithm, works offline too) and — only when the LLM
  // produced one — swaps in a tailored summary. Doesn't touch `doc` directly; the result is
  // shown in its own report tab with an explicit "Apply to CV" action (applyTailored below).
  const doTailor = async () => {
    const vac = vacancies.find((v) => v.id === matchVacId);
    if (!vac) {
      toast(t("builder.toasts.selectVacancy"), "error");
      return;
    }
    setBusyTailor(true);
    try {
      const r = await api.tailorCv(doc, vacancyLabel(vac), vacancyJobText(vac));
      setTailored(r);
      setActiveReport("tailor");
      toast(r.match.offline ? t("builder.toasts.tailorOffline") : t("builder.toasts.tailorReady"), r.match.offline ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("builder.toasts.tailorError"), "error");
    } finally {
      setBusyTailor(false);
    }
  };
  const applyTailored = () => {
    if (!tailored) return;
    setDoc(tailored.doc);
    toast(t("builder.toasts.tailorApplied"), "success");
  };
  // Runs in the background (server/src/modules/cv/cv-review-job.ts) — the completion toast/native
  // notification live in CvReviewJobNotifier (mounted once at the app shell), not here, since the
  // job may finish after the user has navigated away from CV Builder entirely.
  const doReview = () => {
    const text = cvDocToText(doc);
    if (text.trim().length < 30) {
      toast(t("builder.toasts.needMoreDetails"), "error");
      return;
    }
    setActiveReport("review");
    startReviewJob.mutate(text);
  };
  const deletePreset = async (name: string) => {
    if (!(await confirm({ title: t("layoutPresets.presets.deleteConfirmTitle", { name }), tone: "danger" }))) return;
    const next = presets.filter((p) => p.name !== name);
    const r = await api.saveCvPresets(activeProfileId, next);
    setPresets(r.presets);
  };
  const moveExp = (from: number, to: number) => {
    if (from === to || to < 0 || to >= doc.experience.length) return;
    const arr = [...doc.experience];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    set({ experience: arr });
  };
  const save = async () => {
    setBusy("save");
    try {
      const saved = await api.saveCvDoc(activeProfileId, doc);
      lastSavedRef.current = JSON.stringify(saved);
      setDoc(saved);
      toast(t("builder.toasts.cvSaved"), "success");
    } finally {
      setBusy("");
    }
  };
  const fromText = async () => {
    setBusy("gen");
    try {
      const r = await api.generateCvDoc(activeProfileId, profile?.cvText || "");
      if (r.doc) setDoc(r.doc);
      toast(r.offline ? t("builder.toasts.aiOffline") : t("builder.toasts.parsedFromText"), r.offline ? "info" : "success");
    } finally {
      setBusy("");
    }
  };
  const importLinkedIn = async (file?: File) => {
    if (!file) return;
    setBusy("li");
    try {
      const r = await api.importLinkedIn(activeProfileId, file);
      if (r.doc) setDoc(r.doc);
      toast(t("builder.toasts.linkedinImported"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("builder.toasts.importError"), "error");
    } finally {
      setBusy("");
    }
  };
  const uploadFile = async (file?: File) => {
    if (!file) return;
    setBusy("upload");
    try {
      const r = await api.uploadCV(activeProfileId, file);
      await applyCvUpload(r);
      setDoc(r.cvDoc ?? (await api.cvDoc(activeProfileId)));
      toast(r.cvDoc ? t("builder.toasts.cvUploadedParsed") : t("builder.toasts.cvUploadedNoParsing"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("builder.toasts.uploadError"), "error");
    } finally {
      setBusy("");
    }
  };
  const busyStyle = (busy.startsWith("sum:") ? busy.slice(4) : "") as SummaryStyle | "";
  const improveSummary = async (style: SummaryStyle) => {
    setBusy(`sum:${style}`);
    try {
      set({ summary: (await api.improveCv(doc.summary, "summary", style)).text });
    } finally {
      setBusy("");
    }
  };
  const improveBullets = async (i: number) => {
    setBusy(`b${i}`);
    try {
      const before = doc.experience[i].bullets;
      const improved = await Promise.all(before.filter(Boolean).map(async (b) => (await api.improveCv(b, "bullet")).text));
      // Stashed for a one-step undo below — cleared automatically once `canUndoBullets` no longer
      // sees the entry's bullets matching `after` (i.e. the user edited/moved/deleted one).
      setBulletsUndo((prev) => ({ ...prev, [i]: { before, after: improved } }));
      setExp(i, { bullets: improved });
    } finally {
      setBusy("");
    }
  };
  // Improves exactly one bullet in place (index preserved) — the per-row "improve this" button in
  // ExperienceCard, as opposed to improveBullets above which rewrites (and compacts, via its own
  // `.filter(Boolean)`) every bullet in the entry at once.
  const improveBullet = async (i: number, bulletIndex: number) => {
    setBusy(`bi${i}-${bulletIndex}`);
    try {
      const before = doc.experience[i].bullets[bulletIndex] ?? "";
      const improved = (await api.improveCv(before, "bullet")).text;
      setBulletUndo((prev) => ({ ...prev, [`${i}-${bulletIndex}`]: { before, after: improved } }));
      setExp(i, { bullets: doc.experience[i].bullets.map((b, idx) => (idx === bulletIndex ? improved : b)) });
    } finally {
      setBusy("");
    }
  };
  // One-step undo for the two AI-rewrite actions above — this is the user's resume text, and
  // unlike cv-review's suggestion list (applied only on explicit "Add"/"Apply"), improveBullet(s)
  // overwrite in place with no preview, so a quick revert-to-previous matters here specifically.
  // `canUndoBullet(s)` doubles as the "still showing" gate: once the live bullet(s) no longer
  // match the stashed `after` value (the user edited it, or reordered/removed bullets), the undo
  // affordance disappears on its own — no separate "clear on edit" wiring needed.
  const undoBullet = (i: number, bulletIndex: number) => {
    const key = `${i}-${bulletIndex}`;
    const entry = bulletUndo[key];
    if (!entry) return;
    setExp(i, { bullets: doc.experience[i].bullets.map((b, idx) => (idx === bulletIndex ? entry.before : b)) });
    setBulletUndo((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const undoBullets = (i: number) => {
    const entry = bulletsUndo[i];
    if (!entry) return;
    setExp(i, { bullets: entry.before });
    setBulletsUndo((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
  };
  const canUndoBullet = (i: number, bulletIndex: number) => {
    const entry = bulletUndo[`${i}-${bulletIndex}`];
    return !!entry && doc.experience[i]?.bullets[bulletIndex] === entry.after;
  };
  const canUndoBullets = (i: number) => {
    const entry = bulletsUndo[i];
    return !!entry && JSON.stringify(doc.experience[i]?.bullets) === JSON.stringify(entry.after);
  };
  const langs = doc.languages ?? [];
  const certifications = doc.certifications ?? [];
  const awards = doc.awards ?? [];
  const publications = doc.publications ?? [];
  const volunteer = doc.volunteer ?? [];
  const references = doc.references ?? [];
  const tailorVac = tailored && vacancies.find((v) => v.id === matchVacId);
  // Clicking a section/entry in the live preview jumps straight to it in the editor — the
  // preview tags each block with data-section (see cv-doc-utils.ts); "summary"/"general" both
  // map to the General section since Name/Role/Contacts/Summary live together there.
  // Opening a content section from anywhere (preview click, completeness chip) has to leave the
  // appearance mode too — otherwise the accordion it just opened isn't on screen at all.
  const openSection = (key: SectionKey) => {
    setEditorMode("content");
    setActiveSection(key);
    if (EXTRA_SECTION_KEYS.has(key)) setMoreOpen(true);
  };
  const onPreviewSectionClick = (section: string) => {
    const expMatch = /^experience-(\d+)$/.exec(section);
    if (expMatch) {
      openSection("experience");
      setExpFocusIndex(Number(expMatch[1]));
      return;
    }
    if (section === "summary" || section === "general") {
      openSection("general");
      return;
    }
    if (
      section === "skills" ||
      section === "projects" ||
      section === "education" ||
      section === "languages" ||
      section === "certifications" ||
      section === "awards" ||
      section === "publications" ||
      section === "volunteer" ||
      section === "references"
    ) {
      setActiveSection(section);
    }
  };
  const accordion = (key: SectionKey, icon: string, title: string, hint: string | undefined, body: ReactNode) => (
    <Section
      key={key}
      icon={icon}
      title={title}
      hint={hint}
      open={activeSection === key}
      // Clicking the header of the currently-open section closes it (nothing open) instead of
      // being a no-op — `onToggle` already computes the next boolean state for us.
      onToggle={(nextOpen) => setActiveSection(nextOpen ? key : null)}
    >
      {body}
    </Section>
  );
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("builder.header.eyebrow")}
        title={t("builder.header.title")}
        subtitle={t("builder.header.subtitle")}
        actions={
          <>
            {/* Which CV you're editing reads as this page's document title, so it heads the action
                row rather than costing a third row of tabs below the header. */}
            {cvProfiles && cvProfiles.length > 0 && (
              <ProfileSwitcher
                profiles={cvProfiles}
                activeId={activeProfileId}
                onSelect={setActiveProfileId}
                onCreate={() => createProfileMutation.mutate("", { onSuccess: (created) => setActiveProfileId(created.id) })}
                onDuplicate={(id) => duplicateProfileMutation.mutate(id, { onSuccess: (created) => setActiveProfileId(created.id) })}
                onRename={(id, name) => renameProfileMutation.mutate({ id, name })}
                onDelete={(id) => deleteProfileMutation.mutate(id)}
                creating={createProfileMutation.isPending}
                renamingProfileId={renameProfileMutation.isPending ? renameProfileMutation.variables?.id : undefined}
                duplicatingProfileId={duplicateProfileMutation.isPending ? duplicateProfileMutation.variables : undefined}
                deletingProfileId={deleteProfileMutation.isPending ? deleteProfileMutation.variables : undefined}
                atLimit={cvProfiles.length >= MAX_CV_PROFILES}
                maxProfiles={MAX_CV_PROFILES}
              />
            )}
            {/* Save status, always present rather than appearing only after this session
                happened to save something: with `dirty` tracked as real state, "all changes
                saved" is a truthful statement about a freshly-loaded doc too. Hidden only while
                an explicit save is in flight, so it never fights that button's own spinner. */}
            {busy !== "save" && (
              <span className="flex items-center gap-1.5 text-xs text-ink-dim self-center mr-1">
                {autosaving ? (
                  <>
                    <Spinner className="h-3 w-3" /> {t("builder.autosave.saving")}
                  </>
                ) : dirty ? (
                  t("builder.autosave.unsaved")
                ) : (
                  t("builder.autosave.saved")
                )}
              </span>
            )}
            <Btn
              variant="ghost"
              onClick={() => exportCvDoc(doc, () => toast(t("builder.header.exportPopupBlocked"), "error"))}
              title={t("builder.header.exportPdfTitle")}
            >
              {t("builder.header.exportPdf")}
            </Btn>
            {/* Disabled when there's nothing to save — paired with the status line above, that
                reads as "you're up to date", not as a broken button. */}
            <Btn onClick={save} loading={busy === "save"} disabled={!dirty && !autosaving}>
              {t("shared.saveButton")}
            </Btn>
          </>
        }
      />
      {/* Toolbar, split into the two jobs it actually serves rather than one undifferentiated row
          of equal-weight buttons: getting content INTO the CV (left) and running AI checks ON it
          (right). Each half is named, so "Vacancy / Compare / Tailor / AI Assistant" reads as one
          coherent group instead of four unrelated buttons that happen to sit next to each other.
          Save/Export stay in the header above as the only two primary-looking actions. */}
      <div className="flex items-start gap-x-5 gap-y-3 flex-wrap rounded-card border border-grid bg-surface px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim">{t("builder.toolbar.fillGroup")}</span>
          <Dropdown label={t("builder.importMenu.label")}>
            <label className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-surface-2">
              {busy === "upload" ? (
                <>
                  <Spinner className="h-3.5 w-3.5" /> {t("builder.importMenu.parsing")}
                </>
              ) : (
                t("builder.importMenu.fromFile")
              )}
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                disabled={busy === "upload"}
                onChange={(e) => uploadFile(e.target.files?.[0])}
              />
            </label>
            <label className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-surface-2">
              {busy === "li" ? (
                <>
                  <Spinner className="h-3.5 w-3.5" /> {t("builder.importMenu.importingLinkedin")}
                </>
              ) : (
                t("builder.importMenu.linkedin")
              )}
              <input
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                disabled={busy === "li"}
                onChange={(e) => importLinkedIn(e.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              onClick={fromText}
              // 30-char floor matches the server's own gate (cv.routes.ts's doc/generate route) —
              // below it the server can't call the LLM at all and just echoes back the current doc
              // unchanged, so keeping the button enabled down to "any character" only set up a
              // confusing no-op click.
              disabled={!llm || busy === "gen" || (profile?.cvText?.trim().length ?? 0) < 30}
              title={(profile?.cvText?.trim().length ?? 0) < 30 ? t("builder.importMenu.fromProfileEmptyTitle") : undefined}
              className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-left hover:bg-surface-2 disabled:opacity-40"
            >
              {busy === "gen" && <Spinner className="h-3.5 w-3.5" />} {t("builder.importMenu.fromProfileText")}
            </button>
            <details className="text-xs text-ink-dim px-2 pt-1" data-keep-open>
              <summary className="cursor-pointer select-none hover:text-ink font-medium">
                {t("builder.importMenu.fromProfileHelpSummary")}
              </summary>
              <div className="mt-1.5 text-ink-dim">
                <Trans i18nKey="builder.importMenu.fromProfileHelpBody" ns="cv" components={{ b: <b /> }} />
              </div>
            </details>
            <details className="text-xs text-ink-dim px-2 pt-1" data-keep-open>
              <summary className="cursor-pointer select-none hover:text-ink font-medium">
                {t("builder.importMenu.linkedinHelpSummary")}
              </summary>
              <div className="mt-1.5 text-ink-dim">
                <Trans i18nKey="builder.importMenu.linkedinHelpBody" ns="cv" components={{ b: <b /> }} />
              </div>
            </details>
          </Dropdown>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-dim">{t("builder.toolbar.aiGroup")}</span>
          <Dropdown
            label={
              matchVacId
                ? (vacancies.find((v) => v.id === matchVacId)?.position ?? t("builder.vacancyMenu.fallback"))
                : t("builder.vacancyMenu.label")
            }
          >
            <div className="text-xs font-semibold text-ink-dim px-1 pb-1">{t("builder.vacancyMenu.compareAgainst")}</div>
            {vacancies.length === 0 ? (
              <div className="text-xs text-ink-dim px-1 py-1">{t("builder.vacancyMenu.noVacancies")}</div>
            ) : (
              <Select
                data-keep-open
                value={matchVacId}
                onChange={(e) => setMatchVacId(Number(e.target.value))}
                className="w-full bg-surface-2 focus:outline-none focus:ring-2 focus:ring-signal/50"
              >
                <option value={0}>{t("builder.vacancyMenu.selectPlaceholder")}</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.position}
                    {v.company ? ` — ${v.company}` : ""}
                  </option>
                ))}
              </Select>
            )}
          </Dropdown>
          <Btn size="sm" variant="ghost" onClick={doMatch} loading={busyMatch} disabled={!matchVacId}>
            {t("builder.compareButton")}
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            onClick={doTailor}
            loading={busyTailor}
            disabled={!matchVacId}
            title={t("builder.tailorButtonTitle")}
          >
            {t("builder.tailorButton")}
          </Btn>
          <span className="mx-1 h-5 w-px bg-grid" aria-hidden />
          <Btn size="sm" variant="ghost" onClick={doReview} loading={startReviewJob.isPending || reviewRunning} disabled={reviewRunning}>
            {t("builder.aiAssistantButton")}
          </Btn>
        </div>
      </div>
      {reviewRunning && (
        <Card>
          <div className="text-sm font-semibold text-ink mb-1">{t("builder.aiAssistantProgress.heading")}</div>
          <div className="text-xs text-ink-dim mb-3">{t("builder.aiAssistantProgress.hint")}</div>
          <CvReviewProgress step={reviewJob?.step ?? null} />
        </Card>
      )}
      {reviewJob?.status === "error" && (
        <Card className="!py-3 bg-alert/10 border-alert/30">
          <div className="text-sm text-alert">{reviewJob.error || t("builder.toasts.analysisError")}</div>
        </Card>
      )}
      {/* Suppressed while the first-run start card is up — that card already offers this exact
          action ("from your Profile CV text") as one of its three, and two prompts to do the same
          thing on one screen is the confusion this pass is removing, not adding. */}
      {!dismissedSuggest && !(docIsEmpty && !startedManually) && llm && !!profile?.cvText?.trim() && doc.experience.length === 0 && (
        <Card className="!py-3 bg-alert/10 border-alert/30 flex items-center gap-3">
          <div className="text-sm text-ink flex-1">{t("builder.suggest.message")}</div>
          <Btn size="sm" onClick={fromText} loading={busy === "gen"}>
            {t("builder.suggest.parseCv")}
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setDismissedSuggest(true)}>
            {t("builder.suggest.later")}
          </Btn>
        </Card>
      )}
      <ReportsPanel
        review={review}
        match={match}
        tailored={tailored}
        activeReport={activeReport}
        setActiveReport={setActiveReport}
        setReview={setReview}
        setMatch={setMatch}
        setTailored={setTailored}
        tailorVacancyLabel={tailorVac ? vacancyLabel(tailorVac) : undefined}
        onAddKeyword={addSkill}
        onApplyTailored={applyTailored}
        onApplySummary={(s) => {
          set({ summary: s });
          toast(t("builder.reports.match.summaryUpdatedToast"), "success");
        }}
        onApplyRewrite={applyRewrite}
      />
      {/* grid-cols-1 (not just "grid" with no columns) — important: Tailwind explicitly sets
          `minmax(0, 1fr)`, whereas "none" (the default implicit grid without any `grid-cols-*`)
          gives track sizing "auto", which honors the min-content of descendants. The CV preview
          renders an iframe with a fixed "page" width of 880px (PAGE_WIDTH in cv-preview-panel.tsx)
          and only scales it visually (CSS transform) — this is a fixed pixel width which on
          mobile WITHOUT minmax(0,...) would stretch the track (and with it the whole column
          along with unrelated cards on the left, since in a single-column grid all rows share
          the same track width) up to 880px and cause horizontal scroll of the entire page. */}
      {/* pb-16 sm:pb-16 lg:pb-0 — leaves room so the fixed preview FAB (<sm) / strip (sm–lg) from
          CvPreviewPanel never overlaps the last accordion section's own buttons at the bottom of
          the scroll; not needed at lg+ where the preview is a sticky column, not fixed-position.
          Preview column is now slightly WIDER than the editor (1.15fr vs 1fr), not narrower as
          before (1fr vs 1.4fr) — the preview renders a fixed-aspect A4 "page" scaled to fit its
          own column width (ScaledFrame in cv-preview-panel.tsx), so its legibility scales directly
          with how much width it gets; the editor is a form (labels + short inputs/chips) that
          reads fine at a more modest width and doesn't need the extra room nearly as much. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4 items-start pb-16 lg:pb-0">
        <div className="min-w-0 space-y-2.5">
          {/* The editor's own top-level split. Sits at the very top of the column (not buried at
              the end of the section list) so "what's in my CV" and "how it looks" are visibly two
              modes of the same editor, both watched through the same live preview on the right. */}
          <Segmented
            value={editorMode}
            onChange={setEditorMode}
            size="md"
            options={[
              { value: "content", label: t("builder.editorMode.content") },
              { value: "design", label: t("builder.editorMode.design") },
            ]}
          />
          {editorMode === "design" ? (
            <div className="space-y-2.5">
              <AppearancePanel doc={doc} theme={theme} onSetTheme={setTheme} onSetPhoto={(photo) => set({ photo })} />
              <LayoutPresetsPanel
                sectionOrder={sectionOrder}
                onMoveSection={moveSection}
                presets={presets}
                presetName={presetName}
                onPresetNameChange={setPresetName}
                onSavePreset={savePreset}
                onApplyPreset={applyPreset}
                onDeletePreset={deletePreset}
                saving={busy === "preset"}
              />
            </div>
          ) : docIsEmpty && !startedManually ? (
            /* First run: a brand-new CV has nothing to complete and nothing to preview, so the
               eleven empty accordions below are eleven equally-plausible places to start. This
               card narrows that to the two decisions that actually exist — bring an existing CV
               in, or start typing — and disappears on its own the moment the doc has content. */
            <Card className="space-y-4 text-center">
              <div>
                <div className="font-display text-lg font-bold text-ink">{t("builder.start.title")}</div>
                <p className="text-sm text-ink-dim mt-1">{t("builder.start.subtitle")}</p>
              </div>
              <div className="flex flex-col items-stretch gap-2 max-w-xs mx-auto">
                <label
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold px-3 py-2 text-sm transition-colors ${busy === "upload" ? "bg-star/40 text-on-signal" : "bg-star text-on-signal hover:opacity-90 cursor-pointer"}`}
                >
                  {busy === "upload" ? (
                    <>
                      <Spinner className="h-3.5 w-3.5" /> {t("builder.importMenu.parsing")}
                    </>
                  ) : (
                    t("builder.start.uploadFile")
                  )}
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    disabled={busy === "upload"}
                    onChange={(e) => uploadFile(e.target.files?.[0])}
                  />
                </label>
                <label className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-grid bg-surface-2 px-3 py-2 text-sm font-semibold text-ink cursor-pointer hover:bg-grid">
                  {busy === "li" ? (
                    <>
                      <Spinner className="h-3.5 w-3.5" /> {t("builder.importMenu.importingLinkedin")}
                    </>
                  ) : (
                    t("builder.importMenu.linkedin")
                  )}
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    disabled={busy === "li"}
                    onChange={(e) => importLinkedIn(e.target.files?.[0])}
                  />
                </label>
                {/* Same gate as the Import menu's own item — offered here only when there IS
                    profile text to parse and the LLM can actually parse it. */}
                {llm && (profile?.cvText?.trim().length ?? 0) >= 30 && (
                  <Btn variant="subtle" onClick={fromText} loading={busy === "gen"}>
                    {t("builder.importMenu.fromProfileText")}
                  </Btn>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStartedManually(true)}
                className="text-sm font-medium text-signal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 rounded"
              >
                {t("builder.start.manual")}
              </button>
            </Card>
          ) : (
            <div className="space-y-2.5">
              <ResumeCompleteness doc={doc} onJump={openSection} />
              {accordion(
                "general",
                "",
                t("builder.sections.general.title"),
                doc.name || undefined,
                <GeneralSection doc={doc} onChange={set} llm={llm} busyStyle={busyStyle} onImproveSummary={improveSummary} />,
              )}
              {accordion(
                "experience",
                "",
                t("builder.sections.experience.title"),
                doc.experience.length
                  ? t("builder.sections.experience.entries", { count: doc.experience.length })
                  : t("builder.sections.experience.addHint"),
                <ExperienceCard
                  experience={doc.experience}
                  onAdd={() => set({ experience: [...doc.experience, { role: "", company: "", period: "", bullets: [] }] })}
                  onRemove={(i) => set({ experience: doc.experience.filter((_, idx) => idx !== i) })}
                  onSet={setExp}
                  onMove={moveExp}
                  llm={llm}
                  busyKey={busy}
                  onImproveBullets={improveBullets}
                  onImproveBullet={improveBullet}
                  canUndoBullets={canUndoBullets}
                  canUndoBullet={canUndoBullet}
                  onUndoBullets={undoBullets}
                  onUndoBullet={undoBullet}
                  focusIndex={expFocusIndex}
                />,
              )}
              {accordion(
                "skills",
                "",
                t("builder.sections.skills.title"),
                doc.skills.length ? t("builder.sections.addedCount", { count: doc.skills.length }) : t("builder.sections.skills.addHint"),
                <SkillsInput
                  label={t("builder.sections.skills.title")}
                  hideLabel
                  skills={doc.skills}
                  onChange={(skills) => set({ skills })}
                  placeholder={t("builder.sections.skills.searchPlaceholder")}
                />,
              )}
              {accordion(
                "projects",
                "",
                t("builder.sections.projects.title"),
                doc.projects.length
                  ? t("builder.sections.itemsCount", { count: doc.projects.length })
                  : t("builder.sections.projects.addHint"),
                <ProjectsSection projects={doc.projects} onChange={(projects) => set({ projects })} />,
              )}
              {accordion(
                "education",
                "",
                t("builder.sections.education.title"),
                doc.education.length
                  ? t("builder.sections.itemsCount", { count: doc.education.length })
                  : t("builder.sections.education.addHint"),
                <EducationSection education={doc.education} onChange={(education) => set({ education })} />,
              )}
              {accordion(
                "certifications",
                "",
                t("builder.sections.certifications.title"),
                certifications.length
                  ? t("builder.sections.itemsCount", { count: certifications.length })
                  : t("builder.sections.certifications.addHint"),
                <CertificationsSection certifications={certifications} onChange={(certifications) => set({ certifications })} />,
              )}
              {accordion(
                "languages",
                "",
                t("builder.sections.languages.title"),
                langs.length ? t("builder.sections.addedCount", { count: langs.length }) : t("builder.sections.languages.addHint"),
                <LanguagesSection languages={langs} onChange={(languages) => set({ languages })} />,
              )}
              {/* Everything above is either scored by ResumeCompleteness or on nearly every CV. The
              four below are genuinely optional, so they're one collapsed row instead of four more
              "empty" rows competing for attention with Experience. */}
              <button
                type="button"
                onClick={() => setMoreOpen(!moreOpen)}
                aria-expanded={moreOpen}
                className="w-full flex items-center gap-2 rounded-card px-3.5 py-2 text-sm font-medium text-ink-dim hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50"
              >
                <span>{t("builder.sections.moreTitle")}</span>
                <span className="text-xs font-normal text-ink-dim truncate">· {t("builder.sections.moreHint")}</span>
                <span className={`ml-auto transition-transform duration-200 ${moreOpen ? "rotate-90" : ""}`} aria-hidden>
                  ›
                </span>
              </button>
              {moreOpen && (
                <>
                  {accordion(
                    "awards",
                    "",
                    t("builder.sections.awards.title"),
                    awards.length ? t("builder.sections.itemsCount", { count: awards.length }) : t("builder.sections.awards.addHint"),
                    <AwardsSection awards={awards} onChange={(awards) => set({ awards })} />,
                  )}
                  {accordion(
                    "publications",
                    "",
                    t("builder.sections.publications.title"),
                    publications.length
                      ? t("builder.sections.itemsCount", { count: publications.length })
                      : t("builder.sections.publications.addHint"),
                    <PublicationsSection publications={publications} onChange={(publications) => set({ publications })} />,
                  )}
                  {accordion(
                    "volunteer",
                    "",
                    t("builder.sections.volunteer.title"),
                    volunteer.length
                      ? t("builder.sections.itemsCount", { count: volunteer.length })
                      : t("builder.sections.volunteer.addHint"),
                    <VolunteerSection volunteer={volunteer} onChange={(volunteer) => set({ volunteer })} />,
                  )}
                  {accordion(
                    "references",
                    "",
                    t("builder.sections.references.title"),
                    references.length
                      ? t("builder.sections.itemsCount", { count: references.length })
                      : t("builder.sections.references.addHint"),
                    <ReferencesSection references={references} onChange={(references) => set({ references })} />,
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {/* Right column — preview only, nothing above it: sticky and immediately in focus no
            matter which accordion section is open on the left. */}
        <div className="min-w-0 lg:sticky lg:top-6">
          <CvPreviewPanel
            doc={doc}
            onExport={() => exportCvDoc(doc, () => toast(t("builder.header.exportPopupBlocked"), "error"))}
            onSectionClick={onPreviewSectionClick}
          />
        </div>
      </div>
      {/* Sharing is what you do with a FINISHED CV, so it sits after the editor rather than
          between the toolbar and the fields — it used to take a full row of prime above-the-fold
          space on a page whose whole job is editing. */}
      <ShareLinkCard profileId={activeProfileId} />
    </div>
  );
}
