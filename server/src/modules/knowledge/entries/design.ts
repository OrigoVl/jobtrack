// Design/UX track (see shared/tracks.ts's Track union) knowledge-base entries — split out of
// ../knowledge-base.ts's KB object purely for reviewable diffs; see that file's own header
// comment for the full KB shape (learn bullets + resources per technology). No logic here.
import type { KbEntry } from "../knowledge-base.js";
import { R } from "./resource.js";

export const DESIGN_KB: Record<string, KbEntry> = {
  // ---------- Design track additions ----------
  Figma: {
    cat: "Tools",
    learn: [
      "Real-time multiplayer editing, comments, and shareable prototype links replace manual file-passing",
      "Components/variants + Auto Layout for consistent, resizable UI pieces",
      "Dev Mode generates measurements/tokens/code snippets directly for handoff",
    ],
    resources: [R("Figma Help Center", "https://help.figma.com/"), R("Figma — Best Practices", "https://www.figma.com/best-practices/")],
  },
  Sketch: {
    cat: "Tools",
    learn: [
      "macOS-only vector UI design tool, built around a large plugin ecosystem",
      "Predates Figma's dominance — still used by teams invested in its plugins or local-file workflows",
    ],
    resources: [R("Sketch — Docs", "https://www.sketch.com/docs/")],
  },
  "Adobe XD": {
    cat: "Tools",
    learn: [
      "Adobe's UI/UX design and prototyping tool, integrated with Creative Cloud (Illustrator/Photoshop assets)",
      "Adobe has stopped actively developing new XD features — Figma is now the default for new teams",
    ],
    resources: [R("Adobe XD", "https://www.adobe.com/products/xd.html")],
  },
  FigJam: {
    cat: "Tools",
    learn: [
      "Digital whiteboard for brainstorming, affinity mapping, and journey mapping — not pixel-precise UI",
      "Tightly integrated with Figma, but a deliberately separate, looser collaboration space",
    ],
    resources: [R("FigJam", "https://www.figma.com/figjam/")],
  },
  Miro: {
    cat: "Tools",
    learn: [
      "General-purpose online whiteboard for workshops, retros, and research synthesis with distributed teams",
      "Overlaps with FigJam — teams typically standardize on one rather than running both",
    ],
    resources: [R("Miro — Guides", "https://miro.com/guides/")],
  },
  Zeplin: {
    cat: "Handoff",
    learn: [
      "Dedicated design-to-developer handoff tool: specs, style guides, and exportable assets from imported designs",
      "Figma's native Dev Mode now covers much of this for Figma-only teams — Zeplin remains relevant across multiple design tools",
    ],
    resources: [R("Zeplin", "https://zeplin.io/"), R("Zeplin — Blog", "https://blog.zeplin.io/")],
  },
  Maze: {
    cat: "Research",
    learn: [
      "Unmoderated testing of interactive Figma prototypes at scale — heatmaps, click paths, task success/time",
      "No live moderator, so it can't probe unexpected behavior the way a moderated session can",
    ],
    resources: [R("Maze — Guides", "https://maze.co/guides/")],
  },
  UserTesting: {
    cat: "Research",
    learn: [
      "Recruits from a large panel of real users; records video/audio of them thinking aloud on tasks",
      "Faster and broader reach than scheduling your own moderated sessions, at the cost of live follow-up questions",
    ],
    resources: [R("UserTesting — Resources", "https://www.usertesting.com/resources")],
  },
  "Design Systems": {
    cat: "UI",
    learn: [
      "Component library + design tokens + usage guidelines + governance, not just 'a Figma file with reusable pieces'",
      "The library is an artifact the system produces — consistency comes from the principles and process behind it",
    ],
    resources: [
      R("Nielsen Norman Group — Design Systems 101", "https://www.nngroup.com/articles/design-systems-101/"),
      R("Design Systems Repo", "https://designsystemsrepo.com/"),
    ],
  },
  Wireframing: {
    cat: "Prototyping",
    learn: [
      "Low-fidelity, largely grayscale structural blueprint — layout/hierarchy, deliberately stripped of visual styling",
      "Lets structure/flow decisions get evaluated without color/typography biasing the feedback",
    ],
    resources: [
      R("Nielsen Norman Group — Wireframing", "https://www.nngroup.com/articles/wireframing/"),
      R("Usability.gov — Wireframing", "https://www.usability.gov/how-to-and-tools/methods/wireframing.html"),
    ],
  },
  "Usability Testing": {
    cat: "Research",
    learn: [
      "Moderated (researcher present, can probe) vs unmoderated (faster, scales, no real-time clarification)",
      "~5 participants per segment catches most common issues — fix and retest beats one large round",
    ],
    resources: [
      R("Nielsen Norman Group — Usability Testing 101", "https://www.nngroup.com/articles/usability-testing-101/"),
      R("Usability.gov — Usability Testing", "https://www.usability.gov/how-to-and-tools/methods/usability-testing.html"),
    ],
  },
  "User Research": {
    cat: "Research",
    learn: [
      "Quant (how many/how much) finds where to look; qual (why) explains what's actually happening",
      "Match method to question type — surveys, interviews, usability tests, card sorting, diary studies",
    ],
    resources: [
      R("Nielsen Norman Group — UX Research Cheat Sheet", "https://www.nngroup.com/articles/ux-research-cheat-sheet/"),
      R("Usability.gov — User Research Basics", "https://www.usability.gov/what-and-why/user-research.html"),
    ],
  },
  "Information Architecture": {
    cat: "Core",
    learn: [
      "How content/navigation is structured and labeled based on users' actual mental models, not an org chart",
      "Card sorting (generative) then tree testing (evaluative) is the standard validation sequence",
    ],
    resources: [
      R("Nielsen Norman Group — Information Architecture 101", "https://www.nngroup.com/articles/information-architecture-101/"),
      R("Information Architecture Institute", "https://www.iainstitute.org/"),
    ],
  },
  "Accessibility (a11y)": {
    cat: "UI",
    learn: [
      "Never rely on color alone; verify contrast, focus order, and keyboard-only navigation",
      "ARIA roles/labels for any custom (non-native) interactive component",
    ],
    resources: [R("W3C — Web Accessibility Initiative", "https://www.w3.org/WAI/"), R("The A11Y Project", "https://www.a11yproject.com/")],
  },
  WCAG: {
    cat: "UI",
    learn: [
      "4.5:1 contrast for normal text at AA (3:1 for large text); AAA is stricter (7:1) and rarely a blanket target",
      "AA is the practical baseline most legal accessibility requirements reference",
    ],
    resources: [
      R("WCAG 2.2 — Quick Reference", "https://www.w3.org/WAI/WCAG22/quickref/"),
      R("WebAIM — Contrast Checker", "https://webaim.org/resources/contrastchecker/"),
    ],
  },
  Persona: {
    cat: "Research",
    learn: [
      "Useful personas are built from real research patterns, not demographic filler nobody consults",
      "Teams reference a good persona when making trade-offs, not just as a poster on the wall",
    ],
    resources: [
      R("Nielsen Norman Group — Personas", "https://www.nngroup.com/articles/persona/"),
      R("Usability.gov — Personas", "https://www.usability.gov/how-to-and-tools/methods/personas.html"),
    ],
  },
  "User Journey Mapping": {
    cat: "Research",
    learn: [
      "Stages, actions, thoughts/emotions, pain points, and opportunities across the full end-to-end experience",
      "Spots friction a single-feature view misses, e.g. a support interaction no UI redesign alone would fix",
    ],
    resources: [
      R("Nielsen Norman Group — Journey Mapping 101", "https://www.nngroup.com/articles/journey-mapping-101/"),
      R("Usability.gov — Journey Mapping", "https://www.usability.gov/how-to-and-tools/methods/journey-mapping.html"),
    ],
  },
  "Heuristic Evaluation": {
    cat: "Core",
    learn: [
      "3-5 evaluators independently review a UI against Nielsen's 10 usability heuristics, then aggregate findings",
      "Prioritize fixes by severity x frequency x impact, not as a single pass-through checklist",
    ],
    resources: [
      R("Nielsen Norman Group — 10 Usability Heuristics", "https://www.nngroup.com/articles/ten-usability-heuristics/"),
      R(
        "Nielsen Norman Group — How to Conduct a Heuristic Evaluation",
        "https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/",
      ),
    ],
  },
  Prototyping: {
    cat: "Prototyping",
    learn: [
      "Match fidelity to what you're trying to learn — low-fi for structure/flow, hi-fi for visuals/copy/micro-interactions",
      "Interactive prototypes reveal flow-level usability problems a static mockup can't",
    ],
    resources: [R("Nielsen Norman Group — UX Prototypes: Hi-Fi vs Lo-Fi", "https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/")],
  },
  "Interaction Design": {
    cat: "UI",
    learn: [
      "Interaction patterns, feedback, and behavior — not just the visual layer",
      "Grounded in predictive models (Fitts's Law, Hick's Law) and established conventions (Jakob's Law)",
    ],
    resources: [R("Interaction Design Foundation", "https://www.interaction-design.org/"), R("Laws of UX", "https://lawsofux.com/")],
  },
  Typography: {
    cat: "UI",
    learn: [
      "Limited, deliberate type scale (H1-H3/body/caption) applied consistently to the same semantic role",
      "Line-height ~1.4-1.6x font size for readable body text",
    ],
    resources: [
      R("Material Design — Typography", "https://m3.material.io/styles/typography/overview"),
      R("Practical Typography", "https://practicaltypography.com/"),
    ],
  },
  "Color Theory": {
    cat: "UI",
    learn: [
      "Complementary (opposite on the wheel) for contrast/accents; analogous (adjacent) for cohesive, low-contrast palettes",
      "Never rely on hue alone for meaning — pair with an icon/label/pattern for accessibility",
    ],
    resources: [
      R("Material Design — Color", "https://m3.material.io/styles/color/system/overview"),
      R("Adobe Color — Color Wheel", "https://color.adobe.com/create/color-wheel"),
    ],
  },
  "Material Design": {
    cat: "UI",
    learn: [
      "Google's design system: components, tokens, and guidelines spanning Android and the web",
      "Widely used as a reference baseline even outside Android-specific products",
    ],
    resources: [
      R("Material Design (M3)", "https://m3.material.io/"),
      R("Material Design — Foundations", "https://m3.material.io/foundations"),
    ],
  },
  "Human Interface Guidelines": {
    cat: "UI",
    learn: [
      "Apple's platform conventions (iOS/iPadOS/macOS) for navigation, touch targets, and native component behavior",
      "The source for 44x44pt minimum touch target guidance widely cited across mobile design",
    ],
    resources: [
      R("Apple — Human Interface Guidelines", "https://developer.apple.com/design/human-interface-guidelines"),
      R("Apple — Design Resources", "https://developer.apple.com/design/resources/"),
    ],
  },
  "Card Sorting": {
    cat: "Research",
    learn: [
      "Open (participants create own groups) vs closed (sort into predefined categories) — generative vs evaluative",
      "Used to design/validate information architecture based on users' actual mental models",
    ],
    resources: [
      R("Nielsen Norman Group — Card Sorting", "https://www.nngroup.com/articles/card-sorting-definition/"),
      R("Usability.gov — Card Sorting", "https://www.usability.gov/how-to-and-tools/methods/card-sorting.html"),
    ],
  },
  "Design Tokens": {
    cat: "UI",
    learn: [
      "Named, platform-agnostic variables (color.primary.500) as a single source of truth for design + code",
      "Enables rebranding/theming and systematic contrast fixes across a large product without a manual hunt-and-replace",
    ],
    resources: [R("W3C — Design Tokens Community Group", "https://www.w3.org/community/design-tokens/")],
  },
  "Atomic Design": {
    cat: "UI",
    learn: [
      "Atoms -> molecules -> organisms -> templates -> pages — a shared vocabulary for component complexity",
      "Clarifies where duplication actually lives (usually the atom level) when consolidating inconsistent components",
    ],
    resources: [R("Atomic Design by Brad Frost", "https://atomicdesign.bradfrost.com/")],
  },
  "Design Critique": {
    cat: "Core",
    learn: [
      "Framed around the goal/user problem, not personal taste — 'I like / I wish / What if' keeps feedback actionable",
      "Distinct from a design review (a gate for sign-off) — critique generates options while work is in progress",
    ],
    resources: [R("Nielsen Norman Group — Design Critiques", "https://www.nngroup.com/articles/design-critiques/")],
  },
  "Dark Patterns": {
    cat: "Core",
    learn: [
      "UI/UX patterns that manipulate users into decisions benefiting the business at their expense",
      "Confirmshaming, roach motel, and sneak-into-basket are common named patterns — increasingly drawing regulatory scrutiny",
    ],
    resources: [
      R("Deceptive Design (deceptive.design)", "https://www.deceptive.design/"),
      R("FTC — Bringing Dark Patterns to Light", "https://www.ftc.gov/reports/bringing-dark-patterns-light"),
    ],
  },
  "Empathy Map": {
    cat: "Research",
    learn: [
      "Quick synthesis of what a user says/thinks/does/feels in a specific context, built from raw research notes",
      "A working artifact for shared team understanding — personas are the more polished, reusable distillation",
    ],
    resources: [R("Nielsen Norman Group — Empathy Mapping", "https://www.nngroup.com/articles/empathy-mapping/")],
  },
  Microinteractions: {
    cat: "UI",
    learn: [
      "Four parts: trigger, rules, feedback, and loops/modes (Dan Saffer's framework)",
      "Designing all four deliberately — not just visual feedback — separates a good microinteraction from mere decoration",
    ],
    resources: [
      R("Interaction Design Foundation", "https://www.interaction-design.org/"),
      R("Material Design — Motion", "https://m3.material.io/styles/motion/overview"),
    ],
  },
  "Design Handoff": {
    cat: "Handoff",
    learn: [
      "Prototype (behavior/flow) + spec (exact values/states) — handoff usually needs both, not one or the other",
      "Design tokens beat static image exports: an update propagates to every implementation referencing the token",
    ],
    resources: [R("Figma — Dev Mode", "https://www.figma.com/dev-mode/"), R("Zeplin", "https://zeplin.io/")],
  },
};
