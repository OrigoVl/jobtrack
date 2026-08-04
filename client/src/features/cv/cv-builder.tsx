import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useApplyCvUpload, useProfile, useVacancies } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Dropdown, PageHeader, Section, Spinner } from "../../shared/ui";
import { SkillsInput } from "../../shared/view-kit";
import type { CvDoc, CvExperience, CvMatch, CvPreset, CvReview, CvTailorResult, CvTheme, Vacancy } from "../../shared/types";
import { DEFAULT_ORDER, cvDocToText, exportCvDoc, themeOf } from "./builder/cv-doc-utils";
import { GeneralSection } from "./builder/basic-info-card";
import type { SummaryStyle } from "./builder/basic-info-card";
import { ExperienceCard } from "./builder/experience-card";
import { EducationSection, LanguagesSection, ProjectsSection } from "./builder/extra-sections-cards";
import { AppearancePanel } from "./builder/appearance-panel";
import { LayoutPresetsPanel } from "./builder/layout-presets-panel";
import { CvPreviewPanel } from "./builder/cv-preview-panel";
import { ResumeCompleteness } from "./builder/resume-completeness";
import { ShareLinkCard } from "./builder/share-link-card";
import { ReportsPanel } from "./builder/reports-panel";

type SectionKey = "general" | "experience" | "skills" | "projects" | "education" | "languages" | "design";

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
  const [doc, setDoc] = useState<CvDoc | null>(null);
  const [busy, setBusy] = useState("");
  const [presets, setPresets] = useState<CvPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [review, setReview] = useUi<CvReview | null>("cvbuilder.review", null);
  const [match, setMatch] = useUi<CvMatch | null>("cvbuilder.match", null);
  const [matchVacId, setMatchVacId] = useUi<number>("cvbuilder.matchVac", 0);
  // Own busy flags for review/match (not the shared `busy` string below) — otherwise starting
  // one while the other is still in flight steals its loading spinner via the shared variable.
  // `activeReport` picks which of the two shows in the single reports card below, so generating
  // the second one is a tab switch, not a re-stack that shoves the first one off-screen (which
  // looked like it "closed" when both were rendered as separate, independently-ordered blocks).
  const [busyReview, setBusyReview] = useState(false);
  const [busyMatch, setBusyMatch] = useState(false);
  const [busyTailor, setBusyTailor] = useState(false);
  // Result of "🎯 Tailor CV" (POST /cv/tailor): the candidate's own skills/bullets reordered by
  // relevance to the selected vacancy + a rewritten summary when the LLM produced one. Kept
  // separate from `doc` on purpose — tailoring never touches the live builder doc until the
  // user explicitly clicks "Apply to CV" in the tailor tab below, so switching vacancies to
  // compare/tailor for never risks silently overwriting what's being edited.
  const [tailored, setTailored] = useUi<CvTailorResult | null>("cvbuilder.tailored", null);
  const [activeReport, setActiveReport] = useUi<"review" | "match" | "tailor">("cvbuilder.activeReport", "review");
  const [dismissedSuggest, setDismissedSuggest] = useState(false);
  // Single exclusive accordion instead of the old "Content / Design" tab split with every card
  // stacked underneath — one section open at a time, so there's never more scrolling than one
  // section's worth of fields. "design" folds in the old Appearance + Layout/Presets panels.
  const [activeSection, setActiveSection] = useUi<SectionKey | null>("cvbuilder.activeSection", "general");
  // Which experience entry the live preview asked to focus (click sync) — applied once by
  // ExperienceCard, not held/forced every render (see its own render-time reset guard).
  const [expFocusIndex, setExpFocusIndex] = useState<number | null>(null);
  useEffect(() => {
    api
      .cvDoc()
      .then(setDoc)
      .catch(() => undefined);
    api
      .cvPresets()
      .then((r) => setPresets(r.presets))
      .catch(() => undefined);
  }, []);
  if (!doc) return <CardsSkeleton count={2} />;
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
      const r = await api.saveCvPresets(next);
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
  const doReview = async () => {
    const text = cvDocToText(doc);
    if (text.trim().length < 30) {
      toast(t("builder.toasts.needMoreDetails"), "error");
      return;
    }
    setBusyReview(true);
    try {
      const r = await api.reviewCV(text);
      setReview(r);
      setActiveReport("review");
      toast(r.offline ? t("builder.toasts.reviewOffline") : t("builder.toasts.reviewReady"), r.offline ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("builder.toasts.analysisError"), "error");
    } finally {
      setBusyReview(false);
    }
  };
  const deletePreset = async (name: string) => {
    const next = presets.filter((p) => p.name !== name);
    const r = await api.saveCvPresets(next);
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
      setDoc(await api.saveCvDoc(doc));
      toast(t("builder.toasts.cvSaved"), "success");
    } finally {
      setBusy("");
    }
  };
  const fromText = async () => {
    setBusy("gen");
    try {
      const r = await api.generateCvDoc(profile?.cvText || "");
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
      const r = await api.importLinkedIn(file);
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
      const r = await api.uploadCV(file);
      await applyCvUpload(r);
      setDoc(r.cvDoc ?? (await api.cvDoc()));
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
      const improved = await Promise.all(
        doc.experience[i].bullets.filter(Boolean).map(async (b) => (await api.improveCv(b, "bullet")).text),
      );
      setExp(i, { bullets: improved });
    } finally {
      setBusy("");
    }
  };
  const langs = doc.languages ?? [];
  const tailorVac = tailored && vacancies.find((v) => v.id === matchVacId);
  // Clicking a section/entry in the live preview jumps straight to it in the editor — the
  // preview tags each block with data-section (see cv-doc-utils.ts); "summary"/"general" both
  // map to the General section since Name/Role/Contacts/Summary live together there.
  const onPreviewSectionClick = (section: string) => {
    const expMatch = /^experience-(\d+)$/.exec(section);
    if (expMatch) {
      setActiveSection("experience");
      setExpFocusIndex(Number(expMatch[1]));
      return;
    }
    if (section === "summary" || section === "general") {
      setActiveSection("general");
      return;
    }
    if (section === "skills" || section === "projects" || section === "education" || section === "languages") {
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
        title={t("builder.header.title")}
        subtitle={t("builder.header.subtitle")}
        actions={
          <>
            <Btn variant="ghost" onClick={() => exportCvDoc(doc)} title={t("builder.header.exportPdfTitle")}>
              {t("builder.header.exportPdf")}
            </Btn>
            <Btn onClick={save} loading={busy === "save"}>
              {t("shared.saveButton")}
            </Btn>
          </>
        }
      />
      {/* Simplified toolbar: two grouped dropdowns (Import, Vacancy) instead of a row of
          equal-weight buttons, plus Compare/AI Assistant — Save/Export stayed above as the
          only two primary-looking actions. */}
      <div className="flex items-center gap-2 flex-wrap">
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
            disabled={!llm || busy === "gen"}
            className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-left hover:bg-surface-2 disabled:opacity-40"
          >
            {busy === "gen" ? <Spinner className="h-3.5 w-3.5" /> : "🪄"} {t("builder.importMenu.fromProfileText")}
          </button>
          <details className="text-xs text-ink-dim px-2 pt-1" data-keep-open>
            <summary className="cursor-pointer select-none hover:text-ink font-medium">
              {t("builder.importMenu.linkedinHelpSummary")}
            </summary>
            <div className="mt-1.5 text-ink-dim">
              <Trans i18nKey="builder.importMenu.linkedinHelpBody" ns="cv" components={{ b: <b /> }} />
            </div>
          </details>
        </Dropdown>
        <Dropdown
          label={
            matchVacId
              ? `🎯 ${vacancies.find((v) => v.id === matchVacId)?.position ?? t("builder.vacancyMenu.fallback")}`
              : t("builder.vacancyMenu.label")
          }
        >
          <div className="text-xs font-semibold text-ink-dim px-1 pb-1">{t("builder.vacancyMenu.compareAgainst")}</div>
          {vacancies.length === 0 ? (
            <div className="text-xs text-ink-dim px-1 py-1">{t("builder.vacancyMenu.noVacancies")}</div>
          ) : (
            <select
              data-keep-open
              value={matchVacId}
              onChange={(e) => setMatchVacId(Number(e.target.value))}
              className="w-full bg-surface-2 border border-grid rounded-lg p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            >
              <option value={0}>{t("builder.vacancyMenu.selectPlaceholder")}</option>
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.position}
                  {v.company ? ` — ${v.company}` : ""}
                </option>
              ))}
            </select>
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
        <Btn size="sm" variant="ghost" onClick={doReview} loading={busyReview}>
          {t("builder.aiAssistantButton")}
        </Btn>
      </div>
      {!dismissedSuggest && llm && !!profile?.cvText?.trim() && !doc.name && !doc.summary && doc.experience.length === 0 && (
        <Card className="!py-3 bg-alert/10 border-alert/30 flex items-center gap-3">
          <span className="text-lg">💡</span>
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
      <ShareLinkCard />
      {/* grid-cols-1 (not just "grid" with no columns) — important: Tailwind explicitly sets
          `minmax(0, 1fr)`, whereas "none" (the default implicit grid without any `grid-cols-*`)
          gives track sizing "auto", which honors the min-content of descendants. The CV preview
          renders an iframe with a fixed "page" width of 880px (PAGE_WIDTH in cv-preview-panel.tsx)
          and only scales it visually (CSS transform) — this is a fixed pixel width which on
          mobile WITHOUT minmax(0,...) would stretch the track (and with it the whole column
          along with unrelated cards on the left, since in a single-column grid all rows share
          the same track width) up to 880px and cause horizontal scroll of the entire page. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="min-w-0 space-y-2.5">
          <ResumeCompleteness doc={doc} />
          {accordion(
            "general",
            "🧑",
            t("builder.sections.general.title"),
            doc.name || undefined,
            <GeneralSection doc={doc} onChange={set} llm={llm} busyStyle={busyStyle} onImproveSummary={improveSummary} />,
          )}
          {accordion(
            "experience",
            "💼",
            t("builder.sections.experience.title"),
            doc.experience.length
              ? t("builder.sections.experience.entries", { count: doc.experience.length })
              : t("builder.sections.emptyHint"),
            <ExperienceCard
              experience={doc.experience}
              onAdd={() => set({ experience: [...doc.experience, { role: "", company: "", period: "", bullets: [] }] })}
              onRemove={(i) => set({ experience: doc.experience.filter((_, idx) => idx !== i) })}
              onSet={setExp}
              onMove={moveExp}
              llm={llm}
              busyKey={busy}
              onImproveBullets={improveBullets}
              focusIndex={expFocusIndex}
            />,
          )}
          {accordion(
            "skills",
            "🧩",
            t("builder.sections.skills.title"),
            doc.skills.length ? t("builder.sections.addedCount", { count: doc.skills.length }) : t("builder.sections.emptyHint"),
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
            "🚀",
            t("builder.sections.projects.title"),
            doc.projects.filter(Boolean).length
              ? t("builder.sections.itemsCount", { count: doc.projects.filter(Boolean).length })
              : t("builder.sections.emptyHint"),
            <ProjectsSection projects={doc.projects} onChange={(v) => set({ projects: v.split("\n") })} />,
          )}
          {accordion(
            "education",
            "🎓",
            t("builder.sections.education.title"),
            doc.education.filter(Boolean).length
              ? t("builder.sections.itemsCount", { count: doc.education.filter(Boolean).length })
              : t("builder.sections.emptyHint"),
            <EducationSection education={doc.education} onChange={(v) => set({ education: v.split("\n") })} />,
          )}
          {accordion(
            "languages",
            "🌍",
            t("builder.sections.languages.title"),
            langs.length ? t("builder.sections.addedCount", { count: langs.length }) : t("builder.sections.emptyHint"),
            <LanguagesSection languages={langs} onChange={(languages) => set({ languages })} />,
          )}
          {accordion(
            "design",
            "🎨",
            t("builder.sections.design.title"),
            t(TEMPLATE_LABEL_KEYS[theme.template]),
            <div className="space-y-2">
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
            </div>,
          )}
        </div>
        {/* Right column — preview only, nothing above it: sticky and immediately in focus no
            matter which accordion section is open on the left. */}
        <div className="min-w-0 lg:sticky lg:top-6">
          <CvPreviewPanel doc={doc} onExport={() => exportCvDoc(doc)} onSectionClick={onPreviewSectionClick} />
        </div>
      </div>
    </div>
  );
}

const TEMPLATE_LABEL_KEYS: Record<
  CvTheme["template"],
  | "templates.classic"
  | "templates.compact"
  | "templates.academic"
  | "templates.twocol"
  | "templates.minimal"
  | "templates.sidebar"
  | "templates.timeline"
> = {
  classic: "templates.classic",
  compact: "templates.compact",
  academic: "templates.academic",
  twocol: "templates.twocol",
  minimal: "templates.minimal",
  sidebar: "templates.sidebar",
  timeline: "templates.timeline",
};
