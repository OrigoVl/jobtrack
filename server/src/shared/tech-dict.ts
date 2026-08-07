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

  // ---------- Product track additions ----------
  // "RICE"/"MoSCoW"/"MVP"/"OKR(s)" deliberately NOT added — "RICE" collides with the food word,
  // "MoSCoW" collides with the city name Moscow, and MVP/OKR are short, widely-overloaded acronyms
  // outside a PM context (Most Valuable Player, etc.) — all four stay KB-only (see
  // knowledge-base.ts), reachable via the multi-word KB keys below where the full phrase is unambiguous.
  Confluence: { cat: "Tools", re: /\bconfluence\b/i },
  Amplitude: { cat: "Tools", re: /\bamplitude\b/i },
  Mixpanel: { cat: "Tools", re: /\bmixpanel\b/i },
  Productboard: { cat: "Tools", re: /\bproductboard\b/i },
  Pendo: { cat: "Tools", re: /\bpendo\b/i },
  "Product Ops": { cat: "Core", re: /\bproduct ops\b/i },
  "TAM/SAM/SOM": { cat: "Core", re: /\btam\/sam\/som\b/i },
  "Business Model Canvas": { cat: "Core", re: /\bbusiness model canvas\b/i },
  "Value Proposition Canvas": { cat: "Core", re: /\bvalue proposition canvas\b/i },
  "Product-Market Fit": { cat: "Core", re: /\bproduct-market fit\b/i },
  "Product-Led Growth": { cat: "Core", re: /\bproduct-led growth\b/i },
  "Go-to-Market Strategy": { cat: "Core", re: /\bgo-to-market strategy\b/i },
  "Jobs-to-be-Done": { cat: "Discovery", re: /\b(jobs-to-be-done|jtbd)\b/i },
  "Customer Interviews": { cat: "Discovery", re: /\bcustomer interviews?\b/i },
  "Competitive Analysis": { cat: "Discovery", re: /\bcompetitive analysis\b/i },
  "Design Thinking": { cat: "Discovery", re: /\bdesign thinking\b/i },
  "Opportunity Solution Tree": { cat: "Discovery", re: /\bopportunity solution tree\b/i },
  "Voice of Customer": { cat: "Discovery", re: /\bvoice of (?:the )?customer\b/i },
  "Kano Model": { cat: "Delivery", re: /\bkano model\b/i },
  "Product Roadmapping": { cat: "Delivery", re: /\bproduct roadmapping\b/i },
  "User Story Mapping": { cat: "Delivery", re: /\buser story mapping\b/i },
  "Backlog Refinement": { cat: "Delivery", re: /\bbacklog refinement\b/i },
  "North Star Metric": { cat: "Analytics", re: /\bnorth star metric\b/i },
  "Cohort Analysis": { cat: "Analytics", re: /\bcohort analysis\b/i },
  "Funnel Analysis": { cat: "Analytics", re: /\bfunnel analysis\b/i },
  "Churn Analysis": { cat: "Analytics", re: /\bchurn analysis\b/i },

  // ---------- SysAdmin track additions ----------
  // "AD", "SAN", "NAS", "MFA", "EDR", "DFS" deliberately NOT added as bare acronyms — "AD" is a
  // too-ambiguous 2-letter token (per CLAUDE.md guidance), "SAN" collides with the common place
  // name "San" (San Francisco, San Diego, etc.), "MFA" collides with "Master of Fine Arts" (a real
  // degree the design/product tracks' vacancies can mention), "EDR" has no widely-recognized
  // meaning outside security so it stays reachable only via the full "Endpoint Protection" KB
  // entry, and "DFS" collides with the "depth-first search" CS algorithm term. All stay KB-only
  // (see knowledge-base.ts), same treatment as the Product track's RICE/MoSCoW/MVP/OKR(s).
  "Active Directory": { cat: "Systems", re: /\bactive directory\b/i },
  "Windows Server": { cat: "Systems", re: /\bwindows server\b/i },
  PowerShell: { cat: "Scripting", re: /\bpowershell\b/i },
  "Group Policy": { cat: "Systems", re: /\bgroup polic(?:y|ies)\b/i },
  VMware: { cat: "Systems", re: /\bvmware\b/i },
  "Hyper-V": { cat: "Systems", re: /\bhyper-v\b/i },
  "Entra ID": { cat: "Systems", re: /\bentra id\b/i },
  SSH: { cat: "Systems", re: /\bssh\b/i },
  // Requires a digit (RAID 0/1/5/6/10 etc.) rather than matching the bare word "raid" — avoids
  // tagging the common English word (e.g. "police raid") that could otherwise appear in prose.
  RAID: { cat: "Systems", re: /\braid[\s-]?(?:0|1|5|6|10)\b/i },
  Zabbix: { cat: "Monitoring", re: /\bzabbix\b/i },
  Nagios: { cat: "Monitoring", re: /\bnagios\b/i },
  ITIL: { cat: "Core", re: /\bitil\b/i },
  "Ticketing Systems": { cat: "Core", re: /\bticketing systems?\b/i },
  DNS: { cat: "Networking", re: /\bdns\b/i },
  DHCP: { cat: "Networking", re: /\bdhcp\b/i },
  VPN: { cat: "Networking", re: /\bvpns?\b/i },
  Subnetting: { cat: "Networking", re: /\bsubnet(?:ting|s)?\b/i },
  "TCP/IP": { cat: "Networking", re: /\btcp\/ip\b/i },
  Firewalls: { cat: "Networking", re: /\bfirewalls?\b/i },
  WSUS: { cat: "Tools", re: /\bwsus\b/i },
  SCCM: { cat: "Tools", re: /\bsccm\b/i },
  Intune: { cat: "Tools", re: /\bintune\b/i },

  // ---------- Design track additions ----------
  // "Sketch", "Maze", and "UserTesting" deliberately NOT added — "sketch" collides with the
  // everyday verb/noun ("sketch out a plan"), "maze" collides with the everyday word ("a maze of
  // legacy code"), and "UserTesting" is ambiguous against the generic two-word method name "user
  // testing" it would otherwise sit right next to — all three stay KB-only (see knowledge-base.ts).
  // "Persona" and general "Prototyping" also deliberately NOT added for the same reason: "persona"
  // is common outside UX ("brand persona"), and bare "prototyping" is widely used in non-design
  // engineering contexts (hardware/rapid prototyping) — both stay KB-only too.
  Figma: { cat: "Tools", re: /\bfigma\b/i },
  Zeplin: { cat: "Handoff", re: /\bzeplin\b/i },
  FigJam: { cat: "Tools", re: /\bfigjam\b/i },
  Miro: { cat: "Tools", re: /\bmiro\b/i },
  "Adobe XD": { cat: "Tools", re: /\badobe\s?xd\b/i },
  "Design Systems": { cat: "UI", re: /\bdesign systems?\b/i },
  Wireframing: { cat: "Prototyping", re: /\bwireframe(?:s|ing)?\b/i },
  "Usability Testing": { cat: "Research", re: /\busability test(?:ing|s)?\b/i },
  "User Research": { cat: "Research", re: /\buser research\b/i },
  "Information Architecture": { cat: "Core", re: /\binformation architecture\b/i },
  "Accessibility (a11y)": { cat: "UI", re: /\ba11y\b/i },
  WCAG: { cat: "UI", re: /\bwcag\b/i },
  "User Journey Mapping": { cat: "Research", re: /\b(?:user |customer )?journey mapping\b/i },
  "Heuristic Evaluation": { cat: "Core", re: /\bheuristic evaluation\b/i },
  "Interaction Design": { cat: "UI", re: /\binteraction design\b/i },
  Typography: { cat: "UI", re: /\btypography\b/i },
  "Color Theory": { cat: "UI", re: /\bcolou?r theory\b/i },
  "Material Design": { cat: "UI", re: /\bmaterial design\b/i },
  "Human Interface Guidelines": { cat: "UI", re: /\bhuman interface guidelines\b/i },
  "Card Sorting": { cat: "Research", re: /\bcard sort(?:ing)?\b/i },
  "Design Tokens": { cat: "UI", re: /\bdesign tokens?\b/i },
  "Atomic Design": { cat: "UI", re: /\batomic design\b/i },
  "Design Critique": { cat: "Core", re: /\bdesign critiques?\b/i },
  "Dark Patterns": { cat: "Core", re: /\bdark patterns?\b/i },
  "Empathy Map": { cat: "Research", re: /\bempathy map(?:s|ping)?\b/i },
  Microinteractions: { cat: "UI", re: /\bmicro-?interactions?\b/i },
  "Design Handoff": { cat: "Handoff", re: /\bdesign handoffs?\b/i },

  // ---------- Security track additions ----------
  // "Cryptography Fundamentals", "Secure Coding Practices", and "DNS Security" deliberately NOT
  // added — the first two are generic phrases too broad/unlikely to appear verbatim in vacancy
  // text without false-positive risk, and "DNS Security" would just re-match the same bare "dns"
  // token the existing sysadmin-track "DNS" entry above already owns, double-tagging the same
  // signal rather than adding a distinct one. All three stay KB-only (see knowledge-base.ts).
  "OWASP Top 10": { cat: "Core", re: /\bowasp top ?10\b/i },
  "NIST Cybersecurity Framework": { cat: "Core", re: /\bnist csf\b|\bnist cybersecurity framework\b/i },
  "MITRE ATT&CK": { cat: "Core", re: /\bmitre\s*att(?:&|a)ck\b/i },
  "Zero Trust Architecture": { cat: "Core", re: /\bzero trust\b/i },
  "Threat Modeling": { cat: "Core", re: /\bthreat model(?:l?ing|s)?\b/i },
  "Password Hashing": { cat: "Core", re: /\bpassword hashing\b|\bbcrypt\b|\bargon2\b|\bscrypt\b/i },
  "Penetration Testing": { cat: "Core", re: /\bpenetration test(?:ing|s|er)?\b|\bpen[- ]test(?:ing|s|ers)?\b/i },
  SIEM: { cat: "Core", re: /\bsiem\b/i },
  "SQL Injection": { cat: "AppSec", re: /\bsql injection\b|\bsqli\b/i },
  "Cross-Site Scripting (XSS)": { cat: "AppSec", re: /\bcross-site scripting\b|\bxss\b/i },
  CSRF: { cat: "AppSec", re: /\bcsrf\b/i },
  SSRF: { cat: "AppSec", re: /\bssrf\b/i },
  IDOR: { cat: "AppSec", re: /\bidor\b/i },
  XXE: { cat: "AppSec", re: /\bxxe\b/i },
  "JWT Security": { cat: "AppSec", re: /\bjwt\b/i },
  "SAST/DAST": { cat: "AppSec", re: /\bsast\b|\bdast\b/i },
  "TLS/SSL": { cat: "Network", re: /\btls\b|\bssl\b/i },
  "DDoS Protection": { cat: "Network", re: /\bddos\b/i },
  // Phrase-only (no bare "ids"/"ips") — "IPS" collides with the common hardware term "IPS panel"
  // (in-plane switching displays) that shows up in non-security job ads, and bare "IDS" is too
  // short/ambiguous per CLAUDE.md guidance to risk on its own.
  "IDS/IPS": { cat: "Network", re: /\bintrusion detection\b|\bintrusion prevention\b|\bids\/ips\b/i },
  "Network Segmentation": { cat: "Network", re: /\bnetwork segmentation\b/i },
  "Burp Suite": { cat: "Tools", re: /\bburp\s?suite\b/i },
  Nmap: { cat: "Tools", re: /\bnmap\b/i },
  Wireshark: { cat: "Tools", re: /\bwireshark\b/i },
  Metasploit: { cat: "Tools", re: /\bmetasploit\b/i },
  // Phrase-only — bare "ZAP" collides with the common English verb ("zap the bug").
  "OWASP ZAP": { cat: "Tools", re: /\bowasp zap\b|\bzap proxy\b/i },
  "Vulnerability Scanning": { cat: "Tools", re: /\bvulnerability scan(?:ning|s|ner)?\b|\bnessus\b|\bqualys\b/i },
  "Kali Linux": { cat: "Tools", re: /\bkali linux\b/i },
  "Password Cracking": { cat: "Tools", re: /\bpassword cracking\b|\bhashcat\b|\bjohn the ripper\b/i },
  CyberChef: { cat: "Tools", re: /\bcyberchef\b/i },
  Shodan: { cat: "Tools", re: /\bshodan\b/i },
  Splunk: { cat: "Tools", re: /\bsplunk\b/i },

  // ---------- PM (classic project management) track additions ----------
  // Bare "PMP", "WBS", "EVM", "RAID", "RACI", "PMO", "CAPM" deliberately NOT added as standalone
  // entries — all are short, collision-prone acronyms (e.g. bare "EVM" collides with "Ethereum
  // Virtual Machine" in web3 job text; bare "WBS"/"PMO" are too ambiguous per CLAUDE.md guidance)
  // — reachable only via the full-phrase entries below (e.g. "RAID Log", "RACI Matrix") or
  // KB-only where even a full phrase risks collision. "Portfolio Management" deliberately NOT
  // added — collides with the extremely common finance/investment sense of the term ("portfolio
  // manager" job ads). "PMO", "Agile vs Waterfall", "Quality Management", "Milestone Tracking",
  // "Cost Estimating Techniques", and "Risk Response Strategies" are section-title-style KB
  // entries, not concrete named terms likely to appear verbatim in vacancy/CV text, and "Asana"
  // collides with the yoga posture term — all stay KB-only (see knowledge-base.ts), same
  // treatment as the Product track's RICE/MoSCoW/MVP/OKR(s).
  PMBOK: { cat: "Core", re: /\bpmbok\b/i },
  "Project Charter": { cat: "Core", re: /\bproject charter\b/i },
  "PMP Certification": { cat: "Core", re: /\bpmp certif(?:ication|ied)\b/i },
  "Program Management": { cat: "Core", re: /\bprogram management\b/i },
  "Stakeholder Management": { cat: "Core", re: /\bstakeholder management\b/i },
  "Work Breakdown Structure (WBS)": { cat: "Planning", re: /\bwork breakdown structure\b/i },
  "Critical Path Method": { cat: "Planning", re: /\bcritical path(?: method)?\b/i },
  "Critical Chain Method": { cat: "Planning", re: /\bcritical chain(?: method)?\b/i },
  "Gantt Chart": { cat: "Planning", re: /\bgantt(?: chart)?\b/i },
  "Resource Leveling": { cat: "Planning", re: /\bresource level(?:ing|ling)\b/i },
  "RACI Matrix": { cat: "Execution", re: /\braci matrix\b/i },
  "Change Control": { cat: "Execution", re: /\bchange control\b/i },
  "Earned Value Management": { cat: "Execution", re: /\bearned value management\b/i },
  "Procurement Management": { cat: "Execution", re: /\bprocurement management\b/i },
  // "raid log" requires the trailing word "log" specifically so it never collides with the
  // sysadmin track's digit-anchored "RAID" entry above (RAID 0/1/5/6/10 storage) or the bare
  // English word "raid".
  "RAID Log": { cat: "Risk", re: /\braid log\b/i },
  "Risk Register": { cat: "Risk", re: /\brisk register\b/i },
  "Contingency Reserve": { cat: "Risk", re: /\bcontingency reserve\b/i },
  "MS Project": { cat: "Tools", re: /\bms project\b|\bmicrosoft project\b/i },
  Smartsheet: { cat: "Tools", re: /\bsmartsheet\b/i },
  // Requires the ".com" suffix so bare "Monday" (the day of the week) in ordinary job-ad prose
  // never matches.
  "Monday.com": { cat: "Tools", re: /\bmonday\.com\b/i },
  // Requires "P6" specifically — bare "Primavera" collides with the Italian word for "spring"
  // (used as a brand/festival name, e.g. "Primavera Sound") outside the PM tooling context.
  "Primavera P6": { cat: "Tools", re: /\bprimavera\s?p6\b/i },

  // ---------- BA (business analysis) track additions ----------
  // Bare "BRD", "FRD", "BABOK", "CBAP", "SWOT" deliberately NOT added — all are short,
  // collision-prone acronyms/initialisms (CLAUDE.md guidance on short bare acronyms), reachable
  // only via the full-phrase KB-only entries in knowledge-base.ts (e.g. "Business Requirements
  // Document (BRD)"). "Root Cause Analysis", "Gap Analysis", and "Use Case Diagrams" also stay
  // KB-only — all three are widely used across QA/DevOps/SRE/general-engineering vacancies too
  // (root-causing an incident, use cases in any software spec), so tagging them as a BA-specific
  // signal here would misattribute vacancies from other tracks. "JIRA"/"Confluence"/"SQL"/"Excel"
  // are already covered by the QA/Product/core-dict entries above — not duplicated here.
  // "Enterprise Architect" deliberately NOT added — it's a common IT job title in its own right
  // (not just the Sparx EA tool), so it would mistag any vacancy with that title.
  Visio: { cat: "Tools", re: /\bvisio\b/i },
  Lucidchart: { cat: "Tools", re: /\blucidchart\b/i },
  Balsamiq: { cat: "Tools", re: /\bbalsamiq\b/i },
  BPMN: { cat: "Analysis", re: /\bbpmn\b/i },
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
  // Product track additions — same reasoning: merging these into one alphanumeric token for
  // Levenshtein comparison would produce useless typo matches for a multi-word/punctuated name.
  "Product Ops",
  "TAM/SAM/SOM",
  "Business Model Canvas",
  "Value Proposition Canvas",
  "Product-Market Fit",
  "Product-Led Growth",
  "Go-to-Market Strategy",
  "Jobs-to-be-Done",
  "Customer Interviews",
  "Competitive Analysis",
  "Design Thinking",
  "Opportunity Solution Tree",
  "Voice of Customer",
  "Kano Model",
  "Product Roadmapping",
  "User Story Mapping",
  "Backlog Refinement",
  "North Star Metric",
  "Cohort Analysis",
  "Funnel Analysis",
  "Churn Analysis",
  // SysAdmin track additions — same reasoning: merging these into one alphanumeric token for
  // Levenshtein comparison would produce useless typo matches for a multi-word/punctuated name.
  "Active Directory",
  "Windows Server",
  "Group Policy",
  "Hyper-V",
  "Entra ID",
  "Ticketing Systems",
  "TCP/IP",
  // Design track additions — same reasoning: merging these into one alphanumeric token for
  // Levenshtein comparison would produce useless typo matches for a multi-word/punctuated name.
  "Adobe XD",
  "Design Systems",
  "Usability Testing",
  "User Research",
  "Information Architecture",
  "Accessibility (a11y)",
  "User Journey Mapping",
  "Heuristic Evaluation",
  "Interaction Design",
  "Color Theory",
  "Material Design",
  "Human Interface Guidelines",
  "Card Sorting",
  "Design Tokens",
  "Atomic Design",
  "Design Critique",
  "Dark Patterns",
  "Empathy Map",
  "Design Handoff",
  // Security track additions — same reasoning: merging these into one alphanumeric token for
  // Levenshtein comparison would produce useless typo matches for a multi-word/punctuated name.
  "OWASP Top 10",
  "NIST Cybersecurity Framework",
  "MITRE ATT&CK",
  "Zero Trust Architecture",
  "Threat Modeling",
  "Password Hashing",
  "Penetration Testing",
  "SQL Injection",
  "Cross-Site Scripting (XSS)",
  "JWT Security",
  "SAST/DAST",
  "TLS/SSL",
  "DDoS Protection",
  "IDS/IPS",
  "Network Segmentation",
  "Burp Suite",
  "OWASP ZAP",
  "Vulnerability Scanning",
  "Kali Linux",
  "Password Cracking",
  // PM track additions — same reasoning: merging these into one alphanumeric token for
  // Levenshtein comparison would produce useless typo matches for a multi-word/punctuated name.
  "Project Charter",
  "PMP Certification",
  "Program Management",
  "Stakeholder Management",
  "Work Breakdown Structure (WBS)",
  "Critical Path Method",
  "Critical Chain Method",
  "Gantt Chart",
  "Resource Leveling",
  "RACI Matrix",
  "Change Control",
  "Earned Value Management",
  "Procurement Management",
  "RAID Log",
  "Risk Register",
  "Contingency Reserve",
  "MS Project",
  "Monday.com",
  "Primavera P6",
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

