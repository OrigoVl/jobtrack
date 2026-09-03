// Product management track (see shared/tracks.ts's Track union) knowledge-base entries — split out of
// ../knowledge-base.ts's KB object purely for reviewable diffs; see that file's own header
// comment for the full KB shape (learn bullets + resources per technology). No logic here.
import type { KbEntry } from "../knowledge-base.js";
import { R } from "./resource.js";

export const PRODUCT_KB: Record<string, KbEntry> = {
  // ---------- Product track additions ----------
  "Product Ops": {
    cat: "Core",
    learn: [
      "Owns tooling/process standardization and feedback synthesis across PM teams, freeing PMs for strategy work",
      "Common outputs: a single feedback taxonomy, roadmap tooling upkeep, recurring metrics/reporting",
    ],
    resources: [
      R("Product School — What Is Product Operations?", "https://productschool.com/blog/product-fundamentals/product-operations"),
      R("Mind the Product — Product Ops", "https://www.mindtheproduct.com/tag/product-ops/"),
    ],
  },
  "TAM/SAM/SOM": {
    cat: "Core",
    learn: [
      "TAM (total market) → SAM (realistically serviceable) → SOM (realistically obtainable, given competition/GTM capacity)",
      "Use it to sanity-check whether an initiative is worth building, not just whether it's technically excellent",
    ],
    resources: [R("Product School — TAM SAM SOM", "https://productschool.com/blog/product-fundamentals/tam-sam-som")],
  },
  "Business Model Canvas": {
    cat: "Core",
    learn: [
      "9 blocks: segments, value props, channels, relationships, revenue, resources, activities, partnerships, costs",
      "Checks that a product solves a real problem AND sits inside a viable business, not just a good idea",
    ],
    resources: [R("Strategyzer — Business Model Canvas", "https://www.strategyzer.com/canvas/business-model-canvas")],
  },
  "Value Proposition Canvas": {
    cat: "Core",
    learn: [
      "Maps customer jobs/pains/gains against the product's pain relievers/gain creators",
      "Used early in discovery to sanity-check fit before investing in build",
    ],
    resources: [R("Strategyzer — Value Proposition Canvas", "https://www.strategyzer.com/canvas/value-proposition-canvas")],
  },
  "Product-Market Fit": {
    cat: "Core",
    learn: [
      "Signals: strong organic growth, high retention, shortening sales cycles, inbound demand outpacing spend",
      "Not binary or permanent — can erode as the market or competitive landscape shifts",
    ],
    resources: [
      R("a16z — The Only Thing That Matters", "https://a16z.com/2007/06/25/the-only-thing-that-matters/"),
      R("First Round Review — 12 Things About Product-Market Fit", "https://review.firstround.com/12-things-about-product-market-fit"),
    ],
  },
  "Product-Led Growth": {
    cat: "Core",
    learn: [
      "The product itself drives acquisition/conversion/expansion — free trials, in-product upsell, virality",
      "Often blended with sales-led motion for larger/enterprise accounts ('product-led sales')",
    ],
    resources: [R("ProductLed — What Is Product-Led Growth?", "https://productled.com/blog/product-led-growth-definition")],
  },
  "Go-to-Market Strategy": {
    cat: "Core",
    learn: [
      "Covers positioning, target segment, channel, pricing, and launch/sales-enablement plan for a release",
      "A PM's roadmap work and a PMM's GTM plan should be built together, not handed off at the last minute",
    ],
    resources: [R("Product School — Go-To-Market Strategy", "https://productschool.com/blog/product-strategy/go-to-market-strategy")],
  },
  "Jobs-to-be-Done": {
    cat: "Discovery",
    learn: [
      "Frames research around the 'progress' a customer is trying to make, not the product or demographics",
      "Surfaces competitors you wouldn't otherwise consider — anything competing for the same underlying job",
    ],
    resources: [
      R("JTBD.info", "https://jtbd.info/"),
      R("HBR — Know Your Customers' 'Jobs to Be Done'", "https://hbr.org/2016/09/know-your-customers-jobs-to-be-done"),
    ],
  },
  "Customer Interviews": {
    cat: "Discovery",
    learn: [
      "Ask about specific past behavior/facts, not hypothetical opinions or predictions (see The Mom Test)",
      "Weekly touchpoints (continuous discovery) beat occasional large research 'sprints'",
    ],
    resources: [
      R("The Mom Test", "http://momtestbook.com/"),
      R("Y Combinator — How to Talk to Users", "https://www.ycombinator.com/library/6f-how-to-talk-to-users"),
    ],
  },
  "Competitive Analysis": {
    cat: "Discovery",
    learn: [
      "Positioning maps and win/loss interviews reveal more than a feature-checkbox matrix",
      "Use a JTBD lens — competitors for the same underlying job, not just literal feature-for-feature rivals",
    ],
    resources: [R("Product School — Competitive Analysis", "https://productschool.com/blog/product-strategy/competitive-analysis")],
  },
  "Product Vision & Strategy": {
    cat: "Discovery",
    learn: [
      "Vision: long-term aspirational picture. Strategy: concrete plan (segments/bets) over a shorter horizon",
      "A vision doc should be concrete enough to rule things out, abstract enough to survive many roadmap cycles",
    ],
    resources: [R("SVPG — Marty Cagan's articles", "https://www.svpg.com/articles/")],
  },
  "Design Thinking": {
    cat: "Discovery",
    learn: [
      "Empathize → Define → Ideate → Prototype → Test, with PMs typically leading the first/last stages",
      "Skipping a stage (e.g. Empathize straight to Prototype) risks solving a poorly-defined problem",
    ],
    resources: [
      R("IDEO — Design Thinking", "https://designthinking.ideo.com/"),
      R("Interaction Design Foundation — Design Thinking", "https://www.interaction-design.org/literature/topics/design-thinking"),
    ],
  },
  MVP: {
    cat: "Discovery",
    learn: [
      "The smallest thing that tests the riskiest assumption or delivers core value to a narrow segment",
      "'Cut scope until it fits the deadline' isn't an MVP if what remains no longer tests anything meaningful",
    ],
    resources: [R("Lean Startup — Principles", "http://theleanstartup.com/principles")],
  },
  "Opportunity Solution Tree": {
    cat: "Discovery",
    learn: [
      "Outcome → opportunities (needs/pains) → candidate solutions → experiments, all explicitly linked",
      "Prevents jumping from a metric straight to a favorite solution without mapping the space in between",
    ],
    resources: [R("Product Talk — Opportunity Solution Trees", "https://www.producttalk.org/opportunity-solution-tree/")],
  },
  "Voice of Customer": {
    cat: "Discovery",
    learn: [
      "Systematic capture/tagging/synthesis of feedback across channels into themes the team can act on",
      "Needs a consistent taxonomy plus a visible loop back to whoever raised the feedback",
    ],
    resources: [R("ProductPlan — Voice of the Customer", "https://www.productplan.com/glossary/voice-of-the-customer/")],
  },
  "RICE Prioritization": {
    cat: "Delivery",
    learn: [
      "Score = (Reach x Impact x Confidence) / Effort — best for comparing many disparate ideas",
      "Only as good as the honesty of the 4 estimates that feed it — Confidence should genuinely discount guesses",
    ],
    resources: [
      R(
        "Intercom — RICE: Simple Prioritization for Product Managers",
        "https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/",
      ),
      R("ProductPlan — RICE Scoring Model", "https://www.productplan.com/glossary/rice-scoring-model/"),
    ],
  },
  "MoSCoW Prioritization": {
    cat: "Delivery",
    learn: [
      "Must / Should / Could / Won't have — fast, shared language for scoping one release under time pressure",
      "Breaks down once 'Must Have' loses scarcity — cap the count or ask 'does the release fail without it?'",
    ],
    resources: [R("ProductPlan — MoSCoW Prioritization", "https://www.productplan.com/glossary/moscow-prioritization/")],
  },
  "Kano Model": {
    cat: "Delivery",
    learn: [
      "Basic/must-be, Performance, and Delighter features have different satisfaction curves",
      "Warns against over-investing in basics past 'good enough' while starving delighters, and vice versa",
    ],
    resources: [R("ProductPlan — Kano Model", "https://www.productplan.com/glossary/kano-model/")],
  },
  "Product Roadmapping": {
    cat: "Delivery",
    learn: [
      "Now/Next/Later or theme-based formats communicate confidence honestly vs a rigidly dated roadmap",
      "Tailor framing (not the underlying plan) to execs vs sales vs engineering audiences",
    ],
    resources: [R("Aha! — Guide to Product Roadmaps", "https://www.aha.io/roadmapping/guide")],
  },
  "User Story Mapping": {
    cat: "Delivery",
    learn: [
      "Arrange stories along the user's actual workflow (backbone) to spot MVP slices and gaps visually",
      "Vertical slicing (thin, end-to-end value) beats splitting by technical layer for incremental delivery",
    ],
    resources: [R("Jeff Patton & Associates — Story Mapping", "https://www.jpattonassociates.com/story-mapping/")],
  },
  "Backlog Refinement": {
    cat: "Delivery",
    learn: [
      "Recurring session to clarify requirements, split large stories, estimate, and re-order before planning",
      "A story should meet Definition of Ready here — not be discovered too-big-to-fit at sprint planning",
    ],
    resources: [R("Scrum.org — What is Backlog Refinement?", "https://www.scrum.org/resources/what-is-backlog-refinement")],
  },
  OKRs: {
    cat: "Analytics",
    learn: [
      "Objectives (qualitative, ambitious) + Key Results (measurable outcomes, not tasks), 2-4 per objective",
      "Tying attainment directly to performance reviews pushes teams to sandbag safe targets — decouple the two",
    ],
    resources: [
      R("Google re:Work — Set Goals with OKRs", "https://rework.withgoogle.com/guides/set-goals-with-okrs/steps/introduction/"),
      R("What Matters — OKRs", "https://www.whatmatters.com/"),
    ],
  },
  "North Star Metric": {
    cat: "Analytics",
    learn: [
      "One metric that best captures delivered value and correlates with long-term business success",
      "Should be a leading, team-influenceable indicator — not a lagging outcome like raw revenue",
    ],
    resources: [R("Amplitude — North Star Playbook", "https://amplitude.com/north-star")],
  },
  "Cohort Analysis": {
    cat: "Analytics",
    learn: [
      "Group users by shared start date, track retention/revenue per cohort separately over time",
      "Reveals trend direction an aggregate metric can mask (flat MAU hiding worsening per-cohort retention)",
    ],
    resources: [R("Amplitude Docs — Cohort Analysis", "https://amplitude.com/docs")],
  },
  "Funnel Analysis": {
    cat: "Analytics",
    learn: [
      "Measure conversion between each consecutive step toward a goal to find the steepest relative drop-off",
      "Pair the quantitative WHERE with qualitative research (interviews, session recordings) for WHY",
    ],
    resources: [R("Mixpanel Docs — Funnels", "https://docs.mixpanel.com/")],
  },
  "AARRR / Pirate Metrics": {
    cat: "Analytics",
    learn: [
      "Acquisition, Activation, Retention, Referral, Revenue — localizes which funnel stage a problem lives in",
      "Organizes growth experiments by funnel stage rather than testing changes randomly",
    ],
    resources: [R("ProductPlan — Pirate Metrics (AARRR)", "https://www.productplan.com/glossary/pirate-metrics/")],
  },
  "Churn Analysis": {
    cat: "Analytics",
    learn: [
      "Logo churn (customer count) vs revenue churn (dollars) can diverge sharply — track both",
      "Segment churned customers by plan/cohort/onboarding to find real patterns, not just a topline rate",
    ],
    resources: [R("Baremetrics Academy — Churn Rate", "https://baremetrics.com/academy/churn-rate")],
  },
  Confluence: {
    cat: "Tools",
    learn: [
      "Central, linkable home for PRDs, vision/strategy docs, and decision logs — not scattered Docs/Slack",
      "Value comes from a consistent template per doc type plus a searchable, browsable space structure",
    ],
    resources: [R("Atlassian — Confluence Guides", "https://www.atlassian.com/software/confluence/guides")],
  },
  Amplitude: {
    cat: "Tools",
    learn: [
      "User-level, event-based product analytics — cohorts, retention, funnels, behavioral segmentation",
      "Best for 'what did this group of users do inside the product over time', not traffic-source questions",
    ],
    resources: [R("Amplitude Docs", "https://amplitude.com/docs")],
  },
  Mixpanel: {
    cat: "Tools",
    learn: [
      "Event-based product analytics with substantial overlap with Amplitude (funnels, retention, cohorts)",
      "Analysis quality is bounded by the tracking plan feeding it, not by which tool is chosen",
    ],
    resources: [R("Mixpanel Docs", "https://docs.mixpanel.com/")],
  },
  Productboard: {
    cat: "Tools",
    learn: [
      "Aggregates/tags customer feedback against a structured backlog of insights and features",
      "Generates stakeholder-facing roadmap views decoupled from JIRA's execution-level detail",
    ],
    resources: [R("Productboard — Product Resources", "https://www.productboard.com/")],
  },
  Pendo: {
    cat: "Tools",
    learn: [
      "In-app adoption platform: feature usage analytics plus in-app guides/tooltips/NPS without an engineering release",
      "Lets a PM iterate on onboarding/adoption nudges independent of the engineering release cycle",
    ],
    resources: [R("Pendo — Resources", "https://www.pendo.io/resources/")],
  },
  "Aha!": {
    cat: "Tools",
    learn: [
      "Structured hierarchy: strategic goals → initiatives → features → linked JIRA/Azure DevOps tickets",
      "Generates audience-specific roadmap views (public vs internal) from one underlying dataset",
    ],
    resources: [R("Aha! — Guide to Product Roadmaps", "https://www.aha.io/roadmapping/guide")],
  },
};
