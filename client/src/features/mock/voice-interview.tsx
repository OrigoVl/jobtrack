import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { useUi } from "../../shared/ui-state";
import { useHealth, useVacancies } from "../../shared/queries";
import { Btn, Card, EmptyState, SearchSelect, Select } from "../../shared/ui";
import { InterviewTurnPanel } from "./interview-turn-panel";
import { MockEvalCard } from "./mock-eval-card";
import { listVoicesForLocale, speak, stopSpeaking, sttSupported, ttsSupported, useSpeechToText } from "./speech";
import { isAppLocale, DEFAULT_LOCALE, type AppLocale } from "../../i18n/locales";
import type { InterviewTurnResult } from "../../shared/types";

const QUESTION_COUNT_OPTIONS = [3, 5, 6, 8];
const DEFAULT_MAX_TURNS = 6;

/** A live, voice-driven mock interview: the AI asks real questions tailored to a chosen vacancy
 * (or a general interview), the candidate speaks (or types) an answer, and the "interviewer"
 * reacts and continues — unlike the static PoolInterview flow, this is a real back-and-forth.
 * Stateless server contract: every call resends the whole transcript (see
 * server/src/modules/mock/mock-interview.service.ts) — a reload starts a fresh interview.
 */
export function VoiceInterview() {
  const { t, i18n } = useTranslation(["mock", "common"]);
  const locale: AppLocale = isAppLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const { data: vacancies = [] } = useVacancies();
  const { data: health } = useHealth();
  const llm = health?.llm ?? false;

  const [vacancyId, setVacancyId] = useUi("mock.live.vacancyId", 0);
  const [maxTurns, setMaxTurns] = useUi("mock.live.maxTurns", DEFAULT_MAX_TURNS);
  const [autoSpeak, setAutoSpeak] = useUi("mock.live.autoSpeak", true);
  // "" = auto-pick the best-scoring installed voice for the locale (see speech.ts's
  // voiceQualityScore) — persisted so a user who finds a good-sounding voice keeps it next time.
  const [voiceURI, setVoiceURI] = useUi("mock.live.voiceURI", "");
  const [transcript, setTranscript] = useUi<{ q: string; a: string }[]>("mock.live.transcript", []);
  const [turn, setTurn] = useUi<InterviewTurnResult | null>("mock.live.turn", null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const pendingRef = useRef<{ q: string; a: string }[]>([]);

  const stt = useSpeechToText(locale);

  useEffect(() => {
    let cancelled = false;
    void listVoicesForLocale(locale).then((v) => {
      if (!cancelled) setVoices(v);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => () => stopSpeaking(), []);

  async function requestTurn(nextTranscript: { q: string; a: string }[]) {
    pendingRef.current = nextTranscript;
    setBusy(true);
    try {
      const result = await api.interviewTurn(vacancyId || null, nextTranscript, maxTurns);
      if (!result.offline) {
        setTranscript(nextTranscript);
        setAnswer("");
      }
      setTurn(result);
      if (!result.done && !result.offline && result.question && autoSpeak) void speak(result.question, locale, voiceURI || undefined);
    } catch {
      setTurn({ offline: true, retryable: true, done: false, question: "", review: null, turnNumber: nextTranscript.length + 1, maxTurns });
    } finally {
      setBusy(false);
    }
  }

  const start = () => void requestTurn([]);
  const send = () => {
    if (!turn || !answer.trim()) return;
    void requestTurn([...transcript, { q: turn.question, a: answer }]);
  };
  const retry = () => void requestTurn(pendingRef.current);
  const reset = () => {
    setTranscript([]);
    setTurn(null);
    setAnswer("");
  };

  // ---------- Pre-start ----------
  if (!turn) {
    return (
      <Card>
        <EmptyState
          title={t("voice.startTitle")}
          hint={t("voice.startHint")}
          action={
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <SearchSelect
                  value={String(vacancyId)}
                  onChange={(v) => setVacancyId(Number(v))}
                  aria-label={t("voice.vacancyLabel")}
                  options={[
                    { value: "0", label: t("voice.generalOption") },
                    ...vacancies.map((v) => ({ value: String(v.id), label: `${v.position}${v.company ? ` — ${v.company}` : ""}` })),
                  ]}
                  // Explicit width — see the same note in design-task-card.tsx's picker.
                  className="w-56 max-w-full bg-surface-2"
                />
                <Select value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} aria-label={t("voice.questionsLabel")}>
                  {QUESTION_COUNT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {t("voice.questionsOption", { count: n })}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-dim">
                <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} className="accent-star" />
                {t("voice.autoSpeak")}
              </label>
              {ttsSupported() && voices.length > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-ink-dim">{t("voice.voiceHint")}</span>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <Select
                      value={voiceURI}
                      onChange={(e) => setVoiceURI(e.target.value)}
                      aria-label={t("voice.voiceLabel")}
                      className="max-w-[220px]"
                    >
                      <option value="">{t("voice.voiceAuto")}</option>
                      {voices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                    <Btn size="sm" variant="ghost" onClick={() => void speak(t("voice.testPhrase"), locale, voiceURI || undefined)}>
                      {t("voice.testVoice")}
                    </Btn>
                  </div>
                </div>
              )}
              <Btn onClick={start} loading={busy}>
                {t("voice.start")}
              </Btn>
              {!llm && <span className="text-xs text-ink-dim">{t("voice.offlineHint")}</span>}
              {!sttSupported() && <span className="text-xs text-ink-dim">{t("voice.micUnsupported")}</span>}
            </div>
          }
        />
      </Card>
    );
  }

  // ---------- Offline / transient failure ----------
  if (turn.offline) {
    return (
      <Card>
        <div className="text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg p-3">{t("voice.offline")}</div>
        <div className="mt-3 flex gap-2">
          {turn.retryable && (
            <Btn size="sm" onClick={retry} loading={busy}>
              {t("voice.retry")}
            </Btn>
          )}
          <Btn size="sm" variant="ghost" onClick={reset}>
            {t("voice.finished.newInterview")}
          </Btn>
        </div>
      </Card>
    );
  }

  // ---------- Finished ----------
  if (turn.done) {
    return (
      <div className="space-y-4">
        <Card>
          <EmptyState title={t("voice.finished.title")} hint="" />
          {turn.review ? (
            <MockEvalCard ev={{ ...turn.review, offline: false }} />
          ) : (
            <div className="mt-3 text-sm text-ink-dim">{t("voice.finished.endedEarly")}</div>
          )}
          <div className="mt-4">
            <Btn onClick={reset}>{t("voice.finished.newInterview")}</Btn>
          </div>
        </Card>
      </div>
    );
  }

  // ---------- In progress ----------
  return (
    <InterviewTurnPanel
      question={turn.question}
      answer={answer}
      onAnswerChange={setAnswer}
      onSend={send}
      onFinish={reset}
      busy={busy}
      locale={locale}
      voiceURI={voiceURI}
      stt={stt}
      labels={{
        progress: t("voice.progress", { current: turn.turnNumber, total: turn.maxTurns }),
        finish: t("voice.finish"),
        replay: t("voice.replay"),
        record: t("voice.record"),
        stopRecording: t("voice.stopRecording"),
        listening: t("voice.listening"),
        micUnsupported: t("voice.micUnsupported"),
        answerAriaLabel: t("voice.answerAriaLabel"),
        answerPlaceholder: t("voice.answerPlaceholder"),
        send: t("voice.send"),
      }}
    />
  );
}
