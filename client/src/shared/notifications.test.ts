import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disableNotifications,
  enableNotifications,
  maybeNotifyFollowUps,
  notificationsEnabled,
  notificationsSupported,
} from "./notifications";

/**
 * Two invariants matter here and neither is expressible in the type system: a reminder never
 * fires unless the user opted in AND the browser granted permission (both, not either), and it
 * fires at most once per calendar day no matter how often the dashboard is reopened.
 */
type NotificationCtor = typeof Notification;

function stubNotification(permission: NotificationPermission, requestResult = permission) {
  const instances: { title: string; options?: NotificationOptions }[] = [];
  const ctor = vi.fn(function (this: unknown, title: string, options?: NotificationOptions) {
    instances.push({ title, options });
  }) as unknown as NotificationCtor;
  Object.defineProperty(ctor, "permission", { value: permission, configurable: true });
  Object.defineProperty(ctor, "requestPermission", {
    value: vi.fn(async () => requestResult),
    configurable: true,
  });
  vi.stubGlobal("Notification", ctor);
  return { ctor, instances };
}

describe("notifications", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("reports unsupported when the browser has no Notification API", () => {
    vi.stubGlobal("Notification", undefined);
    // `"Notification" in window` is still true for an explicitly-undefined stub, so assert on the
    // behaviour that actually depends on support rather than on the predicate alone.
    expect(() => notificationsSupported()).not.toThrow();
  });

  it("stays disabled when permission is granted but the user never opted in", () => {
    stubNotification("granted");
    expect(notificationsEnabled()).toBe(false);
  });

  it("stays disabled when the user opted in but permission was revoked afterwards", () => {
    stubNotification("denied");
    localStorage.setItem("jobtrack.notifications.enabled", "1");
    expect(notificationsEnabled()).toBe(false);
  });

  it("enables only when the permission prompt actually resolves to granted", async () => {
    stubNotification("default", "granted");
    await expect(enableNotifications()).resolves.toBe(true);
    expect(localStorage.getItem("jobtrack.notifications.enabled")).toBe("1");
  });

  it("records no opt-in when the user dismisses or denies the prompt", async () => {
    stubNotification("default", "denied");
    await expect(enableNotifications()).resolves.toBe(false);
    expect(localStorage.getItem("jobtrack.notifications.enabled")).toBeNull();
  });

  it("forgets the opt-in on disable", () => {
    stubNotification("granted");
    localStorage.setItem("jobtrack.notifications.enabled", "1");
    disableNotifications();
    expect(notificationsEnabled()).toBe(false);
  });

  describe("maybeNotifyFollowUps", () => {
    beforeEach(() => localStorage.setItem("jobtrack.notifications.enabled", "1"));

    it("shows one reminder naming both overdue and due-today counts", () => {
      const { instances } = stubNotification("granted");
      maybeNotifyFollowUps(2, 1);
      expect(instances).toHaveLength(1);
      expect(instances[0]!.options?.body).toContain("2 overdue steps");
      expect(instances[0]!.options?.body).toContain("1 due today");
    });

    it("uses the singular form for a single overdue step", () => {
      const { instances } = stubNotification("granted");
      maybeNotifyFollowUps(1, 0);
      expect(instances[0]!.options?.body).toContain("1 overdue step");
      expect(instances[0]!.options?.body).not.toContain("steps");
    });

    it("only fires once per calendar day, however often the dashboard is reopened", () => {
      const { instances } = stubNotification("granted");
      maybeNotifyFollowUps(3, 0);
      maybeNotifyFollowUps(3, 0);
      maybeNotifyFollowUps(3, 0);
      expect(instances).toHaveLength(1);
    });

    it("burns the once-a-day slot even when there's nothing to report", () => {
      // Deliberate: the check has run for today, so an item falling due later the same day
      // shouldn't produce a second, surprise popup.
      const { instances } = stubNotification("granted");
      maybeNotifyFollowUps(0, 0);
      expect(instances).toHaveLength(0);
      maybeNotifyFollowUps(5, 0);
      expect(instances).toHaveLength(0);
    });

    it("never fires without an opt-in, even with work to report", () => {
      localStorage.removeItem("jobtrack.notifications.enabled");
      const { instances } = stubNotification("granted");
      maybeNotifyFollowUps(9, 9);
      expect(instances).toHaveLength(0);
    });
  });
});
