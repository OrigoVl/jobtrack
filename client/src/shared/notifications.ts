// Lightweight browser reminders (Web Notifications API) about overdue/due-today vacancy
// follow-up steps. No service worker or push — just a foreground reminder when the app opens,
// at most once a day, and only if the user has enabled them themselves (permission is an
// explicit user action — the browser won't allow a request without a user gesture anyway).
const LS_ENABLED_KEY = "jobtrack.notifications.enabled";
const LS_LAST_CHECK_KEY = "jobtrack.notifications.lastCheck";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsEnabled(): boolean {
  return notificationsSupported() && Notification.permission === "granted" && localStorage.getItem(LS_ENABLED_KEY) === "1";
}

/** Requests permission (must be called from a click handler — user gesture). */
export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    localStorage.setItem(LS_ENABLED_KEY, "1");
    return true;
  }
  return false;
}

export function disableNotifications(): void {
  localStorage.removeItem(LS_ENABLED_KEY);
}

/**
 * Shows a reminder about overdue/due-today steps, at most once per calendar day
 * (so it doesn't spam the user every time they just open the dashboard tab).
 */
export function maybeNotifyFollowUps(overdueCount: number, dueTodayCount: number): void {
  if (!notificationsEnabled()) return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(LS_LAST_CHECK_KEY) === today) return;
  localStorage.setItem(LS_LAST_CHECK_KEY, today);
  if (overdueCount === 0 && dueTodayCount === 0) return;
  const parts: string[] = [];
  if (overdueCount > 0) parts.push(`${overdueCount} overdue ${overdueCount === 1 ? "step" : "steps"}`);
  if (dueTodayCount > 0) parts.push(`${dueTodayCount} due today`);
  new Notification("DevRadar — stay on top of it", { body: `You have ${parts.join(" and ")}. Check the "Vacancies" tab.` });
}
