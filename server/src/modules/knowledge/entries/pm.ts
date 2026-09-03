// Project management track (see shared/tracks.ts's Track union) knowledge-base entries — split out of
// ../knowledge-base.ts's KB object purely for reviewable diffs; see that file's own header
// comment for the full KB shape (learn bullets + resources per technology). No logic here.
import type { KbEntry } from "../knowledge-base.js";
import { R } from "./resource.js";

export const PM_KB: Record<string, KbEntry> = {
  // ---------- PM (classic project management) track additions ----------
  // Bare acronyms like "PMP", "WBS", "EVM", "RAID", "RACI" are deliberately NOT added to
  // tech-dict.ts (see the comment there) — collision-prone as short tokens — so they stay
  // reachable only through these full-phrase KB keys, same treatment as the Product track's
  // RICE/MoSCoW/MVP/OKR(s) and the SysAdmin track's AD/SAN/MFA/EDR/DFS.
  PMBOK: {
    cat: "Core",
    learn: [
      "Five process groups: Initiating, Planning, Executing, Monitoring & Controlling, Closing",
      "Ten knowledge areas (Integration, Scope, Schedule, Cost, Quality, Resource, Communications, Risk, Procurement, Stakeholder)",
      "Predictive vs adaptive vs hybrid life cycles; how the current exam outline blends classic and agile content",
    ],
    resources: [
      R("PMI — PMBOK Guide & Standards", "https://www.pmi.org/pmbok-guide-standards"),
      R(
        "Wikipedia — A Guide to the Project Management Body of Knowledge",
        "https://en.wikipedia.org/wiki/A_Guide_to_the_Project_Management_Body_of_Knowledge",
      ),
    ],
  },
  "Project Charter": {
    cat: "Core",
    learn: [
      "Purpose, measurable objectives, high-level requirements, assumptions/constraints, sponsor sign-off",
      "Why it's what formally authorizes the PM to apply organizational resources to the project",
    ],
    resources: [
      R("Atlassian — What is a project charter?", "https://www.atlassian.com/agile/project-management/project-charter"),
      R("Wikipedia — Project charter", "https://en.wikipedia.org/wiki/Project_charter"),
    ],
  },
  "PMP Certification": {
    cat: "Core",
    learn: [
      "PMP vs CAPM: experience requirements, exam scope, who each credential suits",
      "Exam content outline: people, process, and business environment domains",
    ],
    resources: [
      R("PMI — Project Management Professional (PMP)", "https://www.pmi.org/certifications/project-management-pmp"),
      R("PMI — Certified Associate in Project Management (CAPM)", "https://www.pmi.org/certifications/certified-associate-capm"),
    ],
  },
  "Agile vs Waterfall": {
    cat: "Core",
    learn: [
      "Predictive (waterfall) vs adaptive (agile) vs hybrid life cycles, and when classic PM favors each",
      "Fixed upfront scope/schedule/cost vs iterative, feedback-driven delivery",
    ],
    resources: [
      R("Wikipedia — Waterfall model", "https://en.wikipedia.org/wiki/Waterfall_model"),
      R("Wikipedia — Agile software development", "https://en.wikipedia.org/wiki/Agile_software_development"),
    ],
  },
  "Program Management": {
    cat: "Core",
    learn: [
      "Coordinating related projects for benefits not available from managing them individually",
      "Managing shared dependencies/resources and conflicts between projects under one program",
    ],
    resources: [
      R("Wikipedia — Program management", "https://en.wikipedia.org/wiki/Program_management"),
      R("PMI — What is Program Management", "https://www.pmi.org/about/learn-about-pmi/what-is-program-management"),
    ],
  },
  "Portfolio Management": {
    cat: "Core",
    learn: [
      "Selecting and prioritizing the right projects/programs given limited capacity and budget",
      "Project-selection methods: NPV, IRR, payback period, benefit-cost ratio",
    ],
    resources: [
      R("Wikipedia — Project portfolio management", "https://en.wikipedia.org/wiki/Project_portfolio_management"),
      R("PMI — What is Portfolio Management", "https://www.pmi.org/about/learn-about-pmi/what-is-portfolio-management"),
    ],
  },
  PMO: {
    cat: "Core",
    learn: [
      "Supportive vs controlling vs directive PMOs, and how much control/standardization each imposes",
      "Standardized templates, governance artifacts, and portfolio-wide status roll-up",
    ],
    resources: [
      R("Wikipedia — Project management office", "https://en.wikipedia.org/wiki/Project_management_office"),
      R("PMI — What is a PMO", "https://www.pmi.org/about/learn-about-pmi/what-is-a-pmo"),
    ],
  },
  "Stakeholder Management": {
    cat: "Core",
    learn: [
      "Identifying stakeholders, their interest/influence, and tailoring engagement (inform/consult/approve)",
      "Communications matrix: what each stakeholder needs, how often, and through which channel",
    ],
    resources: [
      R("Wikipedia — Project stakeholder", "https://en.wikipedia.org/wiki/Project_stakeholder"),
      R("Atlassian — Stakeholder management", "https://www.atlassian.com/work-management/project-management/stakeholder-management"),
    ],
  },
  "Work Breakdown Structure (WBS)": {
    cat: "Planning",
    learn: [
      "Hierarchical decomposition of total scope into work packages; the 100% rule",
      "WBS dictionary: acceptance criteria, resources, and cost estimates per work package",
    ],
    resources: [
      R("Wikipedia — Work breakdown structure", "https://en.wikipedia.org/wiki/Work_breakdown_structure"),
      R("Atlassian — What is a WBS?", "https://www.atlassian.com/agile/project-management/work-breakdown-structure"),
    ],
  },
  "Critical Path Method": {
    cat: "Planning",
    learn: [
      "Forward/backward pass to compute ES/EF/LS/LF, and total float per activity",
      "Fast tracking vs crashing to compress a schedule, and why both only help ON the critical path",
    ],
    resources: [
      R("Wikipedia — Critical path method", "https://en.wikipedia.org/wiki/Critical_path_method"),
      R("Atlassian — Critical path method", "https://www.atlassian.com/agile/project-management/critical-path"),
    ],
  },
  "Critical Chain Method": {
    cat: "Planning",
    learn: [
      "Resource-constrained scheduling on top of logical dependencies, unlike plain CPM",
      "Project/feeding buffers pooling contingency instead of padding every task estimate",
    ],
    resources: [R("Wikipedia — Critical chain project management", "https://en.wikipedia.org/wiki/Critical_chain_project_management")],
  },
  "Gantt Chart": {
    cat: "Planning",
    learn: [
      "Bars on a timeline showing start/end/duration/overlap; dependency lines between tasks",
      "When a milestone chart or network diagram communicates better than a full Gantt",
    ],
    resources: [
      R("Wikipedia — Gantt chart", "https://en.wikipedia.org/wiki/Gantt_chart"),
      R("Atlassian — What is a Gantt chart?", "https://www.atlassian.com/agile/project-management/gantt-chart"),
    ],
  },
  "Resource Leveling": {
    cat: "Planning",
    learn: [
      "Resolving resource over-allocation, potentially delaying the project end date",
      "Resource smoothing as the 'free' first attempt — only within existing float",
    ],
    resources: [R("Wikipedia — Resource leveling", "https://en.wikipedia.org/wiki/Resource_leveling")],
  },
  "Cost Estimating Techniques": {
    cat: "Planning",
    learn: [
      "Analogous, parametric, bottom-up, and three-point (PERT) estimating, and when each fits",
      "PERT formula (O + 4M + P) / 6 and the standard deviation it implies",
    ],
    resources: [
      R("Wikipedia — Cost estimate", "https://en.wikipedia.org/wiki/Cost_estimate"),
      R("Wikipedia — Three-point estimation", "https://en.wikipedia.org/wiki/Three-point_estimation"),
    ],
  },
  "RACI Matrix": {
    cat: "Execution",
    learn: [
      "Responsible/Accountable/Consulted/Informed — exactly one Accountable owner per task",
      "Using it for genuinely ambiguous cross-functional work, not every trivial task",
    ],
    resources: [
      R("Wikipedia — Responsibility assignment matrix", "https://en.wikipedia.org/wiki/Responsibility_assignment_matrix"),
      R("Atlassian — RACI chart", "https://www.atlassian.com/work-management/project-management/raci-chart"),
    ],
  },
  "Change Control": {
    cat: "Execution",
    learn: [
      "Formal process to identify, assess, and approve/reject changes to the baselined plan",
      "Why even a 'small' change should still go through it, and how a CCB decides",
    ],
    resources: [
      R("Wikipedia — Change control", "https://en.wikipedia.org/wiki/Change_control"),
      R("Atlassian — Change management", "https://www.atlassian.com/itsm/change-management"),
    ],
  },
  "Earned Value Management": {
    cat: "Execution",
    learn: [
      "PV/EV/AC, and deriving CPI/SPI, CV/SV, EAC/ETC/VAC, and TCPI from them",
      "Why CPI is considered a strong predictor of final cost performance even mid-project",
    ],
    resources: [R("Wikipedia — Earned value management", "https://en.wikipedia.org/wiki/Earned_value_management")],
  },
  "Procurement Management": {
    cat: "Execution",
    learn: [
      "Contract types — fixed-price, cost-reimbursable, time & materials — and how risk allocation differs",
      "Statement of Work (SOW) detail needed for comparable vendor bids and clear acceptance",
    ],
    resources: [
      R("Wikipedia — Procurement", "https://en.wikipedia.org/wiki/Procurement"),
      R("Wikipedia — Statement of work", "https://en.wikipedia.org/wiki/Statement_of_work"),
    ],
  },
  "Quality Management": {
    cat: "Execution",
    learn: [
      "Quality Assurance (process-focused) vs Quality Control (product-focused)",
      "Cost of quality: prevention/appraisal spend vs internal/external failure cost",
    ],
    resources: [
      R("Wikipedia — Quality management", "https://en.wikipedia.org/wiki/Quality_management"),
      R("Wikipedia — Cost of quality", "https://en.wikipedia.org/wiki/Cost_of_quality"),
    ],
  },
  "Milestone Tracking": {
    cat: "Execution",
    learn: [
      "Zero-duration events on the schedule marking significant progress points",
      "Milestone-weighted vs percent-complete vs fixed-formula (50/50) progress tracking",
    ],
    resources: [R("Wikipedia — Milestone (project management)", "https://en.wikipedia.org/wiki/Milestone_(project_management)")],
  },
  "RAID Log": {
    cat: "Risk",
    learn: [
      "Risks, Assumptions, Issues, Dependencies tracked together in one consolidated log",
      "Why the four categories interact (an unvalidated assumption becoming an issue, etc.)",
    ],
    resources: [
      R("Atlassian — RAID log template", "https://www.atlassian.com/work-management/project-management/raid-log"),
      R("PMI — What is Risk Management", "https://www.pmi.org/about/learn-about-pmi/what-is-risk-management"),
    ],
  },
  "Risk Register": {
    cat: "Risk",
    learn: [
      "Fields every entry needs: description, probability/impact, owner, response, trigger, status",
      "Probability-impact matrix for qualitative analysis vs EMV/Monte Carlo for quantitative",
    ],
    resources: [
      R("Wikipedia — Risk register", "https://en.wikipedia.org/wiki/Risk_register"),
      R("PMI — What is Risk Management", "https://www.pmi.org/about/learn-about-pmi/what-is-risk-management"),
    ],
  },
  "Risk Response Strategies": {
    cat: "Risk",
    learn: [
      "Threats: avoid, mitigate, transfer, accept. Opportunities: exploit, enhance, share, accept",
      "Secondary risk (created by a response) vs residual risk (what remains after it)",
    ],
    resources: [R("Wikipedia — Risk management", "https://en.wikipedia.org/wiki/Risk_management")],
  },
  "Contingency Reserve": {
    cat: "Risk",
    learn: [
      "Contingency reserve (known risks, PM-controlled) vs management reserve (unknown-unknowns, sponsor-approved)",
      "Deriving a defensible reserve figure from the sum of individual risk EMVs",
    ],
    resources: [R("Wikipedia — Cost contingency", "https://en.wikipedia.org/wiki/Cost_contingency")],
  },
  "MS Project": {
    cat: "Tools",
    learn: [
      "Detailed Gantt charts, network diagrams, resource leveling, and CPM/EVM-grade baseline tracking",
      "Best suited to larger projects with genuinely complex, interdependent schedules",
    ],
    resources: [
      R("Microsoft — Project home", "https://www.microsoft.com/en-us/microsoft-365/project/project-management-software"),
      R("Microsoft Learn — Project documentation", "https://learn.microsoft.com/en-us/project/"),
    ],
  },
  Smartsheet: {
    cat: "Tools",
    learn: [
      "Spreadsheet-like collaborative work management with Gantt views, automation, and dashboards",
      "Broader cross-functional usability, at the cost of less deep schedule-network rigor than MS Project",
    ],
    resources: [R("Smartsheet", "https://www.smartsheet.com/"), R("Wikipedia — Smartsheet", "https://en.wikipedia.org/wiki/Smartsheet")],
  },
  "Monday.com": {
    cat: "Tools",
    learn: [
      "Configurable boards (Kanban/Gantt/calendar) favored for ease of adoption and flexibility",
      "Lighter than MS Project/Primavera for deep critical-path/resource-leveling analysis",
    ],
    resources: [R("monday.com", "https://monday.com/"), R("Wikipedia — monday.com", "https://en.wikipedia.org/wiki/Monday.com")],
  },
  "Primavera P6": {
    cat: "Tools",
    learn: [
      "Enterprise-grade scheduling for very large activity counts and multi-project/portfolio resourcing",
      "The standard in construction/engineering/government infrastructure programs with strict contractual schedule rigor",
    ],
    resources: [
      R("Oracle — Primavera P6 EPPM", "https://www.oracle.com/construction-engineering/primavera-p6/"),
      R("Wikipedia — Primavera (software)", "https://en.wikipedia.org/wiki/Primavera_(software)"),
    ],
  },
  Asana: {
    cat: "Tools",
    learn: [
      "Task/workflow management emphasizing team collaboration and lightweight timelines",
      "A fit for execution-tracking or smaller projects, not deep CPM/EVM-grade rigor",
    ],
    resources: [R("Asana", "https://asana.com/"), R("Wikipedia — Asana, Inc.", "https://en.wikipedia.org/wiki/Asana,_Inc.")],
  },
};
