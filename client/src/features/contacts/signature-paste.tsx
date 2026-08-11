import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useExtractPostingContacts } from "../../shared/queries";
import { Btn, Card } from "../../shared/ui";
import type { ContactInput, PostingContact } from "../../shared/types";

/** Folds what the extractor found into a contact draft. A signature names ONE person across
 * several channels, so every channel collapses into a single draft rather than one contact per
 * line — the opposite of the vacancy flow, where separate rows are the point. */
function draftFrom(found: PostingContact[], base: ContactInput): ContactInput {
  const email = found.find((c) => c.channel === "email");
  const linkedin = found.find((c) => c.channel === "linkedin");
  const telegram = found.find((c) => c.channel === "telegram");
  const named = found.find((c) => c.name) ?? email ?? found[0];
  return {
    ...base,
    name: named?.name || email?.value || "",
    role: named?.title || "",
    email: email?.value || "",
    linkedinUrl: linkedin?.value || "",
    // `contacts` has no Telegram column — same call as the vacancy flow's row save.
    notes: telegram ? `Telegram: ${telegram.value}` : "",
    source: "signature",
  };
}

/**
 * Turns a pasted email signature into a pre-filled "add contact" form. Deliberately NOT a results
 * list you save from: the extracted name and title are usually close but not right ("Senior Talent
 * Partner | Acme" is a signature line, not a job title), so handing the user an editable draft is
 * the point, not an extra step. Nothing is guessed — every value comes verbatim from the text.
 */
export function SignaturePaste({
  onDraft,
  onClose,
  baseDraft,
}: {
  onDraft: (draft: ContactInput) => void;
  onClose: () => void;
  baseDraft: ContactInput;
}) {
  const { t } = useTranslation(["contacts", "common"]);
  const extractMutation = useExtractPostingContacts();
  const [text, setText] = useState("");
  const [empty, setEmpty] = useState(false);

  const run = () => {
    setEmpty(false);
    extractMutation.mutate(
      { text: text.trim() },
      {
        onSuccess: (res) => {
          if (res.contacts.length === 0) {
            setEmpty(true);
            return;
          }
          onDraft(draftFrom(res.contacts, baseDraft));
          setText("");
        },
      },
    );
  };

  return (
    <Card className="p-3 space-y-2">
      <div className="text-xs font-semibold text-ink-dim">{t("signature.title")}</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("signature.placeholder")}
        aria-label={t("signature.title")}
        className="w-full h-24 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
      />
      {empty && <div className="text-xs text-ink-dim">{t("signature.none")}</div>}
      <div className="flex gap-1.5">
        <Btn size="sm" loading={extractMutation.isPending} disabled={!text.trim()} onClick={run}>
          {t("signature.action")}
        </Btn>
        <Btn size="sm" variant="ghost" onClick={onClose}>
          {t("common:actions.cancel")}
        </Btn>
      </div>
    </Card>
  );
}
