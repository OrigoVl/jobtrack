import { useEffect, useState } from "react";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useApplyCvUpload, useProfile, useVacancies } from "../../shared/queries";
import { Btn, Card, CardsSkeleton, PageHeader, Segmented } from "../../shared/ui";
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
  const [dismissedSuggest, setDismissedSuggest] = useState(false);
  // Контент і дизайн розведені по вкладках (а не стековані одне над одним в одній колонці) —
  // саме так прев'ю праворуч лишається sticky й одразу видимим замість "падіння" вниз під
  // Appearance/Presets-панелями (звідси й був "прев'ю знизу справа").
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
      toast("Введи назву пресета", "error");
      return;
    }
    const next = [...presets.filter((p) => p.name.toLowerCase() !== name.toLowerCase()), { name, theme }];
    setBusy("preset");
    try {
      const r = await api.saveCvPresets(next);
      setPresets(r.presets);
      setPresetName("");
      toast(`Пресет «${name}» збережено`, "success");
    } finally {
      setBusy("");
    }
  };
  const applyPreset = (p: CvPreset) => {
    setTheme(p.theme);
    toast(`Застосовано «${p.name}»`, "info");
  };
  const addSkill = (k: string) => {
    if (doc.skills.some((s) => s.toLowerCase() === k.toLowerCase())) {
      toast(`«${k}» вже в навичках`, "info");
      return;
    }
    set({ skills: [...doc.skills, k] });
    toast(`Додано «${k}» в навички`, "success");
  };
  const applyRewrite = (before: string, after: string) => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-zа-яїєґ0-9 ]/gi, " ")
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
      toast(`Оновлено пункт у «${doc.experience[best.ei].role || `запис ${best.ei + 1}`}»`, "success");
      return;
    }
    navigator.clipboard?.writeText(after).catch(() => undefined);
    toast("Не знайшов схожий пункт — текст скопійовано в буфер", "info");
  };
  const doMatch = async () => {
    const vac = vacancies.find((v) => v.id === matchVacId);
    if (!vac) {
      toast("Обери вакансію зі списку", "error");
      return;
    }
    const jobText = [vac.stack.length ? `Стек: ${vac.stack.join(", ")}` : "", vac.notes].filter(Boolean).join("\n") || vac.position;
    setBusy("match");
    try {
      const r = await api.matchVacancy(cvDocToText(doc), `${vac.position}${vac.company ? ` @ ${vac.company}` : ""}`, jobText);
      setMatch(r);
      toast(r.offline ? "Базове порівняння (увімкни LLM для точного)" : "Порівняння готове", r.offline ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Помилка порівняння", "error");
    } finally {
      setBusy("");
    }
  };
  const doReview = async () => {
    const text = cvDocToText(doc);
    if (text.trim().length < 30) {
      toast("Заповни CV детальніше для аналізу", "error");
      return;
    }
    setBusy("review");
    try {
      const r = await api.reviewCV(text);
      setReview(r);
      toast(r.offline ? "Базовий аналіз (увімкни LLM для глибокого)" : "Аналіз готовий", r.offline ? "info" : "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Помилка аналізу", "error");
    } finally {
      setBusy("");
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
      toast("CV збережено", "success");
    } finally {
      setBusy("");
    }
  };
  const fromText = async () => {
    setBusy("gen");
    try {
      const r = await api.generateCvDoc(profile?.cvText || "");
      if (r.doc) setDoc(r.doc);
      toast(r.offline ? "AI офлайн — увімкни ключ" : "Розібрано з твого CV на секції", r.offline ? "info" : "success");
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
      toast("Профіль імпортовано з LinkedIn", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Помилка імпорту", "error");
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
        r.cvDoc ? "CV розібрано в конструктор і застосовано всюди" : "CV завантажено (увімкни LLM для авто-розбору на секції)",
        "success",
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Помилка завантаження", "error");
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
        title="Конструктор CV"
        subtitle="Структуроване резюме з фокусом на результатах. Заповни з наявного CV, відредагуй і експортуй у PDF."
        actions={
          <>
            <Btn
              variant="ghost"
              onClick={() => exportCvDoc(doc)}
              title="У вікні друку браузера дата/назва документа зверху сторінок вимкнені автоматично; якщо все ж з'являються — вимкни «Заголовки та підвали»"
            >
              ⬇️ PDF
            </Btn>
            <Btn onClick={save} disabled={busy === "save"}>
              {busy === "save" ? "…" : "💾 Зберегти"}
            </Btn>
          </>
        }
      />
      <Card className="!py-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Заповнити:</span>
          <label
            className={`inline-flex items-center gap-1.5 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer transition-colors ${busy === "upload" ? "bg-indigo-300 text-white" : "bg-indigo-600 text-white hover:bg-indigo-500"}`}
          >
            {busy === "upload" ? "⏳ Розбираю…" : "📎 З файлу CV"}
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
            {busy === "li" ? "⏳ Імпорт…" : "🔗 LinkedIn (.zip)"}
            <input
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              disabled={busy === "li"}
              onChange={(e) => importLinkedIn(e.target.files?.[0])}
            />
          </label>
          <Btn size="sm" variant="ghost" onClick={fromText} disabled={busy === "gen" || !llm}>
            {busy === "gen" ? "…" : "🪄 З тексту профілю (AI)"}
          </Btn>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
          <span className="text-xs font-semibold text-slate-500">AI-аналіз:</span>
          <Btn size="sm" variant="ghost" onClick={doReview} disabled={busy === "review"}>
            {busy === "review" ? "…" : "🔎 Поради"}
          </Btn>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
          <span className="text-xs font-semibold text-slate-500">🎯 Під вакансію:</span>
          {vacancies.length === 0 ? (
            <span className="text-xs text-slate-400">додай вакансії у трекер, щоб порівняти CV із ними</span>
          ) : (
            <>
              <select
                value={matchVacId}
                onChange={(e) => setMatchVacId(Number(e.target.value))}
                className="flex-1 min-w-[200px] bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value={0}>— обери вакансію —</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.position}
                    {v.company ? ` — ${v.company}` : ""}
                  </option>
                ))}
              </select>
              <Btn size="sm" onClick={doMatch} disabled={busy === "match" || !matchVacId}>
                {busy === "match" ? "…" : "Порівняти"}
              </Btn>
            </>
          )}
        </div>
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer select-none hover:text-slate-700 font-medium">Як експортувати .zip з LinkedIn?</summary>
          <div className="mt-1.5 text-slate-600">
            Зайди на LinkedIn → <b>Settings & Privacy → Data Privacy → Get a copy of your data</b> → обери «Want something in particular»
            (Profile, Positions, Skills, Education) → отримай архів на email → завантаж <b>.zip</b> кнопкою вище.
          </div>
        </details>
      </Card>
      {!dismissedSuggest && llm && !!profile?.cvText?.trim() && !doc.name && !doc.summary && doc.experience.length === 0 && (
        <Card className="!py-3 bg-amber-50 border-amber-200 flex items-center gap-3">
          <span className="text-lg">💡</span>
          <div className="text-sm text-slate-700 flex-1">
            У профілі вже є текст CV, а конструктор ще порожній. Розібрати його на секції автоматично?
          </div>
          <Btn size="sm" onClick={fromText} disabled={busy === "gen"}>
            {busy === "gen" ? "…" : "🪄 Розібрати CV"}
          </Btn>
          <Btn size="sm" variant="ghost" onClick={() => setDismissedSuggest(true)}>
            Пізніше
          </Btn>
        </Card>
      )}
      {match && (
        <div className="relative">
          <button
            onClick={() => setMatch(null)}
            title="Сховати"
            className="absolute right-3 top-3 z-10 text-slate-400 hover:text-slate-600 text-sm"
          >
            ✕
          </button>
          <CvMatchPanel
            match={match}
            onAddKeyword={addSkill}
            onApplySummary={(s) => {
              set({ summary: s });
              toast("Summary оновлено під вакансію", "success");
            }}
          />
        </div>
      )}
      {review && (
        <div className="relative">
          <button
            onClick={() => setReview(null)}
            title="Сховати аналіз"
            className="absolute right-3 top-3 z-10 text-slate-400 hover:text-slate-600 text-sm"
          >
            ✕
          </button>
          <CvReviewPanel review={review} onAddKeyword={addSkill} onApplyRewrite={applyRewrite} />
        </div>
      )}
      {/* grid-cols-1 (не просто "grid" без колонок) — важливо: Tailwind явно ставить
          `minmax(0, 1fr)`, тоді як "none" (дефолт implicit-грід без жодного `grid-cols-*`)
          дає track sizing "auto", який враховує min-content нащадків. Прев'ю CV рендерить
          iframe фіксованої "сторінкової" ширини 880px (PAGE_WIDTH у cv-preview-panel.tsx) і
          масштабує його лише візуально (CSS transform) — це фіксована пікселева ширина, яка
          на мобільних БЕЗ minmax(0,...) розтягувала б track (а з ним і всю колонку зі
          сторонніми картками зліва, бо в одноколонковому гріді всі рядки спільно ту саму
          ширину) до 880px і викликала горизонтальний скрол усієї сторінки. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-start">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Segmented
              value={tab}
              onChange={setTab}
              size="md"
              options={[
                { value: "content", label: "📝 Зміст" },
                { value: "design", label: "🎨 Дизайн" },
              ]}
            />
            <span className="text-xs text-slate-400">
              {tab === "content" ? "Текст резюме — прев'ю праворуч оновлюється одразу" : "Шаблон, колір, фото, порядок секцій і пресети"}
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
        {/* Права колонка — лише прев'ю, без нічого над ним: sticky й одразу у фокусі незалежно
            від того, яку вкладку зліва обрано (перемикання на "Дизайн" й далі видно результат). */}
        <div className="min-w-0 lg:sticky lg:top-6">
          <CvPreviewPanel doc={doc} onExport={() => exportCvDoc(doc)} />
        </div>
      </div>
    </div>
  );
}
