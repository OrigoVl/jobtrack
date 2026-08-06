// Zorya Job Clipper — options page. Lets the extension point at any deployment (not just the
// hardcoded localhost:3001 it shipped with) by storing the origin in chrome.storage.local and
// requesting host_permissions for it at runtime — MV3 extensions can't fetch() a page origin
// they weren't granted, and the manifest can't hardcode every possible deployment's domain, so
// this is the sanctioned way to widen that allow-list per-install instead.
const DEFAULT_ORIGIN = "http://localhost:3001";
const STORAGE_KEY = "apiOrigin";

const originInput = document.getElementById("origin");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

function normalizeOrigin(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.origin;
}

async function load() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  originInput.value = stored[STORAGE_KEY] || DEFAULT_ORIGIN;
}

saveBtn.addEventListener("click", async () => {
  const origin = normalizeOrigin(originInput.value);
  if (!origin) {
    statusEl.textContent = "Enter a valid http(s) URL.";
    statusEl.className = "error";
    return;
  }
  saveBtn.disabled = true;
  statusEl.textContent = "Requesting permission…";
  statusEl.className = "";
  try {
    // Only ever requests THIS ONE origin, not the broad optional_host_permissions pattern
    // declared in manifest.json — that entry just widens what CAN be requested, this is what
    // actually gets granted, scoped to exactly the deployment the user typed in.
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      statusEl.textContent = "Permission was not granted — the extension can't reach that origin without it.";
      statusEl.className = "error";
      saveBtn.disabled = false;
      return;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: origin });
    statusEl.textContent = `Saved — the extension will now use ${origin}.`;
    statusEl.className = "ok";
  } catch (err) {
    statusEl.textContent = `Failed to save: ${err instanceof Error ? err.message : String(err)}`;
    statusEl.className = "error";
  } finally {
    saveBtn.disabled = false;
  }
});

load();
