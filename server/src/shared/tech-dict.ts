// Technology dictionary for offline analysis of vacancy/CV text.
// canonical -> { cat, re } where re is a regex with aliases.
import { isFuzzyMatch } from "./fuzzy-match.js";

export interface TechDef {
  cat: string;
  re: RegExp;
}

export const TECHS: Record<string, TechDef> = {
  JavaScript: { cat: "Core", re: /\b(javascript|js|es6\+?|ecmascript)\b/i },
  TypeScript: { cat: "Core", re: /\b(typescript|ts)\b/i },
  React: { cat: "Frontend", re: /\breact(\.js|js)?\b/i },
  "Next.js": { cat: "Frontend", re: /\bnext\.?js\b/i },
  Vue: { cat: "Frontend", re: /\bvue(\.js|js)?\b/i },
  Nuxt: { cat: "Frontend", re: /\bnuxt\b/i },
  Angular: { cat: "Frontend", re: /\bangular\b/i },
  RxJS: { cat: "Frontend", re: /\brxjs\b/i },
  TailwindCSS: { cat: "Frontend", re: /\btailwind(css)?\b/i },
  "HTML/CSS": { cat: "Frontend", re: /\b(html5?|css3?|scss|sass)\b/i },
  "Node.js": { cat: "Backend", re: /\bnode(\.js|js)?\b/i },
  NestJS: { cat: "Backend", re: /\bnest(\.js|js)?\b/i },
  Express: { cat: "Backend", re: /\bexpress(\.js|js)?\b/i },
  GraphQL: { cat: "Backend", re: /\bgraphql\b/i },
  "REST API": { cat: "Backend", re: /\b(rest\s?api|restful|openapi|swagger)\b/i },
  WebSockets: { cat: "Backend", re: /\b(websocket|socket\.io|ws)\b/i },
  PostgreSQL: { cat: "Database", re: /\b(postgre?s(ql)?|pg)\b/i },
  MySQL: { cat: "Database", re: /\bmysql\b/i },
  MongoDB: { cat: "Database", re: /\bmongo(db)?\b/i },
  Redis: { cat: "Database", re: /\bredis\b/i },
  Prisma: { cat: "Database", re: /\bprisma\b/i },
  SQL: { cat: "Database", re: /\bsql\b/i },
  Docker: { cat: "DevOps", re: /\bdocker\b/i },
  Kubernetes: { cat: "DevOps", re: /\b(kubernetes|k8s)\b/i },
  AWS: { cat: "DevOps", re: /\b(aws|amazon web services|lambda|s3|ec2)\b/i },
  Azure: { cat: "DevOps", re: /\bazure\b/i },
  GCP: { cat: "DevOps", re: /\b(gcp|google cloud)\b/i },
  "CI/CD": { cat: "DevOps", re: /\b(ci\/cd|github actions|gitlab ci|jenkins)\b/i },
  Kafka: { cat: "DevOps", re: /\b(kafka|rabbitmq|message queue|event-driven)\b/i },
  Jest: { cat: "Testing", re: /\b(jest|vitest)\b/i },
  // "cypress"/"e2e" used to be lumped into this alternation — split out below (QA track needs
  // Cypress as its own distinct canonical tech, and "e2e" was too generic/ambiguous a token to
  // keep pointing at Playwright specifically once Cypress/Selenium are both in the dictionary).
  Playwright: { cat: "Testing", re: /\bplaywright\b/i },
  Git: { cat: "Tools", re: /\bgit\b/i },
  "AI/LLM": { cat: "AI", re: /\b(ai|llm|openai|anthropic|claude|gpt|cursor|copilot|rag|embeddings?|prompt)\b/i },
  Python: { cat: "Other", re: /\bpython\b/i },
  Go: { cat: "Other", re: /\b(golang|\bgo\b)\b/i },

  // ---------- Data track additions ----------
  pandas: { cat: "Tools", re: /\bpandas\b/i },
  NumPy: { cat: "Tools", re: /\bnumpy\b/i },
  "scikit-learn": { cat: "Modeling", re: /\b(scikit-?learn|sklearn)\b/i },
  dbt: { cat: "Collection", re: /\bdbt\b/i },
  Airflow: { cat: "Collection", re: /\bairflow\b/i },
  "Power BI": { cat: "Visualization", re: /\bpower\s?bi\b/i },
  Tableau: { cat: "Visualization", re: /\btableau\b/i },
  Looker: { cat: "Visualization", re: /\blooker\b/i },
  BigQuery: { cat: "Collection", re: /\bbig\s?query\b/i },
  Snowflake: { cat: "Collection", re: /\bsnowflake\b/i },
  Redshift: { cat: "Collection", re: /\bredshift\b/i },
  Databricks: { cat: "Collection", re: /\bdatabricks\b/i },
  // Excludes "excel in/at/as/beyond" (the common verb usage in job ad prose, e.g. "you'll excel
  // in a fast-paced environment") so the spreadsheet tool isn't tagged from that boilerplate.
  Excel: { cat: "Tools", re: /\bexcel\b(?!\s+(?:in|at|as|beyond)\b)/i },
  Jupyter: { cat: "Tools", re: /\bjupyter\b/i },
  "Google Sheets": { cat: "Tools", re: /\b(google sheets|g-?sheets)\b/i },
  "Google Analytics": { cat: "Tools", re: /\b(google analytics|ga4)\b/i },
  ETL: { cat: "Collection", re: /\betl\b/i },
  "A/B Testing": { cat: "Core", re: /\ba\/b\s?test(?:ing|s)?\b/i },
  "Machine Learning": { cat: "Modeling", re: /\bmachine learning\b/i },
  "Hypothesis Testing": { cat: "Core", re: /\bhypothesis test(?:ing|s)?\b/i },
  "Data Governance": { cat: "Core", re: /\bdata governance\b/i },
  "Feature Engineering": { cat: "Modeling", re: /\bfeature engineering\b/i },
  "Regression Analysis": { cat: "Modeling", re: /\bregression analysis\b/i },
  "Time Series Analysis": { cat: "Modeling", re: /\btime[- ]series\b/i },
  "Data Cleaning": { cat: "Collection", re: /\bdata (?:clean(?:ing|up)|cleansing)\b/i },
  "Data Visualization": { cat: "Visualization", re: /\bdata visuali[sz]ation\b/i },
  "Data Warehousing": { cat: "Collection", re: /\bdata warehous(?:e|ing)\b/i },

  // ---------- DevOps track additions ----------
  // "GitHub Actions"/"Jenkins"/"GitLab CI" deliberately NOT added as separate entries here —
  // "CI/CD" above already matches all three inside its own regex; a duplicate entry would just
  // be redundant with (and, for first-match-wins consumers like tag-format.ts, shadowed by) it.
  // "Packer" deliberately NOT added — it collides with the common warehouse/logistics job title
  // "packer", and this app tracks non-tech vacancies too (see the sysadmin/other tracks).
  Linux: { cat: "Core", re: /\blinux\b/i },
  "Bash Scripting": { cat: "Core", re: /\bbash\b/i },
  systemd: { cat: "Core", re: /\bsystemd\b/i },
  Terraform: { cat: "Cloud", re: /\bterraform\b/i },
  Ansible: { cat: "Tools", re: /\bansible\b/i },
  "VPC/Networking": { cat: "Cloud", re: /\bvpc\b/i },
  IAM: { cat: "Cloud", re: /\biam\b/i },
  "Load Balancing": { cat: "Cloud", re: /\bload balanc(?:er|ers|ing)\b/i },
  "Secrets Management": { cat: "Cloud", re: /\bsecrets? management\b/i },
  "Auto Scaling": { cat: "Cloud", re: /\bauto[- ]scal(?:ing|er|ers)\b/i },
  GitOps: { cat: "CI/CD", re: /\bgitops\b/i },
  ArgoCD: { cat: "CI/CD", re: /\bargo\s?cd\b/i },
  "Blue-Green Deployment": { cat: "CI/CD", re: /\bblue-green\b/i },
  "Canary Deployment": { cat: "CI/CD", re: /\bcanary (?:deployment|release)s?\b/i },
  "Feature Flags": { cat: "CI/CD", re: /\bfeature flags?\b/i },
  // Excludes "at/take/took/holds the helm of" (a common leadership idiom in job-ad prose, e.g.
  // "she's at the helm of the engineering org") so the Kubernetes package manager isn't tagged
  // from that boilerplate.
  Helm: { cat: "Containers", re: /\bhelm\b(?!\s+of\b)/i },
  "Container Registry": { cat: "Containers", re: /\bcontainer registr(?:y|ies)\b/i },
  Prometheus: { cat: "Monitoring", re: /\bprometheus\b/i },
  Grafana: { cat: "Monitoring", re: /\bgrafana\b/i },
  "SRE/SLO": { cat: "Monitoring", re: /\b(?:sre|slo)\b/i },
  "Distributed Tracing": { cat: "Monitoring", re: /\bdistributed tracing\b/i },
  "Log Aggregation": { cat: "Monitoring", re: /\blog aggregation\b/i },
  "Incident Response": { cat: "Monitoring", re: /\bincident response\b/i },
  "Chaos Engineering": { cat: "Monitoring", re: /\bchaos engineering\b/i },
  Nginx: { cat: "Tools", re: /\bnginx\b/i },
  Vault: { cat: "Tools", re: /\bvault\b/i },
  Vagrant: { cat: "Tools", re: /\bvagrant\b/i },
  "Configuration Drift": { cat: "Tools", re: /\bconfiguration drift\b/i },

  // ---------- QA track additions ----------
  Selenium: { cat: "Automation", re: /\bselenium\b/i },
  Cypress: { cat: "Automation", re: /\bcypress\b/i },
  Appium: { cat: "Automation", re: /\bappium\b/i },
  "Page Object Model": { cat: "Automation", re: /\bpage object model\b/i },
  "Cucumber/BDD": { cat: "Automation", re: /\b(cucumber|gherkin|bdd)\b/i },
  "Robot Framework": { cat: "Automation", re: /\brobot framework\b/i },
  "Visual Regression Testing": { cat: "Automation", re: /\bvisual regression\b/i },
  "Data-Driven Testing": { cat: "Automation", re: /\bdata[- ]driven test(?:ing|s)?\b/i },
  Postman: { cat: "API Testing", re: /\bpostman\b/i },
  "Contract Testing": { cat: "API Testing", re: /\bcontract test(?:ing|s)?\b/i },
  WireMock: { cat: "API Testing", re: /\bwiremock\b/i },
  SoapUI: { cat: "API Testing", re: /\bsoap\s?ui\b/i },
  "API Testing": { cat: "API Testing", re: /\bapi test(?:ing|s)?\b/i },
  JMeter: { cat: "Tools", re: /\bjmeter\b/i },
  k6: { cat: "Tools", re: /\bk6\b/i },
  TestRail: { cat: "Tools", re: /\btestrail\b/i },
  BrowserStack: { cat: "Tools", re: /\bbrowserstack\b/i },
  "Sauce Labs": { cat: "Tools", re: /\bsauce\s?labs\b/i },
  "Charles Proxy": { cat: "Tools", re: /\bcharles\s?proxy\b/i },
  "axe-core": { cat: "Tools", re: /\baxe-core\b/i },
  JIRA: { cat: "Tools", re: /\bjira\b/i },
  "Boundary Value Analysis": { cat: "Manual Testing", re: /\bboundary value analysis\b/i },
  "Equivalence Partitioning": { cat: "Manual Testing", re: /\bequivalence partitioning\b/i },
  "Decision Table Testing": { cat: "Manual Testing", re: /\bdecision tables?\b/i },
  "State Transition Testing": { cat: "Manual Testing", re: /\bstate transition test(?:ing|s)?\b/i },
  "Smoke Testing": { cat: "Manual Testing", re: /\bsmoke test(?:ing|s)?\b/i },
  "Regression Testing": { cat: "Manual Testing", re: /\bregression test(?:ing|s)?\b/i },
  "Exploratory Testing": { cat: "Manual Testing", re: /\bexploratory test(?:ing|s)?\b/i },
  "Accessibility Testing": { cat: "Manual Testing", re: /\baccessibility test(?:ing|s)?\b/i },
  "Test Data Management": { cat: "Manual Testing", re: /\btest data management\b/i },
};

