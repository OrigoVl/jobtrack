import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAddContact, useScanCompanySite } from "../../shared/queries";
import { Btn, Chip } from "../../shared/ui";
import type { SiteContactsResult } from "../../shared/types";

/** One address found on the site, with the page it came from and a one-click save. */
function FoundAddressRow({ email, page, companyId }: { email: string; page: string; companyId: number }) {
  const { t } = useTranslation(["contacts", "common"]);
  const addMutation = useAddContact();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-wrap bg-surface-2 border border-grid rounded-lg px-2 py-1.5">
      <a href={`mailto:${email}`} className="text-xs text-ink hover:text-signal hover:underline break-all">
        {email}
      </a>
      <span className="text-[11px] text-ink-dim/70">{page}</span>
      <Btn
        type="button"
        size="sm"
        variant="ghost"
        loading={addMutation.isPending}
        disabled={saved}
        onClick={() =>
          addMutation.mutate(
            { name: email, role: "", email, linkedinUrl: "", notes: "", source: "site", companyId, vacancyId: null, lastContactAt: "" },
            { onSuccess: () => setSaved(true) },
          )
        }
        className="ml-auto shrink-0 !px-2 !py-1 !text-[11px]"
      >
        {saved ? t("posting.saved") : t("posting.save")}
      </Btn>
    </div>
  );
}

/**
 * Reads the addresses a company publishes on its own careers/contact pages. Mostly role addresses
 * (jobs@, hr@) rather than a named person — weaker than a contact stated in a posting, which is
 * why this lives on the company card rather than in the application flow, but it's a real
 * published address and it costs the user one click.
 */
export function SiteContactsPanel({ companyId, hasWebsite }: { companyId: number; hasWebsite: boolean }) {
  const { t } = useTranslation(["contacts", "common"]);
  const scanMutation = useScanCompanySite();
  const [result, setResult] = useState<SiteContactsResult | null>(null);

  if (!hasWebsite) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <Btn
        type="button"
        size="sm"
        variant="ghost"
        loading={scanMutation.isPending}
        onClick={() => scanMutation.mutate(companyId, { onSuccess: setResult })}
      >
        {t("site.scan")}
      </Btn>

      {result && (
        <div className="space-y-1.5">
          {result.blockedByRobots ? (
            // Said plainly rather than shown as an error: the site asked automation to stay out,
            // and respecting that is the intended behavior, not a failure.
            <Chip tone="slate">{t("site.blockedByRobots")}</Chip>
          ) : result.contacts.length === 0 ? (
            <div className="text-[11px] text-ink-dim">{t("site.none")}</div>
          ) : (
            result.contacts.map((c) => <FoundAddressRow key={c.email} email={c.email} page={c.page} companyId={companyId} />)
          )}
          {result.pagesRead.length > 0 && (
            <div className="text-[11px] text-ink-dim/70">{t("site.pagesRead", { pages: result.pagesRead.join(", ") })}</div>
          )}
        </div>
      )}
    </div>
  );
}
