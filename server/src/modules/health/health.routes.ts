import express from "express";
import { llmAvailable } from "../../llm/index.js";

const r = express.Router();

r.get("/health", (_q, res) => res.json({ ok: true, llm: llmAvailable() }));

export default r;
