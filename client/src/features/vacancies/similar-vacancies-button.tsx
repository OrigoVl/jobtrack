import { useTranslation } from "react-i18next";
import { usePopover } from "../../shared/use-popover";
import { PopoverPanel } from "../../shared/popover";
import { useSimilarVacancies } from "../../shared/queries/vacancies";
import { LinkIcon } from "../../shared/icons";

// Matches CalendarPanel's own `w-64` — see date-input.tsx's identical comment: only used to keep
// the popover inside the viewport (usePopover's computeCoords below), not for layout.
const PANEL_WIDTH = 256;

/**
 * A small "similar" toggle that lazily fetches GET /vacancies/:id/similar (pgvector cosine
 * similarity, see server/src/modules/vacancies/vacancies.repo.ts#findSimilarVacancies) the first
 * time it's opened — never eagerly for every row, see queries/vacancies.ts#useSimilarVacancies.
 * Renders nothing extra when the list comes back empty (offline, or no other vacancy is close
 * enough yet) beyond a small "nothing found" line — this is a lightweight recommendation, not a
 * page of its own.
 */
export function SimilarVacanciesButton({ vacancyId }: { vacancyId: number }) {
  const { t } = useTranslation(["vacancies", "common"]);
  const { open, setOpen, anchorRef, panelRef, coords } = usePopover((rect) => ({
    top: rect.bottom + 4,
    left: Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8),
  }));
  const { data, isLoading } = useSimilarVacancies(vacancyId, open);
  const similar = data?.similar ?? [];

  return (
    <div ref={anchorRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t("similar.buttonLabel")}
        title={t("similar.buttonLabel")}
        className="text-ink-dim hover:text-signal text-xs shrink-0"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
      <PopoverPanel open={open} panelRef={panelRef} coords={coords} onClose={() => setOpen(false)} className="w-64 p-2.5 space-y-2">
        <div className="text-xs font-semibold text-ink-dim">{t("similar.heading")}</div>
        {isLoading && <div className="text-xs text-ink-dim">{t("common:state.loading")}</div>}
        {!isLoading && similar.length === 0 && <div className="text-xs text-ink-dim">{t("similar.empty")}</div>}
        {!isLoading && similar.length > 0 && (
          <ul className="space-y-1.5">
            {similar.map((v) => (
              <li key={v.id} className="text-xs">
                <div className="font-medium text-ink">{v.company || t("similar.untitled")}</div>
                <div className="flex items-center justify-between gap-2 text-ink-dim">
                  <span className="truncate">{v.position}</span>
                  <span className="shrink-0 tabular-nums">{Math.round(v.similarity * 100)}%</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverPanel>
    </div>
  );
}