export interface TechMatch {
  name: string;
  cat: string;
}

// Compound names (two words/abbreviations) are excluded from the fuzzy fallback: merging
// "REST API" -> "restapi" for Levenshtein distance comparison yields mostly useless matches
// (typical typos happen within a SINGLE word, not in a merged phrase).
const FUZZY_EXCLUDE = new Set([
  "REST API",
  "HTML/CSS",
  "CI/CD",
  "AI/LLM",
  "scikit-learn",
  "Power BI",
  "Google Sheets",
  "Google Analytics",
  "A/B Testing",
  "Machine Learning",
  "Hypothesis Testing",
  "Data Governance",
  "Feature Engineering",
  "Regression Analysis",
  "Time Series Analysis",
  "Data Cleaning",
  "Data Visualization",
  "Data Warehousing",
  // "Excel" is single-word but also excluded: its exact regex deliberately excludes the common
  // verb usage ("you'll excel in/at/as...") via a negative lookahead, and isFuzzyMatch treats an
  // exact string match as always within tolerance (distance 0) regardless of word length — so
  // without this exclusion, the fuzzy fallback would immediately undo that lookahead by
  // re-matching the literal token "excel" the regex just deliberately passed on.
  "Excel",
  // DevOps track additions — multi-word/punctuated names excluded for the same reason as the
  // data-track ones above (merging into one alphanumeric token yields useless typo comparisons).
  "Bash Scripting",
  "VPC/Networking",
  "Load Balancing",
  "Secrets Management",
  "Auto Scaling",
  "Blue-Green Deployment",
  "Canary Deployment",
  "Feature Flags",
  "Container Registry",
  "SRE/SLO",
  "Distributed Tracing",
  "Log Aggregation",
  "Incident Response",
  "Chaos Engineering",
  "Configuration Drift",
  // QA track additions — same reasoning: merging these into one alphanumeric token for
  // Levenshtein comparison would produce useless typo matches for a multi-word/punctuated name.
  "Page Object Model",
  "Cucumber/BDD",
  "Robot Framework",
  "Visual Regression Testing",
  "Data-Driven Testing",
  "Contract Testing",
  "API Testing",
  "Sauce Labs",
  "Charles Proxy",
  "axe-core",
  "Boundary Value Analysis",
  "Equivalence Partitioning",
  "Decision Table Testing",
  "State Transition Testing",
  "Smoke Testing",
  "Regression Testing",
  "Exploratory Testing",
  "Accessibility Testing",
  "Test Data Management",
]);
const FUZZY_KEYS: { name: string; key: string }[] = Object.keys(TECHS)
  .filter((name) => !FUZZY_EXCLUDE.has(name))
  .map((name) => ({ name, key: name.toLowerCase().replace(/[^a-z0-9]/g, "") }));

