// DesignTask["difficulty"] is a persisted wire value — never translate it directly, same
// convention as fit-tone.ts's Fit / design-node-kinds.ts's DesignNodeKind. Single source of truth
// for both the i18n label and the Chip tone so task-card/history-panel/archive-panel stay in sync.
import i18n from "../../i18n";
import type { DesignTask } from "../../shared/types";

type DesignDifficulty = DesignTask["difficulty"];

export const DIFFICULTY_TONE: Record<DesignDifficulty, "good" | "amber" | "rose"> = {
  easy: "good",
  medium: "amber",
  hard: "rose",
};

/** Translates a DesignDifficulty for display. Calls the i18next singleton directly (not a `t`
 * from the caller's own useTranslation()) since callers may live in components with a different
 * default namespace — same reasoning as fit-tone.ts's fitLabel. */
export function designDifficultyLabel(difficulty: DesignDifficulty): string {
  return i18n.t(`design:task.difficulty.${difficulty}`);
}
