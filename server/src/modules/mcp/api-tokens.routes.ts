// Personal API token management (create/list/revoke) — normal cookie-session auth (authed()),
// unlike mcp.routes.ts's POST /mcp itself which is bearer-token-authed. This is the UI-facing
// side: a logged-in user manages the tokens their MCP clients will use.
import express from "express";
import { authed } from "../../core/http.js";
import { createApiToken, listApiTokens, revokeApiToken } from "./api-tokens.repo.js";
import { parseApiTokenInput } from "../../shared/validation.js";

const r = express.Router();

r.get(
  "/mcp/tokens",
  authed(async (userId, _req, res) => {
    res.json(await listApiTokens(userId));
  }),
);

r.post(
  "/mcp/tokens",
  authed(async (userId, req, res) => {
    const parsed = parseApiTokenInput(req.body);
    const { id, rawToken } = await createApiToken(userId, parsed);
    // The raw value is shown ONCE here — only the hash is ever stored (api-tokens.repo.ts), so
    // there is no way to retrieve it again after this response.
    res.status(201).json({ id, token: rawToken });
  }),
);

r.delete(
  "/mcp/tokens/:id",
  authed(async (userId, req, res) => {
    await revokeApiToken(userId, Number(req.params.id));
    res.json({ ok: true });
  }),
);

export default r;
