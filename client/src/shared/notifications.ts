// Легкі браузерні нагадування (Web Notifications API) про прострочені/сьогоднішні кроки по
// вакансіях. Без service worker і push — лише foreground-нагадування при відкритті застосунку,
// не частіше раз на день, і тільки якщо користувач сам увімкнув їх (permission — явна дія юзера,
// браузер все одно не дозволить request без user gesture).
const LS_ENABLED_KEY = "jobtrack.notifications.enabled";
const LS_LAST_CHECK_KEY = "jobtrack.notifications.lastCheck";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsEnabled(): boolean {
  return notificationsSupported() && Notification.permission === "granted" && localStorage.getItem(LS_ENABLED_KEY) === "1";
}

/** Запитує дозвіл (має викликатись з обробника кліку — user gesture). */
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
 * Показує нагадування про прострочені/сьогоднішні кроки, максимум раз на календарний день
 * (щоб не спамити щоразу, коли користувач просто відкриває вкладку дашборду).
 */
export function maybeNotifyFollowUps(overdueCount: number, dueTodayCount: number): void {
  if (!notificationsEnabled()) return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(LS_LAST_CHECK_KEY) === today) return;
  localStorage.setItem(LS_LAST_CHECK_KEY, today);
  if (overdueCount === 0 && dueTodayCount === 0) return;
  const parts: string[] = [];
  if (overdueCount > 0) parts.push(`${overdueCount} прострочен${overdueCount === 1 ? "ий крок" : "их кроки"}`);
  if (dueTodayCount > 0) parts.push(`${dueTodayCount} на сьогодні`);
  new Notification("JobTrack — не втрачай контакт", { body: `У тебе ${parts.join(" і ")}. Перевір вкладку «Вакансії».` });
}
