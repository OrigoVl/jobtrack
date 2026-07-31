// DevRadar Job Clipper — popup script.
//
// CONFIGURE THIS for your deployment. Local dev against `pnpm --filter jobtrack-server start`
// (or `docker compose up`) serves the API at :3001 directly — that's the real origin to fetch,
// NOT Vite's :5173 dev server (its /api proxy only rewrites requests made by the page it's
// serving; a request from this extension's own popup never goes through it). Once you have a
// real production domain, change this AND `host_permissions` in manifest.json to match (a
// browser extension's `fetch` is blocked by the manifest's host_permissions allow-list — adding
// only one of the two leaves it either broken or, if you widen host_permissions without ever
// pointing at it, harmlessly unused).
const API_ORIGIN = "http://localhost:3001";

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

async function init() {
  const statusEl = document.getElementById("status");
  const saveBtn = document.getElementById("save");

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
  saveBtn.disabled = false;

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    statusEl.textContent = "";
    try {
      // credentials: "include" — this is the whole trick: the browser attaches the user's
      // EXISTING DevRadar session cookie automatically (cookies belong to the site's origin,
      // not to this extension), so there's no need to read/copy cookies via the `cookies` API.
      const res = await fetch(`${API_ORIGIN}/api/vacancies`, {
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
        statusEl.textContent = "Not logged in to DevRadar — open the app and log in first, then try again.";
        saveBtn.disabled = false;
        saveBtn.textContent = "Save to DevRadar";
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      statusEl.textContent = "✓ Saved to your tracker.";
      saveBtn.textContent = "✓ Saved";
    } catch {
      statusEl.textContent = `Couldn't reach DevRadar at ${API_ORIGIN} — is the server running?`;
      saveBtn.disabled = false;
      saveBtn.textContent = "Save to DevRadar";
    }
  });
}

init();
