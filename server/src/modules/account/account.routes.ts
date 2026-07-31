import express from "express";
import { authed } from "../../core/http.js";
import { exportAccountData } from "./account.service.js";

const r = express.Router();

// ---------- account: self-service data export ----------
r.get(
  "/account/export",
  authed(async (userId, _req, res) => {
    const data = await exportAccountData(userId);
    res.setHeader("Content-Disposition", 'attachment; filename="devradar-export.json"');
    res.json(data);
  }),
);

export default r;
