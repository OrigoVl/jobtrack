// Builds one MCP tool server per request (mcp.routes.ts's POST /mcp creates a fresh McpServer for
// every call — `server.connect(transport)` takes ownership of the transport's callbacks, so
// instances must never be shared across concurrent requests). Every tool handler here is a THIN
// wrapper: parse args, call an existing repo/service export, shape the result as an MCP text
// block. No new business logic lives in this file.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { UserId } from "../../db/user-id.js";
import { listVacancies, getVacancy, updateVacancyStatus } from "../vacancies/vacancies.repo.js";
import { recordStatusChange } from "../../db/index.js";
import { parseVacancyInput, STATUSES, type VacancyStatus } from "../../shared/validation.js";
import { createVacancyWithDedupe } from "../vacancies/vacancy-import.service.js";
import { getUserRoadmap } from "../roadmap/roadmap.service.js";
import { listProfiles, getProfileFull } from "../cv/cv-profiles.repo.js";
import { getCombinedCalendar } from "../calendar/calendar.service.js";

/** MCP text-block convention — kept simple and consistent across every tool below. */
function textResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function notFound(what: string): CallToolResult {
  return { content: [{ type: "text", text: `${what} not found` }], isError: true };
}

export function createMcpServer(userId: UserId, scope: "read" | "read_write"): McpServer {
  const server = new McpServer({ name: "jobtrack", version: "1.0.0" });

  server.registerTool(
    "list_vacancies",
    {
      title: "List vacancies",
      description: "List the user's tracked vacancies/job applications, most recent first.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ limit, offset }) => {
      const page = limit !== undefined ? { limit, offset: offset ?? 0 } : undefined;
      return textResult(await listVacancies(userId, page));
    },
  );

  server.registerTool(
    "get_vacancy",
    {
      title: "Get vacancy",
      description: "Get a single vacancy by id.",
      inputSchema: { id: z.number().int() },
    },
    async ({ id }) => {
      const vacancy = await getVacancy(userId, id);
      if (!vacancy) return notFound("Vacancy");
      return textResult(vacancy);
    },
  );

  server.registerTool(
    "get_roadmap",
    {
      title: "Get skill roadmap",
      description: "Get the user's skill roadmap — grouped skills with demand, progress and level.",
      inputSchema: {},
    },
    async () => textResult(await getUserRoadmap(userId)),
  );

  server.registerTool(
    "list_cv_profiles",
    {
      title: "List CV profiles",
      description: "List the user's CV/resume profiles (name/position only — use get_cv_profile for the full document).",
      inputSchema: {},
    },
    async () => textResult(await listProfiles(userId)),
  );

  server.registerTool(
    "get_cv_profile",
    {
      title: "Get CV profile",
      description: "Get one CV/resume profile's full document by id.",
      inputSchema: { id: z.number().int() },
    },
    async ({ id }) => {
      const profile = await getProfileFull(userId, id);
      if (!profile) return notFound("CV profile");
      return textResult(profile);
    },
  );

  server.registerTool(
    "get_calendar",
    {
      title: "Get calendar",
      description:
        "Get the user's combined calendar — manual events, vacancy next-steps and SRS due dates, optionally within a date range.",
      inputSchema: {
        from: z.string().optional(),
        to: z.string().optional(),
      },
    },
    async ({ from, to }) => textResult(await getCombinedCalendar(userId, { from, to })),
  );

  if (scope === "read_write") {
    server.registerTool(
      "add_vacancy",
      {
        title: "Add vacancy",
        description: "Create a new vacancy/job application.",
        inputSchema: {
          company: z.string(),
          position: z.string(),
          url: z.string(),
          status: z.string(),
          level: z.string().optional(),
          salary: z.string().optional(),
          fit: z.string().optional(),
          applied: z.string().optional(),
          next: z.string().optional(),
          nextAction: z.string().optional(),
          notes: z.string().optional(),
          stack: z.array(z.string()).optional(),
          companyId: z.number().int().optional(),
          favorite: z.boolean().optional(),
          coverLetter: z.string().optional(),
          coverLetterDetails: z.string().optional(),
        },
      },
      async (args) => {
        const parsed = parseVacancyInput(args, { partial: false });
        // Same creation path POST /vacancies uses (vacancy-import.service.ts's
        // createVacancyWithDedupe) — the SimHash near-duplicate heads-up and the
        // auto-enrichment-from-URL a human adding a vacancy gets apply here too, instead of this
        // tool keeping its own thinner copy that silently skipped both.
        const { vacancy, possibleDuplicateOf } = await createVacancyWithDedupe(userId, {
          company: parsed.company!,
          position: parsed.position!,
          level: parsed.level!,
          salary: parsed.salary!,
          url: parsed.url!,
          status: parsed.status!,
          fit: parsed.fit!,
          applied: parsed.applied!,
          next: parsed.next!,
          nextAction: parsed.nextAction ?? "",
          notes: parsed.notes!,
          stack: parsed.stack!,
          companyId: parsed.companyId ?? null,
          favorite: parsed.favorite ?? false,
          coverLetter: parsed.coverLetter ?? "",
          coverLetterDetails: parsed.coverLetterDetails ?? "",
        });
        return textResult({ ...vacancy, possibleDuplicateOf });
      },
    );

    server.registerTool(
      "update_vacancy_status",
      {
        title: "Update vacancy status",
        description: "Update a vacancy's status (e.g. move it to 'Applied', 'Tech interview', 'Offer', ...).",
        inputSchema: { id: z.number().int(), status: z.string() },
      },
      async ({ id, status }) => {
        if (!STATUSES.includes(status as VacancyStatus)) {
          return { content: [{ type: "text", text: `Invalid status: "${status}"` }], isError: true };
        }
        const vacancy = await getVacancy(userId, id);
        if (!vacancy) return notFound("Vacancy");
        if (vacancy.status !== status) {
          await updateVacancyStatus(userId, id, status);
          await recordStatusChange(userId, id, status);
        }
        return textResult(await getVacancy(userId, id));
      },
    );
  }

  return server;
}
