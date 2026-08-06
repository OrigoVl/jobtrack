// Zorya Job Clipper — popup script.
//
// API origin is configurable via the options page (options.html/options.js), stored in
// chrome.storage.local — NOT a hardcoded constant anymore, since a browser extension's fetch()
// is blocked by the manifest's host_permissions allow-list, and manifest.json can't hardcode
// every possible Zorya deployment's domain. Defaults to localhost:3001 (the local-dev API port —
// NOT Vite's :5173 dev server; its /api proxy only rewrites requests made by the page it's
// serving, never one from this extension's own popup) until the user configures a real one.
const DEFAULT_ORIGIN = "http://localhost:3001";
const STORAGE_KEY = "apiOrigin";

async function getApiOrigin() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return stored[STORAGE_KEY] || DEFAULT_ORIGIN;
}

async function hasPermissionFor(origin) {
  return chrome.permissions.contains({ origins: [`${origin}/*`] });
}

/**
 * Runs INSIDE THE PAGE (via chrome.scripting.executeScript's `func`) — must be fully
 * self-contained (no references to anything outside this function's own body/closures), since
 * it's serialized and re-executed in the tab's own JS context, not the popup's.
 *
 * Prefers schema.org JobPosting JSON-LD (the structured-data standard most job boards already
 * emit for their own SEO — stable across redesigns, unlike scraping page-specific CSS classes).
 * Falls back to document.title + a "largest visible text block" heuristic when no JSON-LD is
 * found, clearly labeled as lower-confidence in the popup UI.
 */
function extractJobFromPage() {
  function fromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      let data;
      try {
        data = JSON.parse(script.textContent || "");
      } catch {
        continue;
      }
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const nodes = item && item["@graph"] ? item["@graph"] : [item];
        for (const node of nodes) {
          if (!node) continue;
          const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
          if (types.includes("JobPosting")) {
            const company = (node.hiringOrganization && node.hiringOrganization.name) || "";
            const title = node.title || "";
            const rawDescription = typeof node.description === "string" ? node.description : "";
            // JobPosting descriptions are frequently raw HTML — strip tags for the plain-text
            // "notes" field the tracker expects.
            const description = rawDescription
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            return { title, company, description, confidence: "high" };
          }
        }
      }
    }
    return null;
  }

  function fallback() {
    const title = document.title || "";
    let best = "";
    document.querySelectorAll("article, main, [role='main'], section").forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      const text = (el.innerText || "").trim();
      if (text.length > best.length && text.length < 20000) best = text;
    });
    return { title, company: "", description: best.slice(0, 4000), confidence: "low" };
  }

  const job = fromJsonLd() || fallback();
  return { job, url: location.href };
}

/**
 * Also runs INSIDE THE PAGE, same self-containment constraint as extractJobFromPage — `profile`
 * is passed in via chrome.scripting.executeScript's `args` (structured-cloned, so it must be
 * plain data, no functions/closures).
 *
 * Deliberately GENERIC keyword matching against each field's derived label — not hardcoded
 * per-ATS CSS selectors for Greenhouse/Lever/Ashby/Workday. A real per-ATS integration would
 * need each platform's actual current DOM confirmed live (their markup changes and isn't
 * something this extension can verify for you at install time); a label-keyword heuristic is
 * more likely to survive that churn, at the cost of missing some fields or (rarely) filling the
 * wrong one — which is exactly why this is click-to-fill with a visible result, never automatic:
 * review every field before submitting the actual application.
 */
