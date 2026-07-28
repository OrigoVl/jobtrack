import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useApplyCvUpload, useProfile, useVacancies } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, PageHeader, Segmented, Spinner } from "../../shared/ui";
import type { CvDoc, CvExperience, CvMatch, CvPreset, CvReview, CvTheme } from "../../shared/types";
import { CvMatchPanel, CvReviewPanel } from "./cv";
import { DEFAULT_ORDER, cvDocToText, exportCvDoc, themeOf } from "./builder/cv-doc-utils";
import { BasicInfoCard } from "./builder/basic-info-card";
import { ExperienceCard } from "./builder/experience-card";
import { LanguagesCard, ProjectsEducationCard } from "./builder/extra-sections-cards";
import { AppearancePanel } from "./builder/appearance-panel";
import { LayoutPresetsPanel } from "./builder/layout-presets-panel";
import { CvPreviewPanel } from "./builder/cv-preview-panel";

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
  // Content and design are split across tabs (instead of stacked on top of each other in one
  // column) — this is what keeps the preview on the right sticky and immediately visible instead
  // of "falling" below the Appearance/Presets panels (hence the earlier "preview at the bottom
  // right" complaint).
  const [tab, setTab] = useUi<"content" | "design">("cvbuilder.tab", "content");
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
  const improveSummary = async () => {
    setBusy("sum");
    try {
      set({ summary: (await api.improveCv(doc.summary, "summary")).text });
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
              ⬇️ PDF
            </Btn>
            <Btn onClick={save} loading={busy === "save"}>
              💾 Save
            </Btn>
          </>
        }
      />
      <Card className="!py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Fill in:</span>
          <label
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer transition-colors ${busy === "upload" ? "bg-indigo-300 text-white" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}
          >
            {busy === "upload" ? (
              <>
                <Spinner className="h-3 w-3" /> Parsing…
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
          <label
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer transition-colors ${busy === "li" ? "bg-slate-200 text-slate-500" : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"}`}
          >
            {busy === "li" ? (
              <>
                <Spinner className="h-3 w-3" /> Importing…
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
          <Btn size="sm" variant="ghost" onClick={fromText} loading={busy === "gen"} disabled={!llm}>
            🪄 From profile text (AI)
          </Btn>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
          <span className="text-xs font-semibold text-slate-500">AI analysis:</span>
          <Btn size="sm" variant="ghost" onClick={doReview} loading={busyReview}>
            🔎 Tips
          </Btn>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
          <span className="text-xs font-semibold text-slate-500">🎯 For a vacancy:</span>
          {vacancies.length === 0 ? (
            <span className="text-xs text-slate-400">add vacancies to the tracker to compare your CV against them</span>
          ) : (
            <>
              <select
                value={matchVacId}
                onChange={(e) => setMatchVacId(Number(e.target.value))}
                className="flex-1 min-w-[200px] bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value={0}>— select a vacancy —</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.position}
                    {v.company ? ` — ${v.company}` : ""}
                  </option>
                ))}
              </select>
              <Btn size="sm" onClick={doMatch} loading={busyMatch} disabled={!matchVacId}>
                Compare
              </Btn>
            </>
          )}
        </div>
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none hover:text-slate-700 font-medium">How do I export a .zip from LinkedIn?</summary>
          <div className="mt-1.5 text-slate-600">
            Go to LinkedIn → <b>Settings & Privacy → Data Privacy → Get a copy of your data</b> → choose «Want something in particular»
            (Profile, Positions, Skills, Education) → get the archive by email → upload the <b>.zip</b> using the button above.
          </div>
        </details>
      </Card>
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
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Segmented
              value={tab}
              onChange={setTab}
              size="md"
              options={[
                { value: "content", label: "📝 Content" },
                { value: "design", label: "🎨 Design" },
              ]}
            />
            <span className="text-xs text-slate-400">
              {tab === "content"
                ? "Resume text — the preview on the right updates immediately"
                : "Template, color, photo, section order and presets"}
            </span>
          </div>
          {tab === "content" ? (
            <>
              <BasicInfoCard doc={doc} onChange={set} llm={llm} improvingSummary={busy === "sum"} onImproveSummary={improveSummary} />
              <ExperienceCard
                experience={doc.experience}
                onAdd={() => set({ experience: [...doc.experience, { role: "", company: "", period: "", bullets: [] }] })}
                onRemove={(i) => set({ experience: doc.experience.filter((_, idx) => idx !== i) })}
                onSet={setExp}
                onMove={moveExp}
                llm={llm}
                busyKey={busy}
                onImproveBullets={improveBullets}
              />
              <ProjectsEducationCard
                projects={doc.projects}
                education={doc.education}
                onChangeProjects={(v) => set({ projects: v.split("\n") })}
                onChangeEducation={(v) => set({ education: v.split("\n") })}
              />
              <LanguagesCard languages={langs} onChange={(languages) => set({ languages })} />
            </>
          ) : (
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
            </div>
          )}
        </div>
        {/* Right column — preview only, nothing above it: sticky and immediately in focus
            regardless of which tab is selected on the left (switching to "Design" still shows
            the result). */}
        <div className="min-w-0 lg:sticky lg:top-6">
          <CvPreviewPanel doc={doc} onExport={() => exportCvDoc(doc)} />
        </div>
      </div>
    </div>
  );
}
