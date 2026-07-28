// Single source of truth for TanStack Query cache keys — to avoid typos
// and get typed autocomplete when calling invalidateQueries/setQueryData.
export const queryKeys = {
  health: ["health"] as const,
  authConfig: ["authConfig"] as const,
  vacancies: ["vacancies"] as const,
  profile: ["profile"] as const,
  analytics: ["analytics"] as const,
  learn: ["learn"] as const,
  roadmap: ["roadmap"] as const,
  study: ["study"] as const,
  projects: ["projects"] as const,
  plan21: ["plan21"] as const,
  companies: ["companies"] as const,
  adminOverview: ["adminOverview"] as const,
  adminUsers: ["adminUsers"] as const,
  adminLlmUsage: ["adminLlmUsage"] as const,
  adminProductEvents: ["adminProductEvents"] as const,
};
