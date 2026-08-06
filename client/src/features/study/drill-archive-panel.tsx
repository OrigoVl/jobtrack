import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDeleteDrillArchiveEntry, useDrillArchive, useUpdateDrillArchiveEntry } from "../../shared/queries";
import type { DrillArchiveEntry } from "../../shared/types";
import { Btn, Card, Chip, Spinner } from "../../shared/ui";
import { useConfirm } from "../../shared/use-confirm";

function ArchiveItem({ entry }: { entry: DrillArchiveEntry }) {
  const { t } = useTranslation(["study", "common"]);
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState(entry.q);
  const [sol, setSol] = useState(entry.sol);
  const [exp, setExp] = useState(entry.exp);
  const updateMutation = useUpdateDrillArchiveEntry();
  const deleteMutation = useDeleteDrillArchiveEntry();
  const isSaving = updateMutation.isPending && updateMutation.variables?.id === entry.id;
  const isDeleting = deleteMutation.isPending && deleteMutation.variables === entry.id;

  const startEdit = () => {
    setQ(entry.q);
    setSol(entry.sol);
    setExp(entry.exp);
    setEditing(true);
  };
  const save = () => {
    if (!q.trim() || !sol.trim()) return;
    updateMutation.mutate({ id: entry.id, patch: { q: q.trim(), sol, exp } }, { onSuccess: () => setEditing(false) });
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
        <span className="text-sm text-ink flex-1 line-clamp-2">{entry.q}</span>
        <Chip>{entry.lvl}</Chip>
        {entry.generated && <Chip tone="indigo">{t("drill.aiTailored")}</Chip>}
        <span className="text-xs text-ink-dim shrink-0">{new Date(entry.solvedAt).toLocaleDateString()}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-grid bg-surface-2/50">
          {editing ? (
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-xs font-semibold text-ink-dim">{t("archive.questionLabel")}</div>
                <textarea
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full h-16 mt-1 bg-surface border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-dim">{t("archive.solution")}</div>
                <textarea
                  value={sol}
                  onChange={(e) => setSol(e.target.value)}
                  className="w-full h-24 mt-1 bg-surface border border-grid rounded-lg p-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-dim">{t("archive.explanationLabel")}</div>
                <textarea
                  value={exp}
                  onChange={(e) => setExp(e.target.value)}
                  className="w-full h-16 mt-1 bg-surface border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
                />
              </div>
              <div className="flex gap-2">
                <Btn size="sm" loading={isSaving} disabled={!q.trim() || !sol.trim()} onClick={save}>
                  {t("common:actions.save")}
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  {t("common:actions.cancel")}
                </Btn>
              </div>
            </div>
          ) : (
            <>
              <div className="text-xs uppercase tracking-wide text-signal font-bold mt-2">{entry.cat}</div>
              <div className="text-sm font-semibold mt-1 text-ink">{entry.q}</div>
              <div className="text-xs font-semibold text-ink-dim mt-3">{t("archive.solution")}</div>
              <pre className="mt-1 bg-surface border border-grid rounded-lg p-3 text-xs overflow-auto text-ink whitespace-pre-wrap">
                {entry.sol}
              </pre>
              {entry.exp && <div className="text-sm text-ink-dim mt-2">{entry.exp}</div>}
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

/** Expandable list of solved drills — full task + solution snapshot, survives generated-drill churn. */
export function DrillArchivePanel() {
  const { t } = useTranslation("study");
  const { data: archive = [] } = useDrillArchive();
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
        <ul className="mt-3 space-y-2 max-h-[420px] overflow-y-auto">
          {archive.map((entry) => (
            <ArchiveItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </Card>
  );
}
