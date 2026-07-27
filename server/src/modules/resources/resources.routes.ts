import express from "express";
import { BEST_PRACTICES, PLATFORMS, CHEAT, CHECKLIST } from "./resources.data.js";

const r = express.Router();

r.get("/resources", (_q, res) => res.json({ bestPractices: BEST_PRACTICES, platforms: PLATFORMS, cheat: CHEAT, checklist: CHECKLIST }));

export default r;
