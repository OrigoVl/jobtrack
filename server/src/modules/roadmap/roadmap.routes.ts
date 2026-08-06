import express from "express";
import {
  getProfile,
  getRoadmapProgress,
  setRoadmapStatus,
  getDrillProgress,
  getSrsStateByCard,
  getSkillLevels,
  setSkillLevel,
} from "../../db/index.js";
import { HttpError, authed } from "../../core/http.js";
import { ROADMAP_STATUSES, parseSkillLevelInput, type RoadmapStatus } from "../../shared/validation.js";
import { demandMap } from "../../shared/demand.js";
import { allDrills, allCards } from "../study/content-store.js";
import { buildRoadmap } from "./roadmap.service.js";
import { effectiveTrack } from "../../shared/tracks.js";

const r = express.Router();

// ---------- roadmap (roadmap.sh style, built from REAL skills of vacancies+CV) ----------
r.get(
  "/roadmap",
  authed(async (userId, _req, res) => {
    const profile = await getProfile(userId);
    const track = effectiveTrack(profile);
    const demand = await demandMap(userId);
    const progress = await getRoadmapProgress(userId);
    const drillProgress = await getDrillProgress(userId);
    const [drills, cards, srs, levels] = await Promise.all([
      allDrills(userId, track),
      allCards(userId, track),
      getSrsStateByCard(userId),
      getSkillLevels(userId),
    ]);
    res.json(buildRoadmap({ skills: profile.skills, demand, progress, drillProgress, drills, cards, srs, levels, track }));
  }),
);
r.put(
  "/roadmap/progress",
  authed(async (userId, req, res) => {
    const tech = String(req.body?.tech || "")
      .trim()
      .slice(0, 80);
    const status = String(req.body?.status || "todo");
    if (!tech) throw new HttpError(400, "No skill specified");
    if (!(ROADMAP_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, `Unknown status: "${status}"`);
    res.json({ ok: true, progress: await setRoadmapStatus(userId, tech, status as RoadmapStatus) });
  }),
);
r.put(
  "/roadmap/level",
  authed(async (userId, req, res) => {
    const { tech, level } = parseSkillLevelInput(req.body);
    res.json({ ok: true, levels: await setSkillLevel(userId, tech, level) });
  }),
);

export default r;
