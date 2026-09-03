import type { KbEntry } from "./knowledge-base.js";
import { buildSoftwareKbUk } from "./entries/software.uk.js";
import { buildDataKbUk } from "./entries/data.uk.js";
import { buildDevopsKbUk } from "./entries/devops.uk.js";
import { buildQaKbUk } from "./entries/qa.uk.js";
import { buildProductKbUk } from "./entries/product.uk.js";
import { buildSysadminKbUk } from "./entries/sysadmin.uk.js";
import { buildDesignKbUk } from "./entries/design.uk.js";
import { buildSecurityKbUk } from "./entries/security.uk.js";
import { buildPmKbUk } from "./entries/pm.uk.js";
import { buildBaKbUk } from "./entries/ba.uk.js";

// Ukrainian mirror of knowledge-base.ts: same keys/cat/resources, `learn` bullets translated.
// This function itself is just a merge of ten per-track builders — the literal per-track objects
// live in entries/<track>.uk.ts (one per shared/tracks.ts Track, mirroring entries/<track>.ts),
// split out purely for reviewable diffs instead of one ~2500-line file. Each of those builders is
// wrapped in a function (rather than a top-level const) because it reads `KB.X!.cat`/`.resources`
// straight off knowledge-base.ts's `KB` — a genuine circular import (knowledge-base.ts imports
// buildKbUk from here, this file's entries/*.uk.ts import KB back from knowledge-base.ts).
// Evaluating that at module-load time would run before knowledge-base.ts finishes defining `KB`;
// calling it lazily, only once every module involved has fully loaded, sidesteps that — see
// knowledge-base.ts's getKbUk() for the memoized caller.
export function buildKbUk(): Record<string, KbEntry> {
  return {
    ...buildSoftwareKbUk(),
    ...buildDataKbUk(),
    ...buildDevopsKbUk(),
    ...buildQaKbUk(),
    ...buildProductKbUk(),
    ...buildSysadminKbUk(),
    ...buildDesignKbUk(),
    ...buildSecurityKbUk(),
    ...buildPmKbUk(),
    ...buildBaKbUk(),
  };
}