function fillApplicationForm(profile) {
  const FIELD_MATCHERS = [
    { keys: ["first name", "firstname", "given name"], value: profile.firstName },
    { keys: ["last name", "lastname", "surname", "family name"], value: profile.lastName },
    { keys: ["full name", "your name"], value: profile.fullName, skipIf: (l) => /first|last/.test(l) },
    { keys: ["email"], value: profile.email },
    { keys: ["phone", "mobile", "telephone"], value: profile.phone },
    { keys: ["linkedin"], value: profile.linkedin },
    { keys: ["github"], value: profile.github },
    { keys: ["portfolio", "website", "personal site"], value: profile.website },
  ];
  const TEXTAREA_MATCHERS = [{ keys: ["cover letter", "why do you", "additional information", "message"], value: profile.coverNote }];

  function labelFor(el) {
    const parts = [];
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) parts.push(lbl.textContent || "");
    }
    const closestLabel = el.closest("label");
    if (closestLabel) parts.push(closestLabel.textContent || "");
    parts.push(el.getAttribute("aria-label") || "");
    parts.push(el.getAttribute("placeholder") || "");
    parts.push(el.getAttribute("name") || "");
    parts.push(el.id || "");
    parts.push(el.getAttribute("autocomplete") || "");
    return parts.join(" ").toLowerCase();
  }

  // Setting `.value` directly does not notify React/Vue's own change tracking (most ATS forms —
  // Greenhouse/Lever/Ashby — are React apps) — going through the native setter first, then
  // dispatching real `input`/`change` events, is the documented way to make a framework-controlled
  // input actually "see" a programmatic value change.
  function setValue(el, value) {
    if (!value) return false;
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  let filled = 0;
  const inputs = document.querySelectorAll(
    "input[type='text'], input[type='email'], input[type='tel'], input[type='url'], input:not([type])",
  );
  inputs.forEach((el) => {
    if (el.value || el.disabled || el.readOnly) return;
    const label = labelFor(el);
    for (const matcher of FIELD_MATCHERS) {
      if (matcher.skipIf && matcher.skipIf(label)) continue;
      if (matcher.keys.some((k) => label.includes(k)) && setValue(el, matcher.value)) {
        filled++;
        break;
      }
    }
  });
  document.querySelectorAll("textarea").forEach((el) => {
    if (el.value || el.disabled || el.readOnly) return;
    const label = labelFor(el);
    for (const matcher of TEXTAREA_MATCHERS) {
      if (matcher.keys.some((k) => label.includes(k)) && setValue(el, matcher.value)) {
        filled++;
        break;
      }
    }
  });
  return { filled };
}

function renderJob(job) {
  document.getElementById("title").textContent = job.title || "(no title detected)";
  document.getElementById("company").textContent = job.company || "—";
  const confidenceEl = document.getElementById("confidence");
  if (job.confidence === "high") {
    confidenceEl.textContent = "✓ Found structured job data on this page";
    confidenceEl.className = "high";
  } else {
    confidenceEl.textContent = "⚠ Low-confidence guess — no structured job data found, review before saving";
    confidenceEl.className = "low";
  }
}

// A last-space split is a coarse heuristic ("Anna Maria Lopez" -> first "Anna Maria", last
// "Lopez") — good enough for a best-effort autofill the user reviews before submitting, not
// worth a real name-parsing library for.
function splitName(fullName) {
  const trimmed = (fullName || "").trim();
  const idx = trimmed.lastIndexOf(" ");
  if (idx < 0) return { firstName: trimmed, lastName: "" };
  return { firstName: trimmed.slice(0, idx), lastName: trimmed.slice(idx + 1) };
}

// cvText has no separate phone/LinkedIn/GitHub fields (server/src/modules/cv/cv.schemas.ts's
// CvDoc.contact is one free-text blob) — best-effort regex extraction over the profile's own CV
// text, same "mine free text for structure" spirit as server/src/shared/tech-dict.ts's
// extractTechs(), not a claim that this always finds them.
function extractContactDetails(cvText) {
  const text = cvText || "";
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? "";
  const linkedin = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/\S+/i)?.[0]?.replace(/[.,)]+$/, "") ?? "";
  const github = text.match(/https?:\/\/(?:www\.)?github\.com\/\S+/i)?.[0]?.replace(/[.,)]+$/, "") ?? "";
  return { phone, linkedin, github };
}

