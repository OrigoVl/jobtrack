import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useToast } from "../../shared/use-toast";
import { useVacancies } from "../../shared/queries";
import { Btn, Card, PageHeader, SearchSelect } from "../../shared/ui";
import { Markdown } from "../../shared/markdown";
import { exportPdf, vacancyToText } from "./cv-shared";

/**
 * The cover-letter generator — its own route (`/cover-letter`) and its own tab of the CV section
 * (see app/App.tsx's CV layout route). It used to be one card wedged into the bottom of the CV
 * page, competing for attention with CV upload, the AI reports and the skills editor on the same
 * screen; on its own tab it gets the room its three-input flow (pick a tracked vacancy / paste a
 * URL / paste raw text) actually needs.
 *
 * Every piece of state below still uses the SAME `useUi` keys the old in-page card did
 * ("cv.cover", "cv.vacText", "cv.coverVacId", "cv.coverUrl") — `useUi`'s store is a module
 * singleton (shared/ui-state.ts), not component state, so a letter half-written before this
 * split is still exactly where the user left it, and switching CV tabs never loses a draft.
 */
export function CoverLetter() {
  const { t } = useTranslation(["cv", "common"]);
  const { data: vacancies = [] } = useVacancies();
  const { toast } = useToast();
  const [cover, setCover] = useUi("cv.cover", "");
  const [vacText, setVacText] = useUi("cv.vacText", "");
  const [coverVacId, setCoverVacId] = useUi<number>("cv.coverVacId", 0);
  const [coverUrl, setCoverUrl] = useUi("cv.coverUrl", "");
  const [busy, setBusy] = useState("");
  const [coverCopied, setCoverCopied] = useState(false);
  const coverCompany = vacancies.find((v) => v.id === coverVacId)?.company || "";

  const pickCoverVacancy = (id: number) => {
    setCoverVacId(id);
    const vac = vacancies.find((v) => v.id === id);
    if (vac) setVacText(vacancyToText(vac, t));
  };
  const fetchCoverUrl = async () => {
    if (!coverUrl.trim()) return;
    setBusy("cover-url");
    try {
      setCoverVacId(0);
      setVacText((await api.fetchVacancyUrl(coverUrl.trim())).text);
      toast(t("cvPage.toasts.vacancyTextLoaded"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("cvPage.toasts.loadPageError"), "error");
    } finally {
      setBusy("");
    }
  };
  const genCover = async () => {
    setBusy("cover");
    try {
      setCover((await api.coverLetter(vacText, coverCompany)).text);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={t("cvPage.eyebrow")} title={t("cvPage.coverLetterTitle")} subtitle={t("cvPage.coverLetterSubtitle")} />
      <Card className="space-y-3">
        <div className="text-sm font-semibold text-ink">{t("cvPage.coverSourceHeading")}</div>
        {vacancies.length > 0 && (
          <SearchSelect
            value={String(coverVacId)}
            onChange={(v) => pickCoverVacancy(Number(v))}
            aria-label={t("cvPage.coverVacancyAria")}
            options={[
              { value: "0", label: t("cvPage.selectVacancyFromTracker") },
              ...vacancies.map((v) => ({ value: String(v.id), label: `${v.position}${v.company ? ` — ${v.company}` : ""}` })),
            ]}
            className="w-full"
          />
        )}
        <div className="flex gap-1.5">
          <input
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchCoverUrl()}
            aria-label={t("cvPage.coverUrlAria")}
            placeholder={t("cvPage.coverUrlPlaceholder")}
            className="flex-1 min-w-0 bg-surface-2 border border-grid rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <Btn size="sm" variant="subtle" onClick={fetchCoverUrl} loading={busy === "cover-url"} disabled={!coverUrl.trim()}>
            {t("cvPage.load")}
          </Btn>
        </div>
        <textarea
          value={vacText}
          onChange={(e) => {
            setVacText(e.target.value);
            setCoverVacId(0);
          }}
          aria-label={t("cvPage.coverTextAria")}
          placeholder={t("cvPage.coverTextPlaceholder")}
          className="w-full h-32 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
        />
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={genCover} loading={busy === "cover"} disabled={!vacText.trim()}>
            {t("cvPage.generateLetter")}
          </Btn>
          {cover && (
            <Btn
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(cover);
                setCoverCopied(true);
                setTimeout(() => setCoverCopied(false), 2000);
              }}
            >
              {coverCopied ? t("shared.copied") : t("shared.copy")}
            </Btn>
          )}
          {cover && (
            <Btn variant="ghost" onClick={() => exportPdf(t("cvPage.coverLetterPdfTitle"), cover)}>
              {t("shared.pdfButton")}
            </Btn>
          )}
        </div>
      </Card>
      {cover && (
        <Card>
          <div className="text-sm font-semibold text-ink mb-2">{t("cvPage.coverResultHeading")}</div>
          <Markdown text={cover} className="text-sm text-ink space-y-2" />
        </Card>
      )}
    </div>
  );
}
