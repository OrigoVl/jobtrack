// createMcpServer() has real branching worth testing without spinning up the whole MCP
// transport: which tools get registered depends on `scope`. The per-tool handlers themselves are
// thin wrappers around already-tested repo/service functions (see this repo's testing
// philosophy for *.routes.ts-style wiring), so this file only covers the registration branch —
// introspected via McpServer's private `_registeredTools` (a plain object at runtime, see
// node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js), since the SDK doesn't expose a
// public "list registered tool names" API on the McpServer wrapper itself.
import { describe, expect, it } from "vitest";
import { createMcpServer } from "./mcp-tools.js";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";

function registeredToolNames(server: ReturnType<typeof createMcpServer>): string[] {
  return Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
}

const READ_ONLY_TOOLS = ["list_vacancies", "get_vacancy", "get_roadmap", "list_cv_profiles", "get_cv_profile", "get_calendar"];
const WRITE_TOOLS = ["add_vacancy", "update_vacancy_status"];

describe("createMcpServer()", () => {
  it("registers only the read-only tools for scope 'read'", () => {
    const server = createMcpServer(BOOTSTRAP_USER_ID, "read");
    const names = registeredToolNames(server);
    expect(names.sort()).toEqual([...READ_ONLY_TOOLS].sort());
    for (const tool of WRITE_TOOLS) expect(names).not.toContain(tool);
  });

  it("registers all read + write tools for scope 'read_write'", () => {
    const server = createMcpServer(BOOTSTRAP_USER_ID, "read_write");
    const names = registeredToolNames(server);
    expect(names.sort()).toEqual([...READ_ONLY_TOOLS, ...WRITE_TOOLS].sort());
  });
});
