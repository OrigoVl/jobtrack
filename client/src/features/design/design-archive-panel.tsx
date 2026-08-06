import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDeleteDesignArchiveEntry, useDesignArchive, useUpdateDesignArchiveEntry } from "../../shared/queries";
import type { DesignArchiveEntry } from "../../shared/types";
import { Btn, Card, Chip, Spinner } from "../../shared/ui";
import { useConfirm } from "../../shared/use-confirm";
import { DesignCanvas } from "./design-canvas";
import { DesignGradeCard } from "./design-grade-card";
import { DIFFICULTY_TONE, designDifficultyLabel } from "./design-difficulty";

const NOOP = () => {};

function ArchiveItem({ entry }: { entry: DesignArchiveEntry }) {
  const { t } = useTranslation(["design", "common"]);
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.task.title);
  const [scenario, setScenario] = useState(entry.task.scenario);
  const [summary, setSummary] = useState(entry.grade.summary);
  const [tip, setTip] = useState(entry.grade.tip);
  const updateMutation = useUpdateDesignArchiveEntry();
  const deleteMutation = useDeleteDesignArchiveEntry();
  const isSaving = updateMutation.isPending && updateMutation.variables?.id === entry.id;
  const isDeleting = deleteMutation.isPending && deleteMutation.variables === entry.id;

  const startEdit = () => {
    setTitle(entry.task.title);
    setScenario(entry.task.scenario);
    setSummary(entry.grade.summary);
    setTip(entry.grade.tip);
    setEditing(true);
  };
  const save = () => {
    if (!title.trim()) return;
    updateMutation.mutate({ id: entry.id, patch: { title: title.trim(), scenario, summary, tip } }, { onSuccess: () => setEditing(false) });
  };
  const del = async () => {
    if (await confirm({ title: t("archive.deleteConfirmTitle") })) deleteMutation.mutate(entry.id);
  };

  return (
    <li className="border border-grid rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-2 transition-colors"
      >
        <span className="text-sm text-ink flex-1 line-clamp-2">{entry.task.title}</span>
        <Chip tone={DIFFICULTY_TONE[entry.task.difficulty]}>{designDifficultyLabel(entry.task.difficulty)}</Chip>
        <span className="text-xs font-mono font-semibold text-ink-dim shrink-0">{entry.grade.score}</span>
        <span className="text-xs text-ink-dim shrink-0">{new Date(entry.gradedAt).toLocaleDateString()}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-grid bg-surface-2/50">
          {editing ? (
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-xs font-semibold text-ink-dim">{t("archive.titleLabel")}</div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 bg-surface border border-grid rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-dim">{t("archive.scenarioLabel")}</div>
                <textarea
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="w-full h-20 mt-1 bg-surface border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-dim">{t("archive.summaryLabel")}</div>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full h-16 mt-1 bg-surface border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-dim">{t("archive.tipLabel")}</div>
                <textarea
                  value={tip}
                  onChange={(e) => setTip(e.target.value)}
                  className="w-full h-16 mt-1 bg-surface border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </div>
              <div className="flex gap-2">
                <Btn size="sm" loading={isSaving} disabled={!title.trim()} onClick={save}>
                  {t("common:actions.save")}
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  {t("common:actions.cancel")}
                </Btn>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold mt-2 text-ink">{entry.task.title}</div>
              {entry.task.scenario && (
                <div className="mt-1.5">
                  <div className="text-xs font-semibold text-ink-dim">{t("archive.scenario")}</div>
                  <div className="text-sm text-ink mt-0.5">{entry.task.scenario}</div>
                </div>
              )}
              {entry.diagram.nodes.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-ink-dim mb-1">{t("archive.diagram")}</div>
                  <DesignCanvas initialDiagram={entry.diagram} onChange={NOOP} heightClass="h-[30vh]" readOnly />
                </div>
              )}
              <DesignGradeCard grade={entry.grade} />
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <Btn size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  {t("archive.collapse")}
                </Btn>
                <button onClick={startEdit} className="text-xs text-ink-dim hover:text-signal px-1.5 py-1">
                  {t("common:actions.edit")}
                </button>
                <button
                  onClick={del}
                  disabled={isDeleting}
                  className="text-xs text-ink-dim hover:text-rose-600 px-1.5 py-1 disabled:opacity-50"
                >
                  {isDeleting ? <Spinner className="h-3 w-3" /> : t("common:actions.delete")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** Expandable list of graded design exercises — full task + diagram + grade snapshot, unlike
 * DesignHistoryPanel's lightweight score-only log. */
export function DesignArchivePanel() {
  const { t } = useTranslation("design");
  const { data: archive = [] } = useDesignArchive();
  const [panelOpen, setPanelOpen] = useState(false);
  if (archive.length === 0) return null;
  return (
    <Card>
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-sm font-semibold text-ink"
      >
        <span>{t("archive.heading", { count: archive.length })}</span>
        <span className="text-xs text-ink-dim ml-auto">{panelOpen ? "▾" : "▸"}</span>
      </button>
      {panelOpen && (
        <ul className="mt-3 space-y-2 max-h-[600px] overflow-y-auto">
          {archive.map((entry) => (
            <ArchiveItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </Card>
  );
}
