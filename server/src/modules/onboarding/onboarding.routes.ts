// A single per-user flag — "has this account seen the post-registration /welcome flow" — stored
// in the generic user_kv table (db/kv.ts#getKvJson/setKvJson), not a dedicated table: unlike
// digest_preferences (which needs a real column for a scheduler's WHERE-scan across every user),
// nothing ever queries this across users, so the generic KV store is the right fit here, not
// overkill for it.
import express from "express";
import { authed } from "../../core/http.js";
import { getKvJson, setKvJson } from "../../db/kv.js";
import { countVacancies } from "../vacancies/vacancies.repo.js";
import { countCompanies } from "../companies/companies.repo.js";
import { countContacts } from "../contacts/contacts.repo.js";

const r = express.Router();
const WELCOME_SEEN_KEY = "onboarding.welcomeSeen";

r.get(
  "/onboarding/state",
  authed(async (userId, _req, res) => {
    // `hasVacancies`/`hasNetwork` ride along on this endpoint rather than getting one of their
    // own because the client shell (App.tsx) already fetches /onboarding/state on every route via
    // WelcomeRedirect — so the sidebar's "nothing here yet" dimming costs zero extra requests and,
    // crucially, is CONSISTENT: deriving it from whichever list query happened to be cached made
    // the same account look "empty" on one page and populated on the next. Three COUNT(*)s on
    // indexed user_id columns, never the rows themselves.
    const [welcomeSeen, vacancies, companies, contacts] = await Promise.all([
      getKvJson<boolean>(userId, WELCOME_SEEN_KEY),
      countVacancies(userId),
      countCompanies(userId),
      countContacts(userId),
    ]);
    res.json({
      welcomeSeen: welcomeSeen ?? false,
      hasVacancies: vacancies > 0,
      hasNetwork: companies + contacts > 0,
    });
  }),
);

r.post(
  "/onboarding/welcome-seen",
  authed(async (userId, _req, res) => {
    await setKvJson(userId, WELCOME_SEEN_KEY, true);
    res.json({ welcomeSeen: true });
  }),
);

export default r;
