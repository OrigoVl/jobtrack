// Єдине джерело правди для ключів кешу TanStack Query — щоб уникнути одруківок
// і мати типізовану автопідказку при invalidateQueries/setQueryData.
export const queryKeys = {
  health: ["health"] as const,
  vacancies: ["vacancies"] as const,
  profile: ["profile"] as const,
  analytics: ["analytics"] as const,
  learn: ["learn"] as const,
  roadmap: ["roadmap"] as const,
  study: ["study"] as const,
  projects: ["projects"] as const,
  plan21: ["plan21"] as const,
  companies: ["companies"] as const,
};
