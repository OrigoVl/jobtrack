import { useEffect, useRef, useState } from "react";
import { api } from "../../shared/api";
import { useStore, useUi } from "../../shared/store";
import { Btn, Card, CardsSkeleton, PageHeader, Segmented, Section } from "../../shared/ui";
import type { CvDoc, CvExperience, CvLanguage, CvMatch, CvPreset, CvReview, CvSection, CvTheme } from "../../shared/types";
import { Field } from "../../shared/view-kit";
import { CvMatchPanel, CvReviewPanel } from "./cv";

/* ---------- CV Builder ---------- */
const SECTION_LABELS: [CvSection, string][] = [
  ["summary", "Профіль"],
  ["skills", "Навички"],
  ["experience", "Досвід"],
  ["projects", "Проєкти"],
  ["education", "Освіта"],
  ["languages", "Мови"],
];
const DEFAULT_ORDER: CvSection[] = SECTION_LABELS.map(([k]) => k);
const DEFAULT_THEME: CvTheme = {
  template: "classic",
  accent: "#4f46e5",
  font: "sans",
  scale: 1,
  order: DEFAULT_ORDER,
  showPhoto: true,
  photoShape: "circle",
  photoPos: "left",
};
function themeOf(doc: CvDoc): CvTheme {
  return { ...DEFAULT_THEME, ...(doc.theme || {}) };
}
function buildCvHtml(doc: CvDoc): string {
  const t = themeOf(doc);
  const esc = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const list = (arr: string[]) =>
    arr
      .filter(Boolean)
      .map((x) => `<li>${esc(x)}</li>`)
      .join("");
  const H = (title: string) => `<h2>${esc(title)}</h2>`;
  const exp = doc.experience
    .map(
      (e) =>
        `<div class="exp"><div class="row"><span class="role">${esc(e.role)}</span><span class="period">${esc(e.period)}</span></div>` +
        `<div class="company">${esc(e.company)}</div>${e.bullets.filter(Boolean).length ? `<ul>${list(e.bullets)}</ul>` : ""}</div>`,
    )
    .join("");
  const photoImg = doc.photo && t.showPhoto !== false ? `<img class="photo" src="${doc.photo}" alt="Фото"/>` : "";
  const hmeta = `<div class="hmeta"><h1>${esc(doc.name)}</h1><div class="title">${esc(doc.title)}</div><div class="contact">${esc(doc.contact)}</div></div>`;
  const langs = (doc.languages || []).filter((l) => l && l.name);
  const useInline = t.template === "compact" || t.template === "academic";
  const secSkillsChips = doc.skills.length
    ? `${H("Навички")}<div class="chips">${doc.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>`
    : "";
  const secSkillsInline = doc.skills.length ? `${H("Навички")}<p>${doc.skills.map(esc).join(" · ")}</p>` : "";
  const sec: Record<string, string> = {
    summary: doc.summary ? `${H("Профіль")}<p>${esc(doc.summary)}</p>` : "",
    skills: useInline ? secSkillsInline : secSkillsChips,
    experience: doc.experience.length ? `${H("Досвід")}${exp}` : "",
    projects: doc.projects.filter(Boolean).length ? `${H("Проєкти")}<ul>${list(doc.projects)}</ul>` : "",
    education: doc.education.filter(Boolean).length ? `${H("Освіта")}<ul>${list(doc.education)}</ul>` : "",
    languages: langs.length
      ? `${H("Мови")}<ul>${langs.map((l) => `<li>${esc(l.name)}${l.level ? ` — <span class="lvl">${esc(l.level)}</span>` : ""}</li>`).join("")}</ul>`
      : "",
  };
  const order = (t.order && t.order.length ? t.order : ["summary", "skills", "experience", "projects", "education", "languages"]).filter(
    (k) => k in sec,
  );
  const pick = (keys: string[]) =>
    order
      .filter((k) => keys.includes(k))
      .map((k) => sec[k])
      .join("");
  const font = t.font === "serif" ? "Georgia, 'Times New Roman', serif" : "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const fs = 14 * t.scale;
  const compact = t.template === "compact";
  const gap = compact ? "9px" : "16px";
  const px = (n: number) => `${n.toFixed(1)}px`;
  let layout = "";
  let extraCss = "";
  const headerRow = `<header class="hrow">${photoImg}${hmeta}</header>`;
  if (t.template === "twocol") {
    const aside = `${photoImg}${pick(["skills", "languages", "education"])}`;
    const main = pick(["summary", "experience", "projects"]);
    layout = `<header class="hrow">${hmeta}</header><div class="cols"><aside>${aside}</aside><main>${main}</main></div>`;
    extraCss =
      ".cols{display:flex;gap:26px" +
      (t.photoPos === "right" ? ";flex-direction:row-reverse" : "") +
      "}aside{width:33%}main{flex:1;min-width:0}aside .photo{display:block;margin:0 auto 12px;width:" +
      px(fs * 7) +
      ";height:" +
      px(fs * 7) +
      "}";
  } else if (t.template === "academic") {
    layout = `${headerRow}${pick(["summary", "experience", "projects", "education", "skills", "languages"])}`;
    extraCss =
      "header.hrow{flex-direction:column;text-align:center;border-bottom:2px solid " +
      t.accent +
      "22;padding-bottom:12px}header .photo{margin:0 auto 6px}";
  } else {
    layout = `${headerRow}${pick(order)}`;
  }
  const css =
    `*{box-sizing:border-box}` +
    `body{font-family:${font};font-size:${px(fs)};line-height:${compact ? 1.4 : 1.55};color:#1e293b;max-width:820px;margin:28px auto;padding:0 30px}` +
    `header{margin-bottom:${gap}}h1{font-size:${px(fs * 1.9)};margin:0;color:#0f172a}` +
    `.hrow{display:flex;align-items:center;gap:18px${t.photoPos === "right" ? ";flex-direction:row-reverse" : ""}}.hmeta{min-width:0}` +
    `.photo{width:${px(fs * 6.4)};height:${px(fs * 6.4)};border-radius:${t.photoShape === "square" ? px(fs * 0.85) : "50%"};object-fit:cover;border:3px solid ${t.accent}33;flex:0 0 auto}` +
    `.lvl{color:${t.accent}}` +
    `.title{color:${t.accent};font-weight:600;font-size:${px(fs * 1.15)};margin-top:2px}` +
    `.contact{color:#64748b;font-size:${px(fs * 0.9)};margin-top:4px}` +
    `h2{font-size:${px(fs * 0.92)};text-transform:uppercase;letter-spacing:.06em;color:${t.accent};border-bottom:2px solid ${t.accent}22;padding-bottom:3px;margin:${gap} 0 8px}` +
    `p{margin:0 0 8px}.exp{margin-bottom:${compact ? "8px" : "12px"}}` +
    `.row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}` +
    `.role{font-weight:700;color:#0f172a}.period{color:#94a3b8;font-size:${px(fs * 0.85)};white-space:nowrap}` +
    `.company{color:#64748b;font-size:${px(fs * 0.9)}}ul{margin:4px 0;padding-left:18px}li{margin:2px 0}` +
    `.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{background:${t.accent}14;color:${t.accent};border:1px solid ${t.accent}33;border-radius:6px;padding:2px 8px;font-size:${px(fs * 0.85)}}` +
    extraCss +
    `@media print{body{margin:0;max-width:none}}`;
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>${esc(doc.name || "CV")}</title><style>${css}</style></head><body>${layout}</body></html>`;
}
function exportCvDoc(doc: CvDoc): void {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Дозволь спливаючі вікна, щоб експортувати PDF.");
    return;
  }
  w.document.write(buildCvHtml(doc));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}
function cvDocToText(doc: CvDoc): string {
  const lines: string[] = [];
  if (doc.name) lines.push(doc.name);
  if (doc.title) lines.push(doc.title);
  if (doc.contact) lines.push(doc.contact);
  if (doc.summary) lines.push(`\nПрофіль:\n${doc.summary}`);
  if (doc.skills.length) lines.push(`\nНавички: ${doc.skills.join(", ")}`);
  if (doc.experience.length) {
    lines.push("\nДосвід:");
    doc.experience.forEach((e) => {
      lines.push(`${e.role} — ${e.company} (${e.period})`);
      e.bullets.filter(Boolean).forEach((b) => lines.push(`- ${b}`));
    });
  }
  const projects = doc.projects.filter(Boolean);
  if (projects.length) lines.push(`\nПроєкти:\n${projects.join("\n")}`);
  const education = doc.education.filter(Boolean);
  if (education.length) lines.push(`\nОсвіта:\n${education.join("\n")}`);
  const langs = (doc.languages || []).filter((l) => l.name);
  if (langs.length) lines.push(`\nМови: ${langs.map((l) => `${l.name} (${l.level})`).join(", ")}`);
  return lines.join("\n");
}
const CROP_VIEWPORT = 260;
const CROP_OUTPUT = 400;
function PhotoCropper({ src, onCancel, onDone }: { src: string; onCancel: () => void; onDone: (dataUrl: string) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);
  const baseScale = img ? CROP_VIEWPORT / Math.min(img.width, img.height) : 1;
  const dispScale = baseScale * zoom;
  const dispW = img ? img.width * dispScale : 0;
  const dispH = img ? img.height * dispScale : 0;
  const clamp = (o: { x: number; y: number }) => {
    const maxX = Math.max(0, (dispW - CROP_VIEWPORT) / 2);
    const maxY = Math.max(0, (dispH - CROP_VIEWPORT) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  };
  useEffect(() => {
    setOffset((o) => ({
      x: Math.min(Math.max(0, (dispW - CROP_VIEWPORT) / 2), Math.max(-Math.max(0, (dispW - CROP_VIEWPORT) / 2), o.x)),
      y: Math.min(Math.max(0, (dispH - CROP_VIEWPORT) / 2), Math.max(-Math.max(0, (dispH - CROP_VIEWPORT) / 2), o.y)),
    }));
  }, [zoom, img, dispW, dispH]);
  const left = CROP_VIEWPORT / 2 - dispW / 2 + offset.x;
  const top = CROP_VIEWPORT / 2 - dispH / 2 + offset.y;
  const confirm = () => {
    if (!img) return;
    const k = CROP_OUTPUT / CROP_VIEWPORT;
    const canvas = document.createElement("canvas");
    canvas.width = CROP_OUTPUT;
    canvas.height = CROP_OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, left * k, top * k, dispW * k, dispH * k);
    onDone(canvas.toDataURL("image/jpeg", 0.9));
  };
  const nudge = (dx: number, dy: number) => setOffset(clamp({ x: offset.x + dx, y: offset.y + dy }));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" aria-label="Закрити" onClick={onCancel} className="fixed inset-0 bg-slate-900/50 cursor-default" />
      <div className="relative bg-white rounded-2xl p-5 shadow-xl w-[320px] space-y-3">
        <div className="text-sm font-semibold text-slate-800">Кадрувати фото</div>
        <div
          role="button"
          tabIndex={0}
          aria-label="Перетягни або керуй стрілками, щоб позиціонувати фото"
          className="relative mx-auto rounded-full overflow-hidden bg-slate-100 border border-slate-200 touch-none cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          style={{ width: CROP_VIEWPORT, height: CROP_VIEWPORT }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            const step = 8;
            if (e.key === "ArrowLeft") nudge(step, 0);
            else if (e.key === "ArrowRight") nudge(-step, 0);
            else if (e.key === "ArrowUp") nudge(0, step);
            else if (e.key === "ArrowDown") nudge(0, -step);
            else return;
            e.preventDefault();
          }}
        >
          {img && (
            <img
              src={src}
              draggable={false}
              alt=""
              style={{ position: "absolute", left, top, width: dispW, height: dispH, maxWidth: "none", userSelect: "none" }}
            />
          )}
        </div>
        <label className="block text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Масштаб</span>
            <span className="text-slate-400">{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Масштаб фото"
            className="w-full mt-1 accent-indigo-600"
          />
        </label>
        <div className="text-[11px] text-slate-400 text-center">Перетягни, щоб позиціонувати</div>
        <div className="flex gap-2 justify-end">
          <Btn size="sm" variant="ghost" onClick={onCancel}>
            Скасувати
          </Btn>
          <Btn size="sm" onClick={confirm} disabled={!img}>
            Готово
          </Btn>
        </div>
      </div>
    </div>
  );
}
export function CvBuilder({ llm }: { llm: boolean }) {
  const { profile, toast, applyCvUpload, vacancies } = useStore();
  const [doc, setDoc] = useState<CvDoc | null>(null);
  const [busy, setBusy] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [secDrag, setSecDrag] = useState<number | null>(null);
  const [presets, setPresets] = useState<CvPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [review, setReview] = useUi<CvReview | null>("cvbuilder.review", null);
  const [match, setMatch] = useUi<CvMatch | null>("cvbuilder.match", null);
  const [matchVacId, setMatchVacId] = useUi<number>("cvbuilder.matchVac", 0);
  const [dismissedSuggest, setDismissedSuggest] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
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
  const setLang = (i: number, p: Partial<CvLanguage>) => set({ languages: langs.map((l, idx) => (idx === i ? { ...l, ...p } : l)) });
  const pickPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Обери файл зображення (PNG/JPG)", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast("Зображення завелике (макс 8 МБ)", "error");
      return;
    }
    setCropSrc(URL.createObjectURL(file));
  };
  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };
  const templateLabel = ({ classic: "Класичний", compact: "Компактний", academic: "Академічний", twocol: "Дві колонки" } as const)[
    theme.template
  ];
  return (
    <div className="space-y-4">
      <PageHeader
        title="Конструктор CV"
        subtitle="Структуроване резюме з фокусом на результатах. Заповни з наявного CV, відредагуй і експортуй у PDF."
        actions={
          <>
            <Btn variant="ghost" onClick={() => exportCvDoc(doc)}>
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
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-3">
          <Card className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ім'я" value={doc.name} onChange={(v) => set({ name: v })} placeholder="Michael Voloshyn" maxLength={120} />
              <Field
                label="Роль / посада"
                value={doc.title}
                onChange={(v) => set({ title: v })}
                placeholder="Full-Stack Developer"
                maxLength={160}
              />
            </div>
            <Field
              label="Контакти"
              value={doc.contact}
              onChange={(v) => set({ contact: v })}
              placeholder="email · LinkedIn · GitHub"
              maxLength={400}
            />
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                Підсумок (summary)
                <Btn size="sm" variant="ghost" onClick={improveSummary} disabled={busy === "sum" || !llm || !doc.summary.trim()}>
                  {busy === "sum" ? "…" : "✨ покращити"}
                </Btn>
              </span>
              <textarea
                value={doc.summary}
                onChange={(e) => set({ summary: e.target.value })}
                className="w-full mt-0.5 h-20 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </label>
            <Field
              label="Навички (через кому)"
              value={doc.skills.join(", ")}
              onChange={(v) =>
                set({
                  skills: v
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Card>
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Досвід</span>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => set({ experience: [...doc.experience, { role: "", company: "", period: "", bullets: [] }] })}
              >
                + Додати
              </Btn>
            </div>
            {doc.experience.map((e, i) => (
              <div
                key={i}
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={() => {
                  if (dragIdx !== null) moveExp(dragIdx, i);
                  setDragIdx(null);
                }}
                className={`rounded-lg border p-2.5 space-y-2 transition-colors ${dragIdx === i ? "border-indigo-400 bg-indigo-50/40" : "border-slate-200"}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragEnd={() => setDragIdx(null)}
                    title="Перетягни, щоб змінити порядок"
                    className="cursor-grab active:cursor-grabbing select-none text-slate-400 hover:text-slate-600 text-lg leading-none"
                  >
                    ⠿
                  </span>
                  <span className="text-xs text-slate-400">Запис {i + 1}</span>
                  <div className="ml-auto flex gap-1">
                    <Btn size="sm" variant="subtle" onClick={() => moveExp(i, i - 1)} disabled={i === 0}>
                      ↑
                    </Btn>
                    <Btn size="sm" variant="subtle" onClick={() => moveExp(i, i + 1)} disabled={i === doc.experience.length - 1}>
                      ↓
                    </Btn>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Роль" value={e.role} onChange={(v) => setExp(i, { role: v })} maxLength={160} />
                  <Field label="Компанія" value={e.company} onChange={(v) => setExp(i, { company: v })} maxLength={160} />
                  <Field
                    label="Період"
                    value={e.period}
                    onChange={(v) => setExp(i, { period: v })}
                    placeholder="2022 — зараз"
                    maxLength={60}
                  />
                </div>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                    Пункти (по одному на рядок)
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => improveBullets(i)}
                      disabled={busy === `b${i}` || !llm || e.bullets.filter(Boolean).length === 0}
                    >
                      {busy === `b${i}` ? "…" : "✨ результат-фокус"}
                    </Btn>
                  </span>
                  <textarea
                    value={e.bullets.join("\n")}
                    onChange={(ev) => setExp(i, { bullets: ev.target.value.split("\n") })}
                    className="w-full mt-0.5 h-24 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </label>
                <Btn size="sm" variant="danger" onClick={() => set({ experience: doc.experience.filter((_, idx) => idx !== i) })}>
                  Видалити
                </Btn>
              </div>
            ))}
          </Card>
          <Card className="space-y-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Проєкти (по одному на рядок)</span>
              <textarea
                value={doc.projects.join("\n")}
                onChange={(e) => set({ projects: e.target.value.split("\n") })}
                className="w-full mt-0.5 h-16 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500">Освіта (по одному на рядок)</span>
              <textarea
                value={doc.education.join("\n")}
                onChange={(e) => set({ education: e.target.value.split("\n") })}
                className="w-full mt-0.5 h-16 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </label>
          </Card>
          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Мови</span>
              <Btn size="sm" variant="ghost" onClick={() => set({ languages: [...langs, { name: "", level: "B2" }] })}>
                + Додати мову
              </Btn>
            </div>
            {langs.length === 0 && (
              <div className="text-xs text-slate-400">Додай мови й рівень володіння — вони з’являться окремою секцією в CV.</div>
            )}
            {langs.map((l, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Field
                    label={`Мова ${i + 1}`}
                    value={l.name}
                    onChange={(v) => setLang(i, { name: v })}
                    placeholder="English"
                    maxLength={60}
                  />
                </div>
                <label className="block w-40">
                  <span className="text-xs font-semibold text-slate-500">Рівень</span>
                  <select
                    value={l.level}
                    onChange={(e) => setLang(i, { level: e.target.value })}
                    className="w-full mt-0.5 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {["A1", "A2", "B1", "B2", "C1", "C2", "Рідна", "Розмовний"].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </label>
                <Btn size="sm" variant="danger" onClick={() => set({ languages: langs.filter((_, idx) => idx !== i) })}>
                  ✕
                </Btn>
              </div>
            ))}
          </Card>
        </div>
        <div className="lg:sticky lg:top-6 space-y-3">
          <div className="space-y-2">
            <Section title="Шаблон" icon="🧩" defaultOpen hint={templateLabel}>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["classic", "Класичний"],
                    ["compact", "Компактний"],
                    ["academic", "Академічний"],
                    ["twocol", "Дві колонки"],
                  ] as [CvTheme["template"], string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTheme({ template: id })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${theme.template === id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Стиль" icon="🎨" hint={`${theme.font === "serif" ? "Serif" : "Sans"} · ${Math.round(theme.scale * 100)}%`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Акцент
                  <input
                    type="color"
                    value={theme.accent}
                    onChange={(e) => setTheme({ accent: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-200 bg-white p-0.5"
                  />
                </label>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  Шрифт
                  <Segmented
                    value={theme.font}
                    onChange={(v) => setTheme({ font: v })}
                    options={[
                      { value: "sans", label: "Sans" },
                      { value: "serif", label: "Serif" },
                    ]}
                  />
                </div>
              </div>
              <label className="block text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>Масштаб тексту</span>
                  <span className="text-slate-400">{Math.round(theme.scale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.3}
                  step={0.05}
                  value={theme.scale}
                  onChange={(e) => setTheme({ scale: Number(e.target.value) })}
                  aria-label="Масштаб тексту"
                  className="w-full mt-1 accent-indigo-600"
                />
              </label>
            </Section>
            <Section title="Фото" icon="🖼" hint={doc.photo ? (theme.showPhoto === false ? "приховано" : "додано") : "немає"}>
              <div className="flex items-center gap-3">
                {doc.photo ? (
                  <img
                    src={doc.photo}
                    alt="Фото"
                    className={`w-16 h-16 object-cover border-2 border-indigo-200 ${theme.photoShape === "square" ? "rounded-lg" : "rounded-full"}`}
                  />
                ) : (
                  <div
                    className={`w-16 h-16 bg-slate-100 border-2 border-dashed border-slate-300 grid place-items-center text-slate-400 text-xl ${theme.photoShape === "square" ? "rounded-lg" : "rounded-full"}`}
                  >
                    👤
                  </div>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  <label className="inline-flex items-center gap-1 rounded-lg font-semibold px-3 py-1.5 text-xs cursor-pointer bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200">
                    {doc.photo ? "🔄 Змінити" : "🖼 Додати"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        pickPhoto(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {doc.photo && (
                    <Btn size="sm" variant="danger" onClick={() => set({ photo: "" })}>
                      Прибрати
                    </Btn>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>Форма</span>
                <Segmented
                  value={theme.photoShape ?? "circle"}
                  onChange={(v) => setTheme({ photoShape: v })}
                  options={[
                    { value: "circle", label: "● Коло" },
                    { value: "square", label: "■ Квадрат" },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>Позиція</span>
                <Segmented
                  value={theme.photoPos ?? "left"}
                  onChange={(v) => setTheme({ photoPos: v })}
                  options={[
                    { value: "left", label: "← Ліво" },
                    { value: "right", label: "Право →" },
                  ]}
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={theme.showPhoto !== false}
                  onChange={(e) => setTheme({ showPhoto: e.target.checked })}
                  className="accent-indigo-600"
                />
                Показувати фото в PDF
              </label>
            </Section>
            <Section title="Порядок секцій" icon="↕️">
              <div className="flex flex-col gap-1">
                {sectionOrder.map((key, i) => {
                  const label = SECTION_LABELS.find(([k]) => k === key)?.[1] ?? key;
                  return (
                    <div
                      key={key}
                      onDragOver={(ev) => ev.preventDefault()}
                      onDrop={() => {
                        if (secDrag !== null) moveSection(secDrag, i);
                        setSecDrag(null);
                      }}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm transition-colors ${secDrag === i ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200 bg-slate-50"}`}
                    >
                      <span
                        draggable
                        onDragStart={() => setSecDrag(i)}
                        onDragEnd={() => setSecDrag(null)}
                        title="Перетягни, щоб змінити порядок"
                        className="cursor-grab active:cursor-grabbing select-none text-slate-400 hover:text-slate-600"
                      >
                        ⠿
                      </span>
                      <span className="text-slate-700">{label}</span>
                      <div className="ml-auto flex gap-1">
                        <Btn size="sm" variant="subtle" onClick={() => moveSection(i, i - 1)} disabled={i === 0}>
                          ↑
                        </Btn>
                        <Btn size="sm" variant="subtle" onClick={() => moveSection(i, i + 1)} disabled={i === sectionOrder.length - 1}>
                          ↓
                        </Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-400">
                У «Двох колонках» Навички/Мови/Освіта — у бічній колонці, решта — в основній.
              </div>
            </Section>
            <Section title="Пресети" icon="💾" hint={presets.length ? `${presets.length} збережено` : undefined}>
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <span
                      key={p.name}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 pl-2.5 pr-1 py-0.5 text-xs"
                    >
                      <button onClick={() => applyPreset(p)} className="text-slate-700 hover:text-indigo-600 font-medium">
                        {p.name}
                      </button>
                      <button
                        onClick={() => deletePreset(p.name)}
                        title="Видалити"
                        className="text-slate-400 hover:text-rose-500 leading-none px-1"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={presetName}
                  maxLength={40}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && savePreset()}
                  placeholder="напр. Мій синій компакт"
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <Btn size="sm" onClick={savePreset} disabled={busy === "preset"}>
                  {busy === "preset" ? "…" : "Зберегти"}
                </Btn>
              </div>
              <div className="text-[11px] text-slate-400">
                Пресет запам'ятовує шаблон, колір, шрифт, масштаб, фото-стиль і порядок секцій.
              </div>
            </Section>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Прев'ю (як у PDF)</span>
              <Btn size="sm" variant="ghost" onClick={() => exportCvDoc(doc)}>
                ⬇️ PDF
              </Btn>
            </div>
            <iframe title="CV preview" srcDoc={buildCvHtml(doc)} className="w-full h-[78vh] bg-white border-0" />
          </Card>
        </div>
      </div>
      {cropSrc && (
        <PhotoCropper
          src={cropSrc}
          onCancel={closeCrop}
          onDone={(dataUrl) => {
            set({ photo: dataUrl });
            closeCrop();
            toast("Фото додано", "success");
          }}
        />
      )}
    </div>
  );
}
