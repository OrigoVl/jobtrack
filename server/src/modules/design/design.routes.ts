import express from "express";
import { getKvJson, getProfile, setKvJson } from "../../db/index.js";
import { authed, HttpError } from "../../core/http.js";
import { aiLimiter } from "../../core/rate-limit.js";
import { getVacancy } from "../vacancies/vacancies.repo.js";
import {
  parseDesignDefenseInput,
  parseDesignGenerateTaskInput,
  parseDesignGradeInput,
  parseDesignHelpInput,
} from "../../shared/validation.js";
import {
  appendDesignHistory,
  gradeDesign,
  generateDesignTask,
  helpWithDesign,
  runDefenseTurn,
  type DesignDiagram,
  type DesignGrade,
  type DesignHistoryEntry,
  type DesignTask,
} from "./design.service.js";

const r = express.Router();

const CURRENT_EXERCISE_KEY = "designExercise";
const HISTORY_KEY = "designHistory";

interface DesignExercise {
  task: DesignTask;
  diagram: DesignDiagram;
  grade: DesignGrade | null;
}

// The single in-progress/most-recent exercise — unlike the stateless mock interview, building a
// diagram is real effort, so this survives a reload. No history/listing yet (see design.service.ts's
// module comment); one user_kv key is enough for that, no new table needed.
r.get(
  "/design/current",
  authed(async (userId, _req, res) => {
    res.json(await getKvJson<DesignExercise>(userId, CURRENT_EXERCISE_KEY));
  }),
);

r.post(
  "/design/task",
  aiLimiter,
  authed(async (userId, req, res) => {
    const { vacancyId } = parseDesignGenerateTaskInput(req.body);
    // Unlike /mock/interview, this isn't a resumable multi-turn session — an unknown id is
    // always a real client error, no "degrade to general" needed for a mid-session id.
    const vacancy = vacancyId != null ? await getVacancy(userId, vacancyId) : null;
    if (vacancyId != null && !vacancy) throw new HttpError(400, `Unknown vacancy: ${vacancyId}`);
    const profile = await getProfile(userId);
    res.json(await generateDesignTask(userId, profile, vacancy ?? null));
  }),
);

r.post(
  "/design/grade",
  aiLimiter,
  authed(async (userId, req, res) => {
    const { task, diagram } = parseDesignGradeInput(req.body);
    const grade = await gradeDesign(userId, task, diagram);
    await setKvJson(userId, CURRENT_EXERCISE_KEY, { task, diagram, grade });
    const history = (await getKvJson<DesignHistoryEntry[]>(userId, HISTORY_KEY)) || [];
    const entry: DesignHistoryEntry = {
      id: `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: task.title,
      difficulty: task.difficulty,
      score: grade.score,
      offline: !!grade.offline,
      gradedAt: new Date().toISOString(),
    };
    await setKvJson(userId, HISTORY_KEY, appendDesignHistory(history, entry));
    res.json(grade);
  }),
);

r.get(
  "/design/history",
  authed(async (userId, _req, res) => {
    res.json((await getKvJson<DesignHistoryEntry[]>(userId, HISTORY_KEY)) || []);
  }),
);

r.post(
  "/design/help",
  aiLimiter,
  authed(async (userId, req, res) => {
    const { task, diagram, question } = parseDesignHelpInput(req.body);
    res.json(await helpWithDesign(userId, task, diagram, question));
  }),
);

// Stateless, like /mock/interview and the routes above — the client resends the whole discussion
// transcript every turn (see design.service.ts's runDefenseTurn doc comment for why this is a
// sibling to mock-interview.service.ts, not a reuse of it).
r.post(
  "/design/defense",
  aiLimiter,
  authed(async (userId, req, res) => {
    const { task, diagram, transcript, maxTurns } = parseDesignDefenseInput(req.body);
    res.json(await runDefenseTurn(userId, task, diagram, transcript, maxTurns));
  }),
);

export default r;
