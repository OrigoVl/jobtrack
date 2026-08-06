import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Card, CardsSkeleton, PageHeader } from "../../shared/ui";
import { useDesignCurrent, useDesignHistory, useGenerateDesignTask, useGradeDesign, useHealth } from "../../shared/queries";
import { useToast } from "../../shared/use-toast";
import { computeDesignLevel } from "../../shared/design-level";
import { DesignCanvas } from "./design-canvas";
import { DesignDefensePanel } from "./design-defense-panel";
import { DesignTaskCard } from "./design-task-card";
import { DesignGradeCard } from "./design-grade-card";
import { DesignHelpPanel } from "./design-help-panel";
import { DesignHistoryPanel } from "./design-history-panel";
import { DesignReferencePanel } from "./design-reference-panel";
import type { DesignDiagram, DesignGrade, DesignTask } from "../../shared/types";

const EMPTY_DIAGRAM: DesignDiagram = { nodes: [], edges: [] };

// `embedded` skips the page's own header — used when nested as a tab inside the Practice page
// (see study.tsx), same convention as mock/mock.tsx's MockInterview.
export function DesignTrainer({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation("design");
  const { data: current, isLoading } = useDesignCurrent();
  const { data: history = [] } = useDesignHistory();
  const designLevel = computeDesignLevel(history);
  const { data: health } = useHealth();
  const llm = health?.llm ?? false;
  const { toast } = useToast();
  const generateTask = useGenerateDesignTask();
  const gradeDesignMutation = useGradeDesign();

  const [task, setTask] = useState<DesignTask | null>(null);
  const [diagram, setDiagram] = useState<DesignDiagram>(EMPTY_DIAGRAM);
  const [grade, setGrade] = useState<DesignGrade | null>(null);
  // Bumped on "new task"/"clear" and passed as DesignCanvas's `key` — the only reset path (see
  // that component's own comment on why a prop change alone can't reset it mid-edit).
  const [canvasKey, setCanvasKey] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [showDefense, setShowDefense] = useState(false);

  // Hydrate local state from the persisted exercise exactly once, the first time it loads —
  // afterward this component owns the diagram (DesignCanvas's onChange), not the query cache.
  useEffect(() => {
    if (hydrated || isLoading) return;
    if (current) {
      setTask(current.task);
      setDiagram(current.diagram);
      setGrade(current.grade);
    }
    setHydrated(true);
  }, [current, isLoading, hydrated]);

  const onNewTask = async (vacancyId: number) => {
    const res = await generateTask.mutateAsync(vacancyId || undefined);
    if (res.offline || !res.task) {
      toast(t("task.offline"), "info");
      return;
    }
    setTask(res.task);
    setDiagram(EMPTY_DIAGRAM);
    setGrade(null);
    setCanvasKey((k) => k + 1);
    setShowDefense(false);
  };

  const onClear = () => {
    setDiagram(EMPTY_DIAGRAM);
    setGrade(null);
    setCanvasKey((k) => k + 1);
    setShowDefense(false);
  };

  const onCheck = async () => {
    if (!task) return;
    setShowDefense(false);
    setGrade(await gradeDesignMutation.mutateAsync({ task, diagram }));
  };

  if (isLoading) return <CardsSkeleton count={2} />;

  return (
    <div className="space-y-4">
      {!embedded && <PageHeader eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />}
      {designLevel && (
        <div className="text-sm text-ink-dim">
          <span className="text-ink font-medium">{t("level.heading", { level: designLevel.level })}</span>{" "}
          <span>{t("level.sample", { count: designLevel.sampleSize })}</span>
        </div>
      )}
      <DesignTaskCard task={task} hasDiagram={diagram.nodes.length > 0} loading={generateTask.isPending} onNewTask={onNewTask} />
      {task && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <span className="text-xs text-ink-dim">{t("canvas.deleteHint")}</span>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={onClear}>
                  {t("canvas.clear")}
                </Btn>
                <Btn size="sm" onClick={onCheck} loading={gradeDesignMutation.isPending} disabled={diagram.nodes.length === 0}>
                  {t("canvas.check")}
                </Btn>
              </div>
            </div>
            <DesignCanvas key={canvasKey} initialDiagram={diagram} onChange={setDiagram} />
          </Card>
          {grade && <DesignGradeCard grade={grade} />}
          {grade?.referenceNodes && grade.referenceNodes.length > 0 && (
            <DesignReferencePanel nodes={grade.referenceNodes} edges={grade.referenceEdges ?? []} />
          )}
          {grade && !showDefense && (
            <Btn variant="ghost" onClick={() => setShowDefense(true)}>
              {t("defense.trigger")}
            </Btn>
          )}
          {grade && showDefense && <DesignDefensePanel task={task} diagram={diagram} />}
          <DesignHelpPanel task={task} diagram={diagram} llm={llm} />
        </>
      )}
      <DesignHistoryPanel />
    </div>
  );
}
