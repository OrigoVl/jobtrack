// Business analysis track (see shared/tracks.ts's Track union) knowledge-base entries — split out of
// ../knowledge-base.ts's KB object purely for reviewable diffs; see that file's own header
// comment for the full KB shape (learn bullets + resources per technology). No logic here.
import type { KbEntry } from "../knowledge-base.js";
import { R } from "./resource.js";

export const BA_KB: Record<string, KbEntry> = {
  // ---------- BA track additions ----------
  BABOK: {
    cat: "Core",
    learn: [
      "Six knowledge areas: Planning & Monitoring, Elicitation & Collaboration, Requirements Life Cycle Management, Strategy Analysis, Requirements Analysis & Design Definition, Solution Evaluation",
      "Maintained by IIBA — the standard reference body of knowledge for the BA profession",
      "Underpins the ECBA/CCBA/CBAP certification exams",
    ],
    resources: [
      R("IIBA — BABOK Guide", "https://www.iiba.org/babok-guide/"),
      R("Wikipedia — Business Analysis Body of Knowledge", "https://en.wikipedia.org/wiki/Business_Analysis_Body_of_Knowledge"),
    ],
  },
  "CBAP Certification": {
    cat: "Core",
    learn: [
      "ECBA (entry) → CCBA (3,750+ hrs) → CBAP (7,500+ hrs across 4+ BABOK knowledge areas)",
      "All three administered by IIBA and based directly on the BABOK Guide",
    ],
    resources: [
      R("IIBA — Certifications overview", "https://www.iiba.org/business-analysis-certifications/"),
      R("IIBA — CBAP", "https://www.iiba.org/business-analysis-certifications/cbap/"),
    ],
  },
  "Business Requirements Document (BRD)": {
    cat: "Documentation",
    learn: [
      "Business-level WHY/WHAT: objectives, high-level needs, solution-agnostic",
      "Primary audience is business sponsors/stakeholders who sign off before solution design",
      "Sits above the FRD in the typical requirements hierarchy",
    ],
    resources: [
      R("Wikipedia — Business requirements", "https://en.wikipedia.org/wiki/Business_requirements"),
      R("IIBA — Business Analysis Planning and Monitoring", "https://www.iiba.org/babok-guide/"),
    ],
  },
  "Functional Requirements Document (FRD)": {
    cat: "Documentation",
    learn: [
      "Detailed, testable description of what the system must do (screen-by-screen behavior, business rules, data validation)",
      "Solution-specific, unlike the business-level BRD it's derived from",
      "Detailed enough for a dev/QA team to build and test against directly",
    ],
    resources: [
      R("Wikipedia — Functional requirement", "https://en.wikipedia.org/wiki/Functional_requirement"),
      R("Wikipedia — Software requirements specification", "https://en.wikipedia.org/wiki/Software_requirements_specification"),
    ],
  },
  "Requirements Traceability Matrix": {
    cat: "Documentation",
    learn: [
      "Links each requirement to its source, its design/build component, and the test case(s) verifying it",
      "Answers: does every requirement have a source, is it built, is it tested",
      "Built manually (spreadsheet) or via linked JIRA epics/stories for smaller efforts",
    ],
    resources: [
      R("Wikipedia — Requirements traceability", "https://en.wikipedia.org/wiki/Requirements_traceability"),
      R("PMI — Requirements Traceability Matrix", "https://www.pmi.org/learning/library/requirement-traceability-matrix-necessity-7789"),
    ],
  },
  BPMN: {
    cat: "Analysis",
    learn: [
      "Standardized notation: events (circles), tasks (rounded rectangles), gateways (diamonds), sequence flows (arrows)",
      "Exclusive/parallel/inclusive gateways model decision logic consistently across tools/teams",
      "Used for as-is/to-be process modeling and swimlane (cross-functional) diagrams",
    ],
    resources: [
      R("OMG — About the BPMN Specification", "https://www.omg.org/spec/BPMN/2.0/About-BPMN/"),
      R("Wikipedia — Business Process Model and Notation", "https://en.wikipedia.org/wiki/Business_Process_Model_and_Notation"),
    ],
  },
  "Use Case Diagrams": {
    cat: "Analysis",
    learn: [
      "Actors (roles/external systems), use cases (goals), and include/extend relationships",
      "Scope-level overview only — detailed flows live in the accompanying use case specification",
      "Distinct from a user story: formal, self-contained, includes alternate/exception flows",
    ],
    resources: [
      R("Wikipedia — Use case diagram", "https://en.wikipedia.org/wiki/Use_case_diagram"),
      R("Wikipedia — Use case", "https://en.wikipedia.org/wiki/Use_case"),
    ],
  },
  "Data Flow Diagrams (DFD)": {
    cat: "Analysis",
    learn: [
      "Four elements: external entities, processes, data stores, data flows",
      "Silent on sequencing/timing — answers 'where does data come from/go to', not 'in what order'",
      "The context diagram is the highest-level DFD, usually the first diagram drawn for a new initiative",
    ],
    resources: [R("Wikipedia — Data-flow diagram", "https://en.wikipedia.org/wiki/Data-flow_diagram")],
  },
  "SWOT Analysis": {
    cat: "Analysis",
    learn: [
      "Strengths/Weaknesses (internal) vs Opportunities/Threats (external)",
      "Used early in strategy analysis to frame a proposed change",
    ],
    resources: [R("Wikipedia — SWOT analysis", "https://en.wikipedia.org/wiki/SWOT_analysis")],
  },
  "Gap Analysis": {
    cat: "Analysis",
    learn: [
      "Compares as-is (current state) against to-be (desired future state) to identify missing capabilities",
      "Each identified gap typically becomes or informs a requirement",
    ],
    resources: [R("Wikipedia — Gap analysis", "https://en.wikipedia.org/wiki/Gap_analysis")],
  },
  "Root Cause Analysis": {
    cat: "Analysis",
    learn: [
      "5 Whys: repeatedly ask why until reaching an actual root cause, not a symptom",
      "Fishbone (Ishikawa) diagram: organizes candidate causes into categories (People/Process/Technology/Environment) when multiple contributing causes are plausible",
      "Root cause vs contributing factor vs symptom — the test: would fixing only this stop the problem recurring?",
    ],
    resources: [
      R("Wikipedia — Root cause analysis", "https://en.wikipedia.org/wiki/Root_cause_analysis"),
      R("Wikipedia — Ishikawa diagram", "https://en.wikipedia.org/wiki/Ishikawa_diagram"),
      R("Wikipedia — Five whys", "https://en.wikipedia.org/wiki/Five_whys"),
    ],
  },
  "Feasibility Analysis": {
    cat: "Analysis",
    learn: [
      "Five dimensions: technical, economic, operational, legal/regulatory, schedule",
      "A solution can pass most dimensions and still be blocked by one (e.g. operational readiness)",
    ],
    resources: [R("Wikipedia — Feasibility study", "https://en.wikipedia.org/wiki/Feasibility_study")],
  },
  "Cost-Benefit Analysis": {
    cat: "Analysis",
    learn: [
      "Compares total expected costs against total expected benefits over a defined horizon",
      "Common pitfall: counting only easily-quantified hard costs/savings while ignoring real but harder-to-quantify benefits",
    ],
    resources: [R("Wikipedia — Cost–benefit analysis", "https://en.wikipedia.org/wiki/Cost%E2%80%93benefit_analysis")],
  },
  "Stakeholder Analysis": {
    cat: "Analysis",
    learn: [
      "Identify everyone affected by/affecting the initiative; map interest, influence, and likely stance",
      "Power/interest grid: manage closely (high power+interest), keep satisfied, keep informed, monitor",
      "Feeds elicitation planning and communication strategy",
    ],
    resources: [R("Wikipedia — Stakeholder analysis", "https://en.wikipedia.org/wiki/Stakeholder_analysis")],
  },
  "JAD Sessions": {
    cat: "Elicitation",
    learn: [
      "Joint Application Development — a structured, facilitated workshop eliciting/validating requirements with multiple stakeholders in real time",
      "Differs from an ordinary meeting via a dedicated facilitator, a defined agenda, and a goal of reaching decisions in the room",
    ],
    resources: [R("Wikipedia — Joint application design", "https://en.wikipedia.org/wiki/Joint_application_design")],
  },
  "Business Rules": {
    cat: "Documentation",
    learn: [
      "A solution-independent statement that governs/constrains business behavior (e.g. 'a discount over 20% requires manager approval')",
      "Documented if/then, atomic, and independent of any UI — often in a business rules catalog separate from the requirements doc",
      "A single rule can drive multiple functional requirements and changes on its own (regulatory) cadence",
    ],
    resources: [R("Wikipedia — Business rule", "https://en.wikipedia.org/wiki/Business_rule")],
  },
  "Non-Functional Requirements (NFRs)": {
    cat: "Documentation",
    learn: [
      "Performance, security, usability/accessibility, reliability/availability, scalability, maintainability, compliance",
      "Easy to omit because stakeholders rarely volunteer them unprompted — must be actively elicited",
    ],
    resources: [R("Wikipedia — Non-functional requirement", "https://en.wikipedia.org/wiki/Non-functional_requirement")],
  },
  "Acceptance Criteria": {
    cat: "Documentation",
    learn: [
      "Specific, testable, unambiguous conditions a story/requirement must satisfy",
      "Given/When/Then (Gherkin-style) structures precondition, action, and expected outcome",
      "Distinct from Definition of Done, which applies uniformly to every story regardless of content",
    ],
    resources: [
      R("Cucumber — Gherkin Reference", "https://cucumber.io/docs/gherkin/reference/"),
      R("Wikipedia — Acceptance testing", "https://en.wikipedia.org/wiki/Acceptance_testing"),
    ],
  },
  "INVEST Criteria": {
    cat: "Documentation",
    learn: [
      "Independent, Negotiable, Valuable, Estimable, Small, Testable — a quality bar for a well-formed user story",
      "A story failing several checks usually needs splitting or clarifying before a sprint",
    ],
    resources: [R("Agile Alliance — INVEST", "https://www.agilealliance.org/glossary/invest/")],
  },
  "Vision and Scope Document": {
    cat: "Documentation",
    learn: [
      "Early-stage charter: business objectives, high-level in/out-of-scope, key stakeholders, success criteria",
      "Shorter and less detailed than a BRD — establishes the shared frame before detailed elicitation",
    ],
    resources: [R("Wikipedia — Vision statement", "https://en.wikipedia.org/wiki/Vision_statement")],
  },
  "Functional Decomposition": {
    cat: "Analysis",
    learn: [
      "Breaks a large, vague business function into progressively smaller sub-functions until each is concrete",
      "Solves the problem of a stakeholder describing something too broad to elicit detailed requirements against directly",
    ],
    resources: [R("Wikipedia — Functional decomposition", "https://en.wikipedia.org/wiki/Functional_decomposition")],
  },
  "Swimlane Diagram": {
    cat: "Analysis",
    learn: [
      "Cross-functional process diagram organized into lanes, one per role/department/system",
      "Makes handoffs between roles/departments explicit — exactly where processes tend to break down",
    ],
    resources: [R("Wikipedia — Swim lane", "https://en.wikipedia.org/wiki/Swim_lane")],
  },
  "Data Dictionary / Glossary": {
    cat: "Documentation",
    learn: [
      "Shared, agreed definition of every key term/data element/acronym used across requirements docs",
      "Prevents requirements being individually clear yet conflicting because two docs mean different things by the same word",
    ],
    resources: [R("Wikipedia — Data dictionary", "https://en.wikipedia.org/wiki/Data_dictionary")],
  },
  SIPOC: {
    cat: "Analysis",
    learn: [
      "Suppliers, Inputs, Process (5-7 high-level steps), Outputs, Customers",
      "Used very early, often before a detailed process map, to establish scope/boundaries quickly",
    ],
    resources: [R("ASQ — What is SIPOC?", "https://asq.org/quality-resources/sipoc")],
  },
  "Value Stream Mapping": {
    cat: "Analysis",
    learn: [
      "Identifies value-adding steps vs waste (waiting, rework, unnecessary handoffs) across an end-to-end flow",
      "Explicitly evaluative — every step judged against whether a customer would pay for it",
    ],
    resources: [R("Wikipedia — Value-stream mapping", "https://en.wikipedia.org/wiki/Value-stream_mapping")],
  },
  "Impact Analysis": {
    cat: "Analysis",
    learn: [
      "Assesses downstream consequences of a proposed requirement change before approving it",
      "A required input to change control — approving a change without it means approving an unknown",
    ],
    resources: [R("Wikipedia — Change impact analysis", "https://en.wikipedia.org/wiki/Change_impact_analysis")],
  },
  "Context Diagram": {
    cat: "Analysis",
    learn: [
      "The highest-level DFD: one process bubble for the whole system, surrounded by every external entity it exchanges data with",
      "Usually the very first diagram produced — agreeing the system boundary before any detailed analysis",
    ],
    resources: [R("Wikipedia — System context diagram", "https://en.wikipedia.org/wiki/System_context_diagram")],
  },
  Lucidchart: {
    cat: "Tools",
    learn: [
      "Browser-based, real-time collaborative diagramming (flowcharts, BPMN, wireframes, org charts)",
      "Native integrations with Confluence, JIRA, and Google Workspace",
      "Main advantage over Visio: simultaneous multi-user editing without desktop install",
    ],
    resources: [
      R("Lucidchart — What is Lucidchart?", "https://www.lucidchart.com/pages/what-is-lucidchart"),
      R("Lucidchart — BPMN diagrams", "https://www.lucidchart.com/pages/bpmn"),
    ],
  },
  Visio: {
    cat: "Tools",
    learn: [
      "Structured business process diagrams (flowcharts, BPMN, swimlanes, org charts) with standardized shape stencils",
      "Strong Microsoft/Office ecosystem integration; common in enterprises with existing licensing/templates",
    ],
    resources: [
      R("Microsoft — Visio overview", "https://www.microsoft.com/en-us/microsoft-365/visio/flowchart-software"),
      R("Microsoft Support — Visio help & learning", "https://support.microsoft.com/en-us/visio"),
    ],
  },
  Balsamiq: {
    cat: "Tools",
    learn: [
      "Deliberately low-fidelity, hand-drawn-style wireframes/mockups",
      "The sketchy style signals 'rough concept, not final design' — keeps early conversations on structure/content",
    ],
    resources: [
      R("Balsamiq — Wireframes", "https://balsamiq.com/wireframes/"),
      R("Balsamiq — What is wireframing?", "https://balsamiq.com/learn/articles/what-is-wireframing/"),
    ],
  },
};
