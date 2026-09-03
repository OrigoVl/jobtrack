// QA track (see shared/tracks.ts's Track union) knowledge-base entries — split out of
// ../knowledge-base.ts's KB object purely for reviewable diffs; see that file's own header
// comment for the full KB shape (learn bullets + resources per technology). No logic here.
import type { KbEntry } from "../knowledge-base.js";
import { R } from "./resource.js";

export const QA_KB: Record<string, KbEntry> = {
  // ---------- QA track ----------
  Selenium: {
    cat: "Automation",
    learn: [
      "Locator strategies (id/CSS/XPath), explicit vs implicit waits",
      "Page Object Model, Selenium Grid for parallel/cross-browser runs",
      "WebDriver architecture, browser drivers",
    ],
    resources: [
      R("Selenium Docs", "https://www.selenium.dev/documentation/"),
      R("Selenium — Waiting Strategies", "https://www.selenium.dev/documentation/webdriver/waits/"),
      R("Selenium — Page Object Models", "https://www.selenium.dev/documentation/test_practices/encouraged/page_object_models/"),
    ],
  },
  Cypress: {
    cat: "Automation",
    learn: [
      "Automatic retry-ability, cy.intercept for network stubbing",
      "Custom commands, fixtures, cy.session for auth reuse",
      "Same-origin model and its practical limits vs Playwright",
    ],
    resources: [
      R("Cypress Docs", "https://docs.cypress.io/guides/overview/why-cypress"),
      R("Cypress — Best Practices", "https://docs.cypress.io/guides/references/best-practices"),
    ],
  },
  Appium: {
    cat: "Automation",
    learn: [
      "WebDriver-protocol mobile automation (iOS/Android)",
      "Locating native elements (accessibility id, UiAutomator/XCUITest selectors)",
      "Real device vs emulator/simulator trade-offs",
    ],
    resources: [R("Appium Docs", "https://appium.io/docs/en/latest/")],
  },
  "Page Object Model": {
    cat: "Automation",
    learn: [
      "Encapsulate locators/actions per page or component, keep assertions in the test",
      "Compose shared components (header/nav) instead of duplicating locators",
      "Avoid a 'God object' — model around business actions, not raw selectors",
    ],
    resources: [
      R("Selenium — Page Object Models", "https://www.selenium.dev/documentation/test_practices/encouraged/page_object_models/"),
      R("Test Automation University (free courses)", "https://testautomationu.applitools.com/"),
    ],
  },
  "Test Automation Framework": {
    cat: "Automation",
    learn: [
      "Hybrid frameworks: POM + data-driven + keyword-driven, sharing one driver/utility layer",
      "Test isolation, independent setup/teardown per test",
      "Deciding what to automate vs keep manual (ROI: repetition, stability, business value)",
    ],
    resources: [R("Test Automation University (free courses)", "https://testautomationu.applitools.com/")],
  },
  "Cucumber/BDD": {
    cat: "Automation",
    learn: [
      "Gherkin (Given/When/Then), Scenario Outline + Examples for data-driven scenarios",
      "Step definitions mapping Gherkin to automation code",
      "Collaborating on scenarios with non-technical stakeholders before automating",
    ],
    resources: [R("Cucumber Docs", "https://cucumber.io/docs/cucumber/")],
  },
  "Visual Regression Testing": {
    cat: "Automation",
    learn: [
      "Screenshot diffing against an approved baseline to catch layout/CSS regressions",
      "Handling intentional visual changes: baseline approval workflow",
      "Complements (not replaces) functional/DOM-based assertions",
    ],
    resources: [
      R("Playwright — Visual Comparisons", "https://playwright.dev/docs/test-snapshots"),
      R("Test Automation University (free courses)", "https://testautomationu.applitools.com/"),
    ],
  },
  "Robot Framework": {
    cat: "Automation",
    learn: ["Keyword-driven syntax, readable by non-programmers", "Libraries (SeleniumLibrary, RequestsLibrary) for web/API automation"],
    resources: [R("Robot Framework Docs", "https://robotframework.org/")],
  },
  "Data-Driven Testing": {
    cat: "Automation",
    learn: [
      "Parameterize one test with many input sets instead of duplicating test bodies",
      "Sourcing data: inline arrays, CSV/JSON fixtures, spreadsheets",
    ],
    resources: [R("Test Automation University (free courses)", "https://testautomationu.applitools.com/")],
  },
  Postman: {
    cat: "API Testing",
    learn: [
      "Collections, environments/variables, pre-request and test scripts",
      "Chaining requests (extract a value, store it, reuse via {{var}})",
      "Newman for running collections headlessly in CI",
    ],
    resources: [
      R("Postman Learning Center", "https://learning.postman.com/docs/getting-started/overview/"),
      R("Postman — Writing Tests", "https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/"),
    ],
  },
  Newman: {
    cat: "API Testing",
    learn: ["Running a Postman collection from the CLI", "Integrating collection runs into a CI pipeline"],
    resources: [R("Newman (GitHub)", "https://github.com/postmanlabs/newman")],
  },
  "Contract Testing": {
    cat: "API Testing",
    learn: [
      "Consumer-driven contracts: the consumer defines expectations, the provider verifies independently",
      "Catches integration-breaking changes earlier/cheaper than full e2e integration tests",
      "Pact as the most common implementation",
    ],
    resources: [R("Pact Docs", "https://docs.pact.io/")],
  },
  WireMock: {
    cat: "API Testing",
    learn: [
      "Stubbing HTTP responses (including specific error scenarios) for tests",
      "Request matching, verifying calls were made as expected",
    ],
    resources: [R("WireMock Docs", "https://wiremock.org/docs/")],
  },
  SoapUI: {
    cat: "API Testing",
    learn: ["Testing SOAP (WSDL-based) and REST APIs from one tool", "Assertions, data-driven test steps"],
    resources: [R("SoapUI Docs", "https://www.soapui.org/docs/")],
  },
  "API Testing": {
    cat: "API Testing",
    learn: [
      "Assert on status code + body shape/values, not just one or the other",
      "Negative tests: missing/invalid fields, no/expired auth, out-of-range values",
      "Schema validation (JSON Schema/Zod) to catch structural drift",
    ],
    resources: [
      R("Postman Learning Center", "https://learning.postman.com/docs/getting-started/overview/"),
      R("MDN — HTTP overview", "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview"),
    ],
  },
  JMeter: {
    cat: "Tools",
    learn: [
      "Thread Groups (users, ramp-up), Samplers (requests), Listeners (results)",
      "CSV-driven test data to avoid single-account throttling",
      "Running headlessly (non-GUI mode) in CI",
    ],
    resources: [R("JMeter User Manual", "https://jmeter.apache.org/usermanual/index.html")],
  },
  k6: {
    cat: "Tools",
    learn: [
      "JavaScript-based load test scripts, CI-native by design",
      "Scenarios/executors (constant-arrival-rate, ramping-vus), thresholds as pass/fail gates",
    ],
    resources: [R("k6 Docs", "https://k6.io/docs/")],
  },
  TestRail: {
    cat: "Tools",
    learn: ["Organizing test cases into suites/runs, recording results per run", "Tracking coverage and pass rate over a release cycle"],
    resources: [R("TestRail Help Center", "https://support.testrail.com/hc/en-us")],
  },
  BrowserStack: {
    cat: "Tools",
    learn: [
      "Running Selenium/Playwright/Appium tests against real remote browsers/devices",
      "Cross-browser matrices without a physical device lab",
    ],
    resources: [R("BrowserStack Docs", "https://www.browserstack.com/docs")],
  },
  "Sauce Labs": {
    cat: "Tools",
    learn: ["Cloud grid for cross-browser/cross-device automated testing", "Parallel execution at scale in CI"],
    resources: [R("Sauce Labs Docs", "https://docs.saucelabs.com/")],
  },
  "axe-core": {
    cat: "Tools",
    learn: [
      "Automated WCAG violation detection (labels, contrast, ARIA) embeddable in tests",
      "Catches roughly a third of real accessibility issues — pair with manual testing",
    ],
    resources: [
      R("axe-core (GitHub)", "https://github.com/dequelabs/axe-core"),
      R("Playwright — Accessibility Testing", "https://playwright.dev/docs/accessibility-testing"),
    ],
  },
  Lighthouse: {
    cat: "Tools",
    learn: ["Automated audits: performance, accessibility, SEO, best practices", "CI integration for regression-gating audit scores"],
    resources: [R("Lighthouse Docs", "https://developer.chrome.com/docs/lighthouse/overview/")],
  },
  JIRA: {
    cat: "Tools",
    learn: [
      "Bug/issue workflow: Open → Triaged → In Progress → Resolved → In Testing → Closed/Reopened",
      "Zephyr/Xray plugins for test-case and traceability management inside JIRA",
    ],
    resources: [R("Atlassian — Jira Guides", "https://www.atlassian.com/software/jira/guides")],
  },
  Allure: {
    cat: "Tools",
    learn: [
      "Turning raw test-runner output into a browsable report (steps, screenshots, history trends)",
      "Tagging tests by feature/severity for categorized failure reporting",
    ],
    resources: [R("Allure Report Docs", "https://allurereport.org/docs/")],
  },
  "Charles Proxy": {
    cat: "Tools",
    learn: [
      "HTTP(S) debugging proxy: inspecting real wire-level requests (including mobile app traffic)",
      "Simulating network conditions, replaying/modifying requests",
    ],
    resources: [R("Charles Proxy Docs", "https://www.charlesproxy.com/documentation/")],
  },
  "Boundary Value Analysis": {
    cat: "Manual Testing",
    learn: [
      "Test the edge of a valid range plus the values immediately on each side of it",
      "Pairs with equivalence partitioning to keep test counts small but high-yield",
    ],
    resources: [
      R("ISTQB Glossary", "https://glossary.istqb.org/en/search/"),
      R("Test Automation University (free courses)", "https://testautomationu.applitools.com/"),
    ],
  },
  "Equivalence Partitioning": {
    cat: "Manual Testing",
    learn: ["Split inputs into classes the system should treat identically, test one representative per class"],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "Decision Table Testing": {
    cat: "Manual Testing",
    learn: [
      "Enumerate every combination of independent input conditions systematically",
      "Useful when behavior depends on multiple interacting rules",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "State Transition Testing": {
    cat: "Manual Testing",
    learn: [
      "Model states/events/transitions, test both valid and invalid transitions",
      "Confirms the system actually enforces its own state rules",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "Smoke Testing": {
    cat: "Manual Testing",
    learn: [
      "A broad, shallow build-acceptance check before deeper testing",
      "Distinct from sanity testing (narrow, deep, after a specific fix)",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "Regression Testing": {
    cat: "Manual Testing",
    learn: [
      "Re-running existing tests to confirm a change didn't break prior functionality",
      "Automate the repetitive core, keep a targeted subset on every PR",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
  "Exploratory Testing": {
    cat: "Manual Testing",
    learn: [
      "Simultaneous learning, test design, and execution guided by a mission, not a script",
      "Session-based test management: a time-boxed charter plus notes for reportability",
    ],
    resources: [
      R("Ministry of Testing", "https://www.ministryoftesting.com/"),
      R("ISTQB Glossary", "https://glossary.istqb.org/en/search/"),
    ],
  },
  "Accessibility Testing": {
    cat: "Manual Testing",
    learn: [
      "WCAG (usually level AA): contrast, ARIA roles/labels, focus order, keyboard-only navigation",
      "Automated tools (axe-core, Lighthouse) catch a fraction — manual screen-reader testing is still required",
    ],
    resources: [
      R("W3C — Web Accessibility Initiative", "https://www.w3.org/WAI/"),
      R("axe-core (GitHub)", "https://github.com/dequelabs/axe-core"),
    ],
  },
  "Test Data Management": {
    cat: "Manual Testing",
    learn: [
      "Synthetic/generated data for volume and edge cases, seed/reset scripts for a known starting state",
      "Isolating test data per test/shard to avoid parallel-run collisions",
    ],
    resources: [R("ISTQB Glossary", "https://glossary.istqb.org/en/search/")],
  },
};
