// Combines all domain routers (modules/*) into a single Express Router, mounted
// at /api in app.ts. Each module owns one API domain (see the README for the endpoint map).
import express from "express";
import health from "./modules/health/health.routes.js";
import vacancies from "./modules/vacancies/vacancies.routes.js";
import jobs from "./modules/jobs/jobs.routes.js";
import cv from "./modules/cv/cv.routes.js";
import knowledge from "./modules/knowledge/knowledge.routes.js";
import roadmap from "./modules/roadmap/roadmap.routes.js";
import analytics from "./modules/analytics/analytics.routes.js";
import resources from "./modules/resources/resources.routes.js";
import study from "./modules/study/study.routes.js";
import projects from "./modules/projects/projects.routes.js";
import plan21 from "./modules/plan21/plan21.routes.js";
import companies from "./modules/companies/companies.routes.js";
import writing from "./modules/writing/writing.routes.js";
import mock from "./modules/mock/mock.routes.js";
import admin from "./modules/admin/admin.routes.js";

const r = express.Router();

r.use(health);
r.use(vacancies);
r.use(jobs);
r.use(cv);
r.use(knowledge);
r.use(roadmap);
r.use(analytics);
r.use(resources);
r.use(study);
r.use(projects);
r.use(plan21);
r.use(companies);
r.use(writing);
r.use(mock);
r.use(admin);

export default r;
