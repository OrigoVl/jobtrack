// Everything about a calendar event's video-call link that isn't rendering: turning what someone
// pasted into a usable URL, and naming the provider it points at. Pure string work with no React
// import, so the modal, the day popover and the agenda rows can all share it — see
// meeting-link.test.ts.

/**
 * What the user typed → something that can go in an href, or "" if it can't.
 *
 * A pasted call link routinely arrives without a scheme ("meet.google.com/abc-defg-hij", the form
 * every one of these providers prints in its own UI), which `new URL()` rejects outright — so a
 * scheme-less value gets https:// rather than being called invalid. Anything that still doesn't
 * parse, or parses to a non-http(s) scheme, returns "": this value ends up in an href, and
 * "javascript:..." must never survive this function. The server applies the same http(s)-only rule
 * (shared/validation.ts's toUrl); this is the friendlier half of it, not a replacement.
 */
export function normalizeMeetingUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Only prefix when there's no scheme at all. Testing for "://" rather than for a known scheme is
  // what keeps "javascript:alert(1)" from becoming "https://javascript:alert(1)" — a valid URL
  // that would then pass the protocol check below.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  return url.toString();
}

/** Host suffix → the provider's own name for itself. Proper nouns, so they're deliberately NOT in
 * the i18n bundle — "Google Meet" is "Google Meet" in every locale (see CLAUDE.md's rule about
 * never translating a wire value or a product name). Matched as a full host or a dot-suffix, so
 * "evil-zoom.us" or "notzoom.us" can't claim to be Zoom. */
const PROVIDERS: ReadonlyArray<readonly [host: string, name: string]> = [
  ["meet.google.com", "Google Meet"],
  ["zoom.us", "Zoom"],
  ["zoomgov.com", "Zoom"],
  ["teams.microsoft.com", "Microsoft Teams"],
  ["teams.live.com", "Microsoft Teams"],
  ["whereby.com", "Whereby"],
  ["webex.com", "Webex"],
  ["meet.jit.si", "Jitsi"],
  ["jitsi.org", "Jitsi"],
  ["discord.gg", "Discord"],
  ["discord.com", "Discord"],
  ["skype.com", "Skype"],
  ["slack.com", "Slack"],
  ["around.co", "Around"],
  ["gather.town", "Gather"],
  ["hangouts.google.com", "Google Meet"],
];

/**
 * The provider's name ("Google Meet", "Zoom", …) for a link, or its bare hostname when it's some
 * other provider — every self-hosted Jitsi/BigBlueButton install in the world is one of these, and
 * showing "call.acme.dev" is still more informative than a generic label. Returns "" for anything
 * that isn't a usable http(s) URL, which is the caller's cue to render nothing at all.
 */
export function meetingProviderLabel(url: string): string {
  const normalized = normalizeMeetingUrl(url);
  if (!normalized) return "";
  const host = new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
  const match = PROVIDERS.find(([h]) => host === h || host.endsWith(`.${h}`));
  return match ? match[1] : host;
}
