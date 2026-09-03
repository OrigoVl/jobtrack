import type { Resource } from "../knowledge-base.js";

// Shorthand for building a Resource literal — pulled out here (rather than re-declared in every
// entries/*.ts split file) so all ten track files share the exact same one-liner.
export const R = (t: string, u: string): Resource => ({ t, u });
