import { useTranslation } from "react-i18next";
import { VideoCallIcon } from "../../shared/icons";
import { meetingProviderLabel, normalizeMeetingUrl } from "./meeting-link";

/**
 * The one-click "join" affordance for an event's video call, shared by the event modal, the day
 * popover and the agenda rows so the same link looks and behaves identically wherever an event is
 * shown.
 *
 * Renders nothing at all when there's no link, or when what's stored isn't a usable http(s) one —
 * a dead pill is worse than no pill, and it's the same check that keeps a hostile value out of the
 * href (see meeting-link.ts).
 *
 * The label is the provider's own name ("Google Meet", "Zoom", the bare hostname for anything
 * else), not a translated string: it tells the user which app is about to open, which the generic
 * word "join" doesn't. `target="_blank"` because losing a half-typed event to a navigation is the
 * one thing that must not happen here; `rel="noreferrer"` since the target is an arbitrary
 * user-supplied origin.
 */
export function JoinCallLink({ url, className = "" }: { url: string; className?: string }) {
  const { t } = useTranslation("calendar");
  const href = normalizeMeetingUrl(url);
  if (!href) return null;
  const provider = meetingProviderLabel(href);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={t("joinCallAria", { provider })}
      className={`inline-flex items-center gap-1 rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 text-[11px] font-semibold text-signal transition-colors hover:bg-signal/20 ${className}`}
    >
      <VideoCallIcon className="h-3 w-3 shrink-0" />
      {t("joinCall")}
      <span className="text-signal/70 truncate max-w-[9rem]">· {provider}</span>
    </a>
  );
}
