// Regression test for the Express route-registration-order hazard that commit 9444429 fixed:
// PUT /vacancies/apply-goal was registered AFTER PUT /vacancies/:id, so Express — which matches
// routes strictly in registration order — matched every "/vacancies/apply-goal" request against
// ":id" first ("apply-goal" happily binds to `:id`), and the intended handler was never reached.
//
// This walks EVERY modules/*/*.routes.ts router's own registered `.stack` and asserts that, for
// a given HTTP method, no static-segment route is shadowed by an earlier-registered `:param`
// sibling — catching this class of bug in any module, present or future, not just re-checking
// the one case that already broke.
import { describe, expect, it, vi } from "vitest";
import express, { type Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulesDir = __dirname; // this file lives at server/src/modules/route-order.test.ts

// Every *.routes.ts module transitively imports "../../db/index.js" -> db/client.ts, which
// opens the app's one real Postgres connection pool as a side effect of being imported (see
// core/http.ts's own doc comment on why it lazily imports auth/auth.js instead — this module
// doesn't have that luxury, it's the repositories' own client). Nothing below ever issues a
// query — the whole point of this test is to inspect each router's statically-registered
// `.stack`, not exercise a handler — so a trivial stub is enough, same pattern as
// companies.repo.test.ts/cross-tenant-isolation.test.ts's `vi.doMock` of this exact module,
// just swapped for a stub instead of a real PGlite instance since no query ever runs here.
vi.doMock("../db/client.js", () => ({ default: {} }));

interface RouteInfo {
  method: string;
  path: string;
}

/** Runtime shape of an Express route Layer that owns a `Route` (as opposed to a plain
 * middleware layer, e.g. from `router.use(...)`) — `@types/express`'s `ILayer`/`IRoute` don't
 * declare `.methods` (an implementation detail, not part of the public type), so this is a
 * narrow runtime guard rather than a cast. */
function isRouteLayer(layer: unknown): layer is { route: { path: string; methods: Record<string, boolean> } } {
  if (typeof layer !== "object" || layer === null) return false;
  const route = (layer as { route?: unknown }).route;
  if (typeof route !== "object" || route === null) return false;
  const path = (route as { path?: unknown }).path;
  const methods = (route as { methods?: unknown }).methods;
  return typeof path === "string" && typeof methods === "object" && methods !== null;
}

/** Flattens a router's registered stack into an ordered (method, path) list, one entry per
 * method a route responds to — registration order preserved, since that's exactly the order
 * Express itself walks at request time. */
function extractRoutes(router: Router): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const layer of router.stack as unknown[]) {
    if (!isRouteLayer(layer)) continue;
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({ method, path: layer.route.path });
    }
  }
  return routes;
}

/** True if `earlier`'s path pattern would match every concrete URL `later`'s path also matches
 * — i.e. Express would route a request meant for `later` into `earlier`'s handler first, and
 * `later` would never be reached. Requires the same segment count (Express only matches a
 * `:param` segment 1-for-1 against a single path segment) and at least one segment where
 * `earlier` is a `:param` standing in for a literal `later` has — two routes that just happen to
 * share a literal path is a plain duplicate-route bug, not this shadowing hazard. */
function shadows(earlier: string, later: string): boolean {
  const a = earlier.split("/").filter(Boolean);
  const b = later.split("/").filter(Boolean);
  if (a.length !== b.length) return false;
  let hasParamDifference = false;
  for (let i = 0; i < a.length; i++) {
    const segA = a[i]!;
    const segB = b[i]!;
    if (segA === segB) continue;
    if (segA.startsWith(":")) {
      hasParamDifference = true;
      continue;
    }
    return false; // diverges on a literal segment — the two paths just don't overlap
  }
  return hasParamDifference;
}

interface ShadowingHazard {
  method: string;
  dynamicPath: string;
  shadowedPath: string;
}

function findShadowingHazards(router: Router): ShadowingHazard[] {
  const routes = extractRoutes(router);
  const hazards: ShadowingHazard[] = [];
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const earlier = routes[i]!;
      const later = routes[j]!;
      if (earlier.method !== later.method) continue;
      if (shadows(earlier.path, later.path)) {
        hazards.push({ method: earlier.method, dynamicPath: earlier.path, shadowedPath: later.path });
      }
    }
  }
  return hazards;
}

describe("findShadowingHazards() — the detector itself", () => {
  it("flags a :param route registered before a static sibling sharing its method (the exact shape of commit 9444429's bug)", () => {
    const router = express.Router();
    router.put("/vacancies/:id", (_req, res) => res.end());
    router.put("/vacancies/apply-goal", (_req, res) => res.end());
    expect(findShadowingHazards(router)).toEqual([{ method: "put", dynamicPath: "/vacancies/:id", shadowedPath: "/vacancies/apply-goal" }]);
  });

  it("does not flag the fixed ordering (static sibling registered first)", () => {
    const router = express.Router();
    router.put("/vacancies/apply-goal", (_req, res) => res.end());
    router.put("/vacancies/:id", (_req, res) => res.end());
    expect(findShadowingHazards(router)).toEqual([]);
  });

  it("does not flag a :param route shadowed by a static route on a DIFFERENT method", () => {
    const router = express.Router();
    router.put("/vacancies/:id", (_req, res) => res.end());
    router.get("/vacancies/apply-goal", (_req, res) => res.end());
    expect(findShadowingHazards(router)).toEqual([]);
  });

  it("does not flag two routes with different segment counts, even if one is dynamic", () => {
    const router = express.Router();
    router.get("/vacancies/:id/similar", (_req, res) => res.end());
    router.get("/vacancies/fetch-all/status", (_req, res) => res.end());
    expect(findShadowingHazards(router)).toEqual([]);
  });

  it("does not flag two identical static routes (a plain duplicate-route bug, not this hazard)", () => {
    const router = express.Router();
    router.get("/vacancies", (_req, res) => res.end());
    router.get("/vacancies", (_req, res) => res.end());
    expect(findShadowingHazards(router)).toEqual([]);
  });
});

const routeModuleFiles = fs
  .readdirSync(modulesDir, { recursive: true })
  .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".routes.ts"))
  .sort();

describe("modules/*/*.routes.ts — no dynamic route shadows a static sibling", () => {
  // Guards against the glob above silently matching nothing (e.g. after a directory-layout
  // change) and every `it.each` below vacuously passing.
  it("found a non-trivial number of route modules to check", () => {
    expect(routeModuleFiles.length).toBeGreaterThan(20);
  });

  it.each(routeModuleFiles)("%s", async (file) => {
    const router = (await import(path.join(modulesDir, file))).default as Router;
    expect(findShadowingHazards(router)).toEqual([]);
  });
});
