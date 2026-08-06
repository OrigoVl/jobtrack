// Public facade of the db/ module: other modules import only from here, not directly
// from client.ts — this allows freely changing the internal structure (client/kv/helpers)
// without touching the rest of the app.
export { default } from "./client.js";
export { pingDb, closeDb, withAdvisoryLock } from "./client.js";
export * from "./types.js";
export * from "./kv.js";
export * from "./vacancy-history.js";
