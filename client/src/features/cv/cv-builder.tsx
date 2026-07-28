import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useApplyCvUpload, useProfile, useVacancies } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, Dropdown, PageHeader, Section, Segmented, Spinner } from "../../shared/ui";
import { SkillsInput } from "../../shared/view-kit";
import type { CvDoc, CvExperience, CvMatch, CvPreset, CvReview, CvTheme } from "../../shared/types";
import { CvMatchPanel, CvReviewPanel } from "./cv";
import { DEFAULT_ORDER, cvDocToText, exportCvDoc, themeOf } from "./builder/cv-doc-utils";
import { GeneralSection } from "./builder/basic-info-card";
import type { SummaryStyle } from "./builder/basic-info-card";
import { ExperienceCard } from "./builder/experience-card";
import { EducationSection, LanguagesSection, ProjectsSection } from "./builder/extra-sections-cards";
import { AppearancePanel } from "./builder/appearance-panel";
import { LayoutPresetsPanel } from "./builder/layout-presets-panel";
import { CvPreviewPanel } from "./builder/cv-preview-panel";
import { ResumeCompleteness } from "./builder/resume-completeness";

type SectionKey = "general" | "experience" | "skills" | "projects" | "education" | "languages" | "design";

/* ---------- CV Builder ---------- */
export function CvBuilder({ llm }: { llm: boolean }) {
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
  const [activeReport, setActiveReport] = useUi<"review" | "match">("cvbuilder.activeReport", "review");
  const [dismissedSuggest, setDismissedSuggest] = useState(false);
  // Single exclusive accordion instead of the old "Content / Design" tab split with every card
  // stacked underneath — one section open at a time, so there's never more scrolling than one
  // section's worth of fields. "design" folds in the old Appearance + Layout/Presets panels.
  const [activeSection, setActiveSection] = useUi<SectionKey>("cvbuilder.activeSection", "general");
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
      toast("Enter a preset name", "error");
      return;
    }
    const next = [...presets.filter((p) => p.name.toLowerCase() !== name.toLowerCase()), { name, theme }];
    setBusy("preset");
    try {
      const r = await api.saveCvPresets(next);
      setPresets(r.presets);
      setPresetName("");
      toast(`Preset "${name}" saved`, "success");
    } finally {
      setBusy("");
    }
  };
  const applyPreset = (p: CvPreset) => {
    setTheme(p.theme);
    toast(`Applied "${p.name}"`, "info");
  };
  const addSkill = (k: string) => {
    if (doc.skills.some((s) => s.toLowerCase() === k.toLowerCase())) {
      toast(`"${k}" already in skills`, "info");
      return;
    }
    set({ skills: [...doc.skills, k] });
    toast(`Added "${k}" to skills`, "success");
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
      toast(`Updated the bullet in "${doc.experience[best.ei].role || `entry ${best.ei + 1}`}"`, "success");
      return;
    }
    navigator.clipboard?.writeText(after).catch(() => undefined);
    toast("Couldn't find a similar bullet — text copied to clipboard", "info");
  };
  const doMatch = async () => {
    const vac = vacancies.find((v) => v.id === matchVacId);
    if (!vac) {
      toast("Select a vacancy from the list", "error");
      return;
    }
    const jobText = [vac.stack.length ? `Stack: ${vac.stack.join(", ")}` : "", vac.notes].filter(Boolean).join("\n") || vac.position;
    setBusyMatch(true);
    try {
      const r = await api.matchVacancy(cvDocToText(doc), `${vac.position}${vac.company ? ` @ ${vac.company}` : ""}`, jobText);
      setMatch(r);
      setActiveReport("match");
      toast(r.offline ? "Basic comparison (enable LLM for accurate results)" : "Comparison ready", r.offline ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Comparison error", "error");
    } finally {
      setBusyMatch(false);
    }
  };
  const doReview = async () => {
    const text = cvDocToText(doc);
    if (text.trim().length < 30) {
      toast("Fill in more CV details for analysis", "error");
      return;
    }
    setBusyReview(true);
    try {
      const r = await api.reviewCV(text);
      setReview(r);
      setActiveReport("review");
      toast(r.offline ? "Basic analysis (enable LLM for deeper analysis)" : "Analysis ready", r.offline ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Analysis error", "error");
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
      toast("CV saved", "success");
    } finally {
      setBusy("");
    }
  };
  const fromText = async () => {
    setBusy("gen");
    try {
      const r = await api.generateCvDoc(profile?.cvText || "");
      if (r.doc) setDoc(r.doc);
      toast(r.offline ? "AI offline — enable the key" : "Parsed from your CV into sections", r.offline ? "info" : "success");
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
      toast("Profile imported from LinkedIn", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import error", "error");
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
      toast(
        r.cvDoc ? "CV parsed into the builder and applied everywhere" : "CV uploaded (enable LLM for auto-parsing into sections)",
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload error", "error");
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
    <Section key={key} icon={icon} title={title} hint={hint} open={activeSection === key} onToggle={() => setActiveSection(key)}>
      {body}
    </Section>
  );
  return (
    <div className="space-y-4">
      <PageHeader
        title="CV Builder"
        subtitle="A structured resume focused on outcomes. Fill it in from your existing CV, edit it, and export to PDF."
        actions={
          <>
            <Btn
              variant="ghost"
              onClick={() => exportCvDoc(doc)}
              title="In the browser's print dialog, the date/document title at the top of pages are disabled automatically; if they still appear — turn off «Headers and footers»"
            >
              ⬇️ Export PDF
            </Btn>
            <Btn onClick={save} loading={busy === "save"}>
              💾 Save
            </Btn>
          </>
        }
      />
      {/* Simplified toolbar: two grouped dropdowns (Import, Vacancy) instead of a row of
          equal-weight buttons, plus Compare/AI Assistant — Save/Export stayed above as the
          only two primary-looking actions. */}
      <div className="flex items-center gap-2 flex-wrap">
        <Dropdown label="📎 Import">
          <label className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
            {busy === "upload" ? (
              <>
                <Spinner className="h-3.5 w-3.5" /> Parsing…
              </>
            ) : (
              "📎 From CV file"
            )}
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              disabled={busy === "upload"}
              onChange={(e) => uploadFile(e.target.files?.[0])}
            />
          </label>
          <label className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-50">
            {busy === "li" ? (
              <>
                <Spinner className="h-3.5 w-3.5" /> Importing…
              </>
            ) : (
              "🔗 LinkedIn (.zip)"
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
            className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-left hover:bg-slate-50 disabled:opacity-40"
          >
            {busy === "gen" ? <Spinner className="h-3.5 w-3.5" /> : "🪄"} From profile text (AI)
          </button>
          <details className="text-xs text-slate-500 px-2 pt-1" data-keep-open>
            <summary className="cursor-pointer select-none hover:text-slate-700 font-medium">Where do I get a LinkedIn .zip?</summary>
            <div className="mt-1.5 text-slate-600">
              LinkedIn → <b>Settings & Privacy → Data Privacy → Get a copy of your data</b> → «Want something in particular» (Profile,
              Positions, Skills, Education) → get the archive by email → upload the <b>.zip</b> here.
            </div>
          </details>
        </Dropdown>
        <Dropdown label={matchVacId ? `🎯 ${vacancies.find((v) => v.id === matchVacId)?.position ?? "Vacancy"}` : "🎯 Vacancy"}>
          <div className="text-xs font-semibold text-slate-500 px-1 pb-1">Compare CV against</div>
          {vacancies.length === 0 ? (
            <div className="text-xs text-slate-400 px-1 py-1">Add vacancies to the tracker first</div>
          ) : (
            <select
              data-keep-open
              value={matchVacId}
              onChange={(e) => setMatchVacId(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value={0}>— select a vacancy —</option>
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
          🎯 Compare
        </Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
        <Btn size="sm" variant="ghost" onClick={doReview} loading={busyReview}>
          🤖 AI Assistant
        </Btn>
      </div>
      {!dismissedSuggest && llm && !!profile?.cvText?.trim() && !doc.name && !doc.summary && doc.experience.length === 0 && (
        <Card className="!py-3 bg-amber-50 border-amber-200 flex items-center gap-3">
          <span className="text-lg">💡</span>
          <div className="text-sm text-slate-700 flex-1">
            Your profile already has CV text, but the builder is still empty. Parse it into sections automatically?
          </div>
          <Btn size="sm" onClick={fromText} loading={busy === "gen"}>
            🪄 Parse CV
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setDismissedSuggest(true)}>
            Later
          </Btn>
        </Card>
      )}
      {(review || match) &&
        (() => {
          // Which reports actually exist — falls back to whichever is available if the
          // remembered tab was hidden/cleared, so the dismiss (✕) button always acts on what's
          // actually on screen. Because both live in one fixed-position card with a tab
          // switcher instead of two independently-ordered blocks, running "Compare" after
          // "Tips" never pushes the review result out of view — it's one click away, not gone.
          const available: ("review" | "match")[] = [...(review ? (["review"] as const) : []), ...(match ? (["match"] as const) : [])];
          const current = available.includes(activeReport) ? activeReport : available[0];
          return (
            <div className="space-y-2">
              {available.length > 1 && (
                <Segmented
                  value={current}
                  onChange={setActiveReport}
                  options={[
                    { value: "review", label: "🔎 Tips" },
                    { value: "match", label: "🎯 Vacancy match" },
                  ]}
                />
              )}
              <div className="relative">
                <button
                  onClick={() => (current === "review" ? setReview(null) : setMatch(null))}
                  title="Hide"
                  className="absolute right-3 top-3 z-10 text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕
                </button>
                {current === "match" && match ? (
                  <CvMatchPanel
                    match={match}
                    onAddKeyword={addSkill}
                    onApplySummary={(s) => {
                      set({ summary: s });
                      toast("Summary updated for the vacancy", "success");
                    }}
                  />
                ) : (
                  review && <CvReviewPanel review={review} onAddKeyword={addSkill} onApplyRewrite={applyRewrite} />
                )}
              </div>
            </div>
          );
        })()}
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
            "General",
            doc.name || undefined,
            <GeneralSection doc={doc} onChange={set} llm={llm} busyStyle={busyStyle} onImproveSummary={improveSummary} />,
          )}
          {accordion(
            "experience",
            "💼",
            "Experience",
            doc.experience.length ? `${doc.experience.length} entries` : "empty",
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
            "Skills",
            doc.skills.length ? `${doc.skills.length} added` : "empty",
            <SkillsInput label="Skills" hideLabel skills={doc.skills} onChange={(skills) => set({ skills })} placeholder="Search skill…" />,
          )}
          {accordion(
            "projects",
            "🚀",
            "Projects",
            doc.projects.filter(Boolean).length ? `${doc.projects.filter(Boolean).length} items` : "empty",
            <ProjectsSection projects={doc.projects} onChange={(v) => set({ projects: v.split("\n") })} />,
          )}
          {accordion(
            "education",
            "🎓",
            "Education",
            doc.education.filter(Boolean).length ? `${doc.education.filter(Boolean).length} items` : "empty",
            <EducationSection education={doc.education} onChange={(v) => set({ education: v.split("\n") })} />,
          )}
          {accordion(
            "languages",
            "🌍",
            "Languages",
            langs.length ? `${langs.length} added` : "empty",
            <LanguagesSection languages={langs} onChange={(languages) => set({ languages })} />,
          )}
          {accordion(
            "design",
            "🎨",
            "Design",
            TEMPLATE_LABELS[theme.template],
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

const TEMPLATE_LABELS: Record<CvTheme["template"], string> = {
  classic: "Classic",
  compact: "Compact",
  academic: "Academic",
  twocol: "Two columns",
  minimal: "Minimal",
  sidebar: "Sidebar",
  timeline: "Timeline",
};
