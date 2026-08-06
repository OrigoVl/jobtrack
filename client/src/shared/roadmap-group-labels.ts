// Translates a roadmap group name for display. Unlike Track (a small closed union, see
// track-labels.ts), group names are an OPEN string set — they come from the server's tech-dict
// `cat` values (server/src/shared/tech-dict.ts) plus the "Skills in demand"/"Other" fallbacks,
// and Phase B tracks add more as they land. Same escape hatch as shared/status-labels.ts's
// statusLabel: a runtime-built key i18next's literal-key typing can't verify, with `defaultValue`
// falling back to the raw (English) group name for anything not yet translated — never a blank
// or a literal "roadmapGroups.Something" string.
import i18n from "../i18n";

const GROUP_KEY: Record<string, string> = {
  Core: "core",
  Frontend: "frontend",
  Backend: "backend",
  Database: "database",
  DevOps: "devops",
  Testing: "testing",
  AI: "ai",
  Tools: "tools",
  Other: "other",
  "Skills in demand": "skillsInDemand",
  Planning: "planning",
  Execution: "execution",
  Risk: "risk",
  Elicitation: "elicitation",
  Analysis: "analysis",
  Documentation: "documentation",
};

export function roadmapGroupLabel(group: string): string {
  const key = GROUP_KEY[group] ?? group;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return i18n.t(`common:roadmapGroups.${key}` as any, { defaultValue: group });
}