/**
 * Finds technologies in arbitrary text: first the exact regex dictionary (fast, reliable,
 * supports known aliases — "k8s", "pg", etc.), and for whatever the regex did NOT catch —
 * a fuzzy fallback for typos/spelling variations (isFuzzyMatch, tolerant based on word
 * length: short words aren't tolerated at all, to avoid false positives). Fuzzy does NOT
 * replace the exact dictionary — it only adds what the exact dictionary missed due to a typo.
 */
export function extractTechs(text: unknown): TechMatch[] {
  const t = String(text || "");
  const found: TechMatch[] = [];
  const foundNames = new Set<string>();
  for (const [name, def] of Object.entries(TECHS)) {
    if (def.re.test(t)) {
      found.push({ name, cat: def.cat });
      foundNames.add(name);
    }
  }
  const tokens = new Set(t.toLowerCase().match(/[a-z0-9+#.]+/g) || []);
  for (const { name, key } of FUZZY_KEYS) {
    if (foundNames.has(name)) continue;
    for (const token of tokens) {
      if (isFuzzyMatch(token, key)) {
        found.push({ name, cat: TECHS[name]!.cat });
        foundNames.add(name);
        break;
      }
    }
  }
  return found;
}

export function extractLevel(text: unknown): string {
  const t = String(text || "").toLowerCase();
  if (/\bsenior\b|\blead\b|\barchitect\b/.test(t)) return "Senior";
  if (/\bmiddle\b|\bmid\b/.test(t)) return "Middle";
  if (/\bjunior\b|\btrainee\b/.test(t)) return "Junior";
  return "";
}
