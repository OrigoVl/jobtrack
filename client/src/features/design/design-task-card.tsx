import { useTranslation } from "react-i18next";
import { Btn, Card, Chip, EmptyState, Select } from "../../shared/ui";
import { useConfirm } from "../../shared/use-confirm";
import { useUi } from "../../shared/ui-state";
import { useVacancies } from "../../shared/queries";
import type { DesignTask } from "../../shared/types";

const DIFFICULTY_TONE = { easy: "good", medium: "amber", hard: "rose" } as const;

// Vacancy picker mirrors mock/voice-interview.tsx's exactly (0 = general, positive id = tailored)
// — same useUi persistence convention, own key so it doesn't collide with the mock tab's.
function VacancyPicker({ vacancyId, onChange }: { vacancyId: number; onChange: (id: number) => void }) {
  const { t } = useTranslation("design");
  const { data: vacancies = [] } = useVacancies();
  return (
    <Select value={vacancyId} onChange={(e) => onChange(Number(e.target.value))} aria-label={t("task.vacancyLabel")}>
      <option value={0}>{t("task.generalOption")}</option>
      {vacancies.map((v) => (
        <option key={v.id} value={v.id}>
          {v.position}
          {v.company ? ` — ${v.company}` : ""}
        </option>
      ))}
    </Select>
  );
}

export function DesignTaskCard({
  task,
  hasDiagram,
  loading,
  onNewTask,
}: {
  task: DesignTask | null;
  hasDiagram: boolean;
  loading: boolean;
  onNewTask: (vacancyId: number) => void;
}) {
  const { t } = useTranslation("design");
  const confirm = useConfirm();
  const [vacancyId, setVacancyId] = useUi("design.vacancyId", 0);

  const requestNewTask = async () => {
    if (hasDiagram) {
      const ok = await confirm({
        title: t("task.confirmNew.title"),
        message: t("task.confirmNew.message"),
        confirmLabel: t("task.confirmNew.confirmLabel"),
        tone: "primary",
      });
      if (!ok) return;
    }
    onNewTask(vacancyId);
  };

  if (!task) {
    return (
      <Card>
        <EmptyState
          title={t("task.empty.title")}
          hint={t("task.empty.hint")}
          action={
            <div className="flex items-center gap-2 justify-center flex-wrap">
              <VacancyPicker vacancyId={vacancyId} onChange={setVacancyId} />
              <Btn onClick={requestNewTask} loading={loading}>
                {t("task.newTask")}
              </Btn>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">{task.title}</span>
            <Chip tone={DIFFICULTY_TONE[task.difficulty]}>{t(`task.difficulty.${task.difficulty}`)}</Chip>
          </div>
          <p className="text-sm text-ink-dim mt-1">{task.scenario}</p>
        </div>
        <div className="flex items-center gap-2">
          <VacancyPicker vacancyId={vacancyId} onChange={setVacancyId} />
          <Btn size="sm" variant="ghost" onClick={requestNewTask} loading={loading}>
            {t("task.newTask")}
          </Btn>
        </div>
      </div>
      {task.requirements.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-ink-dim">{t("task.requirements")}</div>
          <ul className="list-disc pl-5 text-sm text-ink">
            {task.requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {task.constraints.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-semibold text-ink-dim">{t("task.constraints")}</div>
          <ul className="list-disc pl-5 text-sm text-ink">
            {task.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
