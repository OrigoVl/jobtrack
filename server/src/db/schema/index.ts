// Single schema surface handed to `drizzle()` — re-exports every table so Drizzle's relational
// query builder and drizzle-kit's migration generator see the whole schema through one import.
export * from "./app.js";
export * from "./auth.js";
export * from "./billing.js";
export * from "./telegram.js";
export * from "./telemetry.js";
