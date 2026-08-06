import { useTranslation } from "react-i18next";
import { Card, Chip } from "../../shared/ui";
import { useDesignHistory } from "../../shared/queries";
import { DIFFICULTY_TONE, designDifficultyLabel } from "./design-difficulty";

// Compact past-attempts list — score + title + date, no diagram (see DesignHistoryEntry: a
// lightweight log, not a resumable history of full diagrams).
export function DesignHistoryPanel() {
  const { t } = useTranslation("design");
  const { data: history = [] } = useDesignHistory();
  if (history.length === 0) return null;
  return (
    <Card>
      <div className="text-sm font-semibold text-ink mb-2">{t("history.heading")}</div>
      <ul className="space-y-1.5">
        {history.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 text-sm">
            <span
              className={`font-mono font-semibold ${entry.score >= 75 ? "text-good" : entry.score >= 50 ? "text-star" : "text-rose-600"}`}
            >
              {entry.score}
            </span>
            <span className="text-ink truncate flex-1">{entry.title}</span>
            <Chip tone={DIFFICULTY_TONE[entry.difficulty]}>{designDifficultyLabel(entry.difficulty)}</Chip>
            <span className="text-xs text-ink-dim shrink-0">{new Date(entry.gradedAt).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
