import { useCallback } from "react";
import { useUi } from "./ui-state";

export interface CelebrationEvent {
  id: number;
  message: string;
}

/** Fires a brief, hand-rolled confetti burst + banner for milestone moments (a vacancy reaching
 * "Offer", finishing the onboarding checklist) that deserve more than a regular toast. No
 * confetti library — CSS keyframes only (index.css#jt-confetti-fall), consistent with this
 * codebase's "no new deps unless the task calls for it" rule. Backed by `useUi`'s module
 * singleton (not local state) so any component can fire one and `<CelebrationOverlay>`,
 * mounted once in Shell(), picks it up regardless of which route is active. */
export function useFireCelebration() {
  const [, setActive] = useUi<CelebrationEvent | null>("celebration.active", null);
  return useCallback((message: string) => setActive({ id: Date.now(), message }), [setActive]);
}
