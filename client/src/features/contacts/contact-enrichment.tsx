import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAddContact, useCompanies, useEnrichContacts, useRevealContactEmail } from "../../shared/queries";
import { Btn, Card, Chip, EmptyState, Section, Select } from "../../shared/ui";
import type { EnrichedPerson } from "../../shared/types";

const EMAIL_STATUS_TONE: Record<EnrichedPerson["emailStatus"], "good" | "slate" | "amber"> = {
  verified: "good",
  unverified: "slate",
  guessed: "amber",
  locked: "slate",
};

const FREEFORM = "__freeform__";

/** One enriched-contact result row — its own local state so revealing a locked email or saving as
 * a contact only affects this row, not the whole results list (same per-row scoping pattern as
 * ContactOutreachPanel's per-contact mutation instance in contacts.tsx). */
function EnrichedPersonRow({
  person,
  companyId,
  onReveal,
}: {
  person: EnrichedPerson;
  companyId: number | null;
  onReveal: (email: string, emailStatus: "verified" | "locked") => void;
}) {
  const { t } = useTranslation(["contacts", "common"]);
  const revealMutation = useRevealContactEmail();
  const addMutation = useAddContact();
  const [saved, setSaved] = useState(false);

  const isRevealing = revealMutation.isPending && revealMutation.variables?.revealId === person.revealId;
  const isSaving = addMutation.isPending && addMutation.variables?.email === person.email;

  const reveal = () => {
    revealMutation.mutate(
      { provider: person.source, revealId: person.revealId },
      { onSuccess: (res) => onReveal(res.email, res.emailStatus) },
    );
  };
  const save = () => {
    addMutation.mutate(
      { name: person.name, role: person.title, email: person.email, linkedinUrl: person.linkedinUrl, companyId, notes: "" },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <Card className="p-3">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="font-semibold text-ink truncate">{person.name || "—"}</div>
          <div className="text-xs text-ink-dim truncate">{person.title || "—"}</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <Chip tone={EMAIL_STATUS_TONE[person.emailStatus]}>{t(`enrich.emailStatus.${person.emailStatus}`)}</Chip>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
        {person.email && (
          <a href={`mailto:${person.email}`} className="text-ink-dim hover:text-signal hover:underline">
            {person.email}
          </a>
        )}
        {person.linkedinUrl && (
          <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="text-ink-dim hover:text-signal hover:underline">
            {t("linkedin")}
          </a>
        )}
        <span className="text-ink-dim/70">{person.source}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {person.emailStatus === "locked" && person.revealId && (
          <Btn size="sm" variant="ghost" loading={isRevealing} onClick={reveal}>
            {isRevealing ? t("enrich.revealing") : t("enrich.revealEmail")}
          </Btn>
        )}
        {person.email && (
          <Btn size="sm" variant="ghost" loading={isSaving} disabled={saved} onClick={save}>
            {saved ? t("enrich.saved") : t("enrich.saveAsContact")}
          </Btn>
        )}
      </div>
    </Card>
  );
}

/** Collapsible panel above the contacts list — searches third-party enrichment providers
 * (Hunter.io/Apollo/keyless pattern-guess fallback, server-side) for people at a company, so a
 * user can find outreach targets before manually adding a Contact. Self-contained: one mutation,
 * results held in local state (not the TanStack Query cache) — mirrors ContactOutreachPanel's
 * shape one level up (a whole panel instead of one contact card). */
export function ContactEnrichmentPanel() {
  const { t } = useTranslation(["contacts", "common"]);
  const { data: companies = [] } = useCompanies();
  const enrichMutation = useEnrichContacts();
  const [companySel, setCompanySel] = useState<string>(FREEFORM);
  const [companyName, setCompanyName] = useState("");
  const [domain, setDomain] = useState("");
  const [personName, setPersonName] = useState("");
  const [results, setResults] = useState<EnrichedPerson[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [budgetExhausted, setBudgetExhausted] = useState(false);

  const selectedCompanyId = companySel === FREEFORM ? null : Number(companySel);
  const canSearch = selectedCompanyId !== null || companyName.trim().length > 0;

  const search = () => {
    enrichMutation.mutate(
      {
        companyId: selectedCompanyId ?? undefined,
        companyName: companyName.trim(),
        domain: domain.trim() || undefined,
        personName: personName.trim() || undefined,
        limit: 10,
      },
      {
        onSuccess: (res) => {
          setResults(res.results);
          setOffline(res.offline);
          setBudgetExhausted(res.budgetExhausted);
        },
      },
    );
  };

  const revealRow = (revealId: string, email: string, emailStatus: "verified" | "locked") => {
    setResults((prev) => (prev ? prev.map((p) => (p.revealId === revealId ? { ...p, email, emailStatus } : p)) : prev));
  };

  return (
    <Section title={t("enrich.toggleLabel")}>
      <div className="space-y-2.5">
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("enrich.companyLabel")}</span>
          <Select
            value={companySel}
            onChange={(e) => setCompanySel(e.target.value)}
            className="w-full mt-0.5 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-signal/50"
          >
            <option value={FREEFORM}>{t("enrich.freeformOption")}</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        {companySel === FREEFORM && (
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t("enrich.companyNamePlaceholder")}
              aria-label={t("enrich.companyLabel")}
              className="w-full bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder={t("enrich.domainPlaceholder")}
              aria-label={t("enrich.domainLabel")}
              className="w-full bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
            />
          </div>
        )}
        <label className="block">
          <span className="text-xs font-semibold text-ink-dim">{t("enrich.personNameLabel")}</span>
          <input
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            placeholder={t("enrich.personNamePlaceholder")}
            className="w-full mt-0.5 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
        </label>
        <Btn size="sm" disabled={!canSearch} loading={enrichMutation.isPending} onClick={search}>
          {enrichMutation.isPending ? t("enrich.searching") : t("enrich.search")}
        </Btn>
        <p className="text-xs text-ink-dim/70">{t("enrich.privacyNote")}</p>

        {results && (
          <div className="space-y-2 pt-1">
            {offline && <Chip tone="amber">{t("enrich.offlineNotice")}</Chip>}
            {budgetExhausted && <Chip tone="amber">{t("enrich.budgetExhaustedNotice")}</Chip>}
            {results.length === 0 ? (
              <EmptyState title={t("enrich.noResults")} />
            ) : (
              results.map((p, i) => (
                <EnrichedPersonRow
                  key={p.revealId || `${p.email}-${i}`}
                  person={p}
                  companyId={selectedCompanyId}
                  onReveal={(email, emailStatus) => revealRow(p.revealId, email, emailStatus)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </Section>
  );
}
