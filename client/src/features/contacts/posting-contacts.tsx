import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAddContact, useExtractPostingContacts } from "../../shared/queries";
import { Btn, Chip } from "../../shared/ui";
import type { PostingContact, PostingContactChannel } from "../../shared/types";

const CHANNEL_TONE: Record<PostingContactChannel, "good" | "slate"> = {
  email: "good",
  telegram: "slate",
  linkedin: "slate",
};

function hrefFor(contact: PostingContact): string {
  if (contact.channel === "email") return `mailto:${contact.value}`;
  if (contact.channel === "telegram") return `https://t.me/${contact.value.replace(/^@/, "")}`;
  return contact.value;
}

/** One found row. Local `saved` state per row, same per-row scoping as the contacts list's own
 * cards — saving one address must not disable the others. */
function FoundContactRow({ contact, vacancyId, companyId }: { contact: PostingContact; vacancyId: number; companyId: number | null }) {
  const { t } = useTranslation(["contacts", "common"]);
  const addMutation = useAddContact();
  const [saved, setSaved] = useState(false);

  const save = () => {
    addMutation.mutate(
      {
        name: contact.name || contact.value,
        role: contact.title,
        email: contact.channel === "email" ? contact.value : "",
        linkedinUrl: contact.channel === "linkedin" ? contact.value : "",
        // `contacts` has no Telegram column, so the handle rides in notes rather than being
        // dropped — a dedicated column is a schema change worth making only once the Telegram
        // path proves itself in use.
        notes: contact.channel === "telegram" ? `Telegram: ${contact.value}` : "",
        companyId,
        vacancyId,
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap bg-surface-2 border border-grid rounded-lg px-2 py-1.5">
      <Chip tone={CHANNEL_TONE[contact.channel]}>{t(`posting.channel.${contact.channel}`)}</Chip>
      <div className="min-w-0">
        <a
          href={hrefFor(contact)}
          target={contact.channel === "email" ? undefined : "_blank"}
          rel="noreferrer"
          className="text-xs text-ink hover:text-signal hover:underline break-all"
        >
          {contact.value}
        </a>
        {(contact.name || contact.title) && (
          <div className="text-[11px] text-ink-dim truncate">{[contact.name, contact.title].filter(Boolean).join(" · ")}</div>
        )}
      </div>
      <Btn
        type="button"
        size="sm"
        variant="ghost"
        loading={addMutation.isPending}
        disabled={saved}
        onClick={save}
        className="ml-auto shrink-0 !px-2 !py-1 !text-[11px]"
      >
        {saved ? t("posting.saved") : t("posting.save")}
      </Btn>
    </div>
  );
}

/**
 * Finds the contacts a posting actually states, from the vacancy's own saved text or from
 * something the user pastes (an email signature being the case that matters). Deliberately not a
 * search box: there is nothing to search: either the text names a way to reach someone or it
 * doesn't, and saying so plainly beats offering a guess.
 */
export function PostingContactsFinder({ vacancyId, companyId }: { vacancyId: number; companyId: number | null }) {
  const { t } = useTranslation(["contacts", "common"]);
  const extractMutation = useExtractPostingContacts();
  const [results, setResults] = useState<PostingContact[] | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");

  const run = (input: { vacancyId?: number; text?: string }) => {
    extractMutation.mutate(input, { onSuccess: (res) => setResults(res.contacts) });
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Btn
          type="button"
          size="sm"
          variant="ghost"
          loading={extractMutation.isPending && !extractMutation.variables?.text}
          onClick={() => run({ vacancyId })}
          className="!px-2 !py-1 !text-[11px]"
        >
          {t("posting.findInPosting")}
        </Btn>
        <Btn type="button" size="sm" variant="ghost" onClick={() => setPasting((v) => !v)} className="!px-2 !py-1 !text-[11px]">
          {t("posting.pasteToggle")}
        </Btn>
      </div>

      {pasting && (
        <div className="space-y-1.5">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={t("posting.pastePlaceholder")}
            aria-label={t("posting.pasteToggle")}
            className="w-full h-20 bg-surface-2 border border-grid rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <Btn
            type="button"
            size="sm"
            variant="ghost"
            loading={extractMutation.isPending && !!extractMutation.variables?.text}
            disabled={!pasted.trim()}
            onClick={() => run({ text: pasted.trim() })}
            className="!px-2 !py-1 !text-[11px]"
          >
            {t("posting.findInPasted")}
          </Btn>
        </div>
      )}

      {results && (
        <div className="space-y-1.5">
          {results.length === 0 ? (
            <div className="text-[11px] text-ink-dim">{t("posting.none")}</div>
          ) : (
            results.map((c) => <FoundContactRow key={`${c.channel}:${c.value}`} contact={c} vacancyId={vacancyId} companyId={companyId} />)
          )}
          <div className="text-[11px] text-ink-dim/70">{t("posting.exactNote")}</div>
        </div>
      )}
    </div>
  );
}
