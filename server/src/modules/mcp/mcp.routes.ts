// The MCP tool-call transport endpoint — bearer-token auth (a personal api_tokens row, NOT a
// browser session), so external MCP clients (Claude Desktop, etc.) can read/act on a user's data.
// See api-tokens.routes.ts for the (session-authed) endpoints that mint/list/revoke those tokens.
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { asyncHandler } from "../../core/http.js";
import { resolveApiToken } from "./api-tokens.repo.js";
import { createMcpServer } from "./mcp-tools.js";
import type { UserId } from "../../db/user-id.js";

// Bridges resolveApiToken() (api-tokens.repo.ts) to the shape the SDK's requireBearerAuth
// middleware expects. `clientId`/`scopes` only need to be well-formed for the SDK's own
// bookkeeping — the actual authorization decision downstream is `extra.userId`/`extra.scope`,
// read back out of req.auth by the handler below.
const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token) {
    const resolved = await resolveApiToken(token);
    if (!resolved) throw new Error("Invalid or expired token");
    return {
      token,
      clientId: String(resolved.tokenId),
      scopes: [resolved.scope],
      extra: { userId: resolved.userId, scope: resolved.scope },
    };
  },
};

const r = express.Router();

r.post(
  "/mcp",
  requireBearerAuth({ verifier }),
  asyncHandler(async (req, res) => {
    const authInfo = req.auth!;
    const { userId, scope } = authInfo.extra as { userId: UserId; scope: "read" | "read_write" };
    // A fresh McpServer + transport per request: connect() takes ownership of the transport's
    // callbacks, so instances must never be shared across concurrent requests (see mcp-tools.ts).
    const server = createMcpServer(userId, scope);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }),
);

// Stateless Streamable HTTP: this server offers no standalone SSE stream (GET) and has no
// sessions to terminate (DELETE). The MCP spec requires 405 for both — without these handlers
// they fell through to the generic JSON 404, which some MCP clients (Claude's custom connectors
// among them) read as "the server isn't there" and refuse to connect.
const methodNotAllowed: express.RequestHandler = (_req, res) => {
  res
    .status(405)
    .set("Allow", "POST")
    .json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
};
r.get("/mcp", methodNotAllowed);
r.delete("/mcp", methodNotAllowed);

export default r;