/** True when `re` matches the WHOLE string, not merely a token inside it — so "Vue.js" folds onto
 * Vue, but "Web Performance Optimization" is never collapsed to whatever its first word aliases to. */
function matchesWholeSkill(re: RegExp, skill: string): boolean {
  const m = re.exec(skill);
  return !!m && m.index === 0 && m[0].length === skill.length;
}

/**
 * Folds a skill name onto the dictionary's canonical spelling ("Vue.js" → "Vue", "k8s" →
 * "Kubernetes"), leaving anything the dictionary doesn't know untouched.
 *
 * Needed because extractSkills() unions two sources that spell the same technology differently:
 * the regex dictionary (canonical names) and the LLM (whatever the posting itself wrote). Its
 * dedupe is case-insensitive only, so "Vue" + "Vue.js" both survived as separate chips.
 */
export function canonicalTechName(skill: string): string {
  const raw = skill.trim();
  if (!raw || TECHS[raw]) return raw;
  for (const [name, def] of Object.entries(TECHS)) {
    if (matchesWholeSkill(def.re, raw)) return name;
  }
  return raw;
}

/**
 * Canonicalizes a skill list and drops entries that the source text doesn't actually support.
 *
 * The verification rule is deliberately asymmetric: a skill that resolves to a KNOWN dictionary
 * technology must have that technology's own regex match the source text, while a free-form phrase
 * the dictionary doesn't know ("Caching", "Web Vitals", "Code Review") is trusted as-is. That
 * asymmetry is what makes it safe on a non-English posting — an LLM reading Ukrainian prose
 * legitimately reports English concept names that appear nowhere in the text verbatim, but it has
 * no such excuse for naming a concrete technology the posting never mentions. This is what removes
 * the hallucinated "SSRF" (invented next to the posting's real "SSR") and any stray "React"/
 * "Python" that survives from page chrome.
 */
export function sanitizeSkills(skills: string[], sourceText: unknown): string[] {
  const text = String(sourceText || "");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const skill of skills) {
    const name = canonicalTechName(skill);
    if (!name) continue;
    const known = TECHS[name];
    if (known && !known.re.test(text)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
