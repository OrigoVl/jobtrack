// Публічний фасад db/-модуля: інші модулі імпортують лише звідси, а не з client.ts
// напряму — це дозволяє вільно міняти внутрішню структуру (client/kv/helpers) без
// зачіпання решти застосунку.
export { default } from "./client.js";
export { pingDb, closeDb } from "./client.js";
export * from "./types.js";
export * from "./kv.js";
export * from "./helpers.js";
