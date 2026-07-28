// Single schema surface handed to `drizzle()` — re-exports every table so Drizzle's relational
// query builder and drizzle-kit's migration generator see the whole schema through one import.
// better-auth's generated tables (server/src/db/schema/auth.ts) join this barrel in phase 3.
export * from "./app.js";
