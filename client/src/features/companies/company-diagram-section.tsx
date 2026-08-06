import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Skeleton } from "../../shared/ui";
import { useCompanyDiagram, useSaveCompanyDiagram } from "../../shared/queries";
import { DesignCanvas } from "../design/design-canvas";
import type { DesignDiagram } from "../../shared/types";

const EMPTY_DIAGRAM: DesignDiagram = { nodes: [], edges: [] };

/** A freeform architecture diagram attached to a company ("here's how their system works, from
 * what I learned in the interview") — reuses the trainer's canvas with no task/grading. Collapsed
 * by default (gates the fetch, see useCompanyDiagram's `enabled`), explicit Save button (not the
 * trainer's live-onChange auto-persist — that fires on every drag tick, which would POST-storm a
 * real save endpoint here). */
export function CompanyDiagramSection({ companyId, companyName }: { companyId: number; companyName: string }) {
  const { t } = useTranslation("companies");
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useCompanyDiagram(companyId, open);
  const saveMutation = useSaveCompanyDiagram(companyId);
  const [diagram, setDiagram] = useState<DesignDiagram>(EMPTY_DIAGRAM);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!open || hydrated || isLoading) return;
    setDiagram(data ?? EMPTY_DIAGRAM);
    setHydrated(true);
  }, [open, hydrated, isLoading, data]);

  return (
    <div className="mt-3 pt-2 border-t border-grid">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t(open ? "diagram.hideFor" : "diagram.showFor", { name: companyName })}
        className="text-xs font-medium text-ink-dim hover:text-signal"
      >
        {open ? t("diagram.hide") : t("diagram.show")}
      </button>
      {open &&
        (hydrated ? (
          <div className="mt-2 space-y-2">
            <DesignCanvas initialDiagram={diagram} onChange={setDiagram} heightClass="h-[40vh]" />
            <div className="flex justify-end">
              <Btn size="sm" onClick={() => saveMutation.mutate(diagram)} loading={saveMutation.isPending}>
                {t("diagram.save")}
              </Btn>
            </div>
          </div>
        ) : (
          <Skeleton className="h-40 mt-2" />
        ))}
    </div>
  );
}