async function init() {
  const statusEl = document.getElementById("status");
  const saveBtn = document.getElementById("save");
  const fillBtn = document.getElementById("fill");
  const originHintEl = document.getElementById("originHint");

  const apiOrigin = await getApiOrigin();
  const hasPermission = await hasPermissionFor(apiOrigin);
  if (!hasPermission) {
    originHintEl.textContent = `Not configured for ${apiOrigin} yet — `;
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "open Settings";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    originHintEl.appendChild(link);
    originHintEl.appendChild(document.createTextNode(" to grant access."));
    originHintEl.hidden = false;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    statusEl.textContent = "No active tab.";
    return;
  }
  document.getElementById("url").textContent = tab.url || "";

  let job;
  let url;
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobFromPage });
    job = result.job;
    url = result.url;
  } catch {
    // Common cause: a browser-internal page (chrome://, the extension store, a PDF viewer) that
    // scripting can't be injected into at all.
    statusEl.textContent = "Can't read this page (try a regular job posting page).";
    return;
  }

  renderJob(job);
  if (hasPermission) {
    saveBtn.disabled = false;
    fillBtn.disabled = false;
  }

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    statusEl.textContent = "";
    try {
      // credentials: "include" — this is the whole trick: the browser attaches the user's
      // EXISTING Zorya session cookie automatically (cookies belong to the site's origin,
      // not to this extension), so there's no need to read/copy cookies via the `cookies` API.
      const res = await fetch(`${apiOrigin}/api/vacancies`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: job.company || "Unknown company",
          position: job.title || "Unknown position",
          url,
          notes: job.description || "",
        }),
      });
      if (res.status === 401) {
        statusEl.textContent = "Not logged in to Zorya — open the app and log in first, then try again.";
        saveBtn.disabled = false;
        saveBtn.textContent = "Save to Zorya";
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      statusEl.textContent = "✓ Saved to your tracker.";
      saveBtn.textContent = "✓ Saved";
    } catch {
      statusEl.textContent = `Couldn't reach Zorya at ${apiOrigin} — is the server running?`;
      saveBtn.disabled = false;
      saveBtn.textContent = "Save to Zorya";
    }
  });

  fillBtn.addEventListener("click", async () => {
    fillBtn.disabled = true;
    fillBtn.textContent = "Filling…";
    statusEl.textContent = "";
    try {
      // Both read-only, existing endpoints — no new server-side surface for this feature.
      // Session (name/email) comes from better-auth's own endpoint, not something this
      // extension re-implements. Note: get-session responds 200 with a `null` body when
      // signed out (never 401) — /api/profile IS behind authed() and reliably 401s, so that's
      // the one actually checked for the "not logged in" gate below.
      const [sessionRes, profileRes] = await Promise.all([
        fetch(`${apiOrigin}/api/auth/get-session`, { credentials: "include" }),
        fetch(`${apiOrigin}/api/profile`, { credentials: "include" }),
      ]);
      if (profileRes.status === 401) {
        statusEl.textContent = "Not logged in to Zorya — open the app and log in first, then try again.";
        fillBtn.disabled = false;
        fillBtn.textContent = "Fill application";
        return;
      }
      if (!sessionRes.ok || !profileRes.ok) throw new Error("HTTP error");
      const session = await sessionRes.json(); // { session, user } or null
      const profile = await profileRes.json();
      const { firstName, lastName } = splitName(session?.user?.name);
      const { phone, linkedin, github } = extractContactDetails(profile?.cvText);

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillApplicationForm,
        args: [
          {
            fullName: session?.user?.name || "",
            firstName,
            lastName,
            email: session?.user?.email || "",
            phone,
            linkedin,
            github,
            website: "",
            coverNote: "",
          },
        ],
      });
      statusEl.textContent =
        result.filled > 0
          ? `✓ Filled ${result.filled} field${result.filled === 1 ? "" : "s"} — review before submitting.`
          : "No matching fields found on this page.";
    } catch {
      statusEl.textContent = `Couldn't reach Zorya at ${apiOrigin} — is the server running?`;
    } finally {
      fillBtn.disabled = false;
      fillBtn.textContent = "Fill application";
    }
  });
}

init();
