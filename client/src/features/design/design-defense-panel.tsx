import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../shared/api";
import { Btn, Card, EmptyState, Select } from "../../shared/ui";
import { InterviewTurnPanel } from "../mock/interview-turn-panel";
import { MockEvalCard } from "../mock/mock-eval-card";
import { listVoicesForLocale, speak, ttsSupported, useSpeechToText } from "../mock/speech";
import { isAppLocale, DEFAULT_LOCALE, type AppLocale } from "../../i18n/locales";
import type { DesignDefenseTurnResult, DesignDiagram, DesignTask } from "../../shared/types";

const TURN_COUNT_OPTIONS = [2, 3, 4];
const DEFAULT_MAX_TURNS = 3;

/** A short live follow-up discussion about the just-graded diagram — a sibling to the Mock
 * Interview's live voice mode, reusing InterviewTurnPanel (question + TTS + STT + answer) rather
 * than duplicating it. Stateless server contract like /mock/interview: every call resends the
 * whole transcript, so this component's own state is plain useState, not useUi — a defense
 * doesn't need to survive a reload the way the diagram itself does, and NOT persisting it avoids
 * a stale transcript from a previous task's defense leaking into a fresh one. */
export function DesignDefensePanel({ task, diagram }: { task: DesignTask; diagram: DesignDiagram }) {
  const { t, i18n } = useTranslation(["design", "mock"]);
  const locale: AppLocale = isAppLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;

  const [maxTurns, setMaxTurns] = useState(DEFAULT_MAX_TURNS);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceURI, setVoiceURI] = useState("");
  const [transcript, setTranscript] = useState<{ q: string; a: string }[]>([]);
  const [turn, setTurn] = useState<DesignDefenseTurnResult | null>(null);
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

  useEffect(
    () => () => {
      if (ttsSupported()) speechSynthesis.cancel();
    },
    [],
  );

  async function requestTurn(nextTranscript: { q: string; a: string }[]) {
    pendingRef.current = nextTranscript;
    setBusy(true);
    try {
      const result = await api.designDefense(task, diagram, nextTranscript, maxTurns);
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

  if (!turn) {
    return (
      <Card>
        <EmptyState
          title={t("defense.startTitle")}
          hint={t("defense.startHint")}
          action={
            <div className="flex flex-col items-center gap-3">
              <Select value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} aria-label={t("defense.turnsLabel")}>
                {TURN_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t("mock:voice.questionsOption", { count: n })}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm text-ink-dim">
                <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
                {t("mock:voice.autoSpeak")}
              </label>
              {ttsSupported() && voices.length > 0 && (
                <Select
                  value={voiceURI}
                  onChange={(e) => setVoiceURI(e.target.value)}
                  aria-label={t("mock:voice.voiceLabel")}
                  className="max-w-[220px]"
                >
                  <option value="">{t("mock:voice.voiceAuto")}</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              )}
              <Btn onClick={start} loading={busy}>
                {t("defense.start")}
              </Btn>
            </div>
          }
        />
      </Card>
    );
  }

  if (turn.offline) {
    return (
      <Card>
        <div className="text-sm text-alert bg-alert/10 border border-alert/30 rounded-lg p-3">{t("mock:voice.offline")}</div>
        <div className="mt-3 flex gap-2">
          {turn.retryable && (
            <Btn size="sm" onClick={retry} loading={busy}>
              {t("mock:voice.retry")}
            </Btn>
          )}
          <Btn size="sm" variant="ghost" onClick={reset}>
            {t("defense.close")}
          </Btn>
        </div>
      </Card>
    );
  }

  if (turn.done) {
    return (
      <Card>
        <EmptyState title={t("defense.finishedTitle")} hint="" />
        {turn.review ? (
          <MockEvalCard ev={{ ...turn.review, offline: false }} />
        ) : (
          <div className="mt-3 text-sm text-ink-dim">{t("mock:voice.finished.endedEarly")}</div>
        )}
        <div className="mt-4">
          <Btn onClick={reset}>{t("defense.close")}</Btn>
        </div>
      </Card>
    );
  }

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
        progress: t("mock:voice.progress", { current: turn.turnNumber, total: turn.maxTurns }),
        finish: t("defense.close"),
        replay: t("mock:voice.replay"),
        record: t("mock:voice.record"),
        stopRecording: t("mock:voice.stopRecording"),
        listening: t("mock:voice.listening"),
        micUnsupported: t("mock:voice.micUnsupported"),
        answerAriaLabel: t("mock:voice.answerAriaLabel"),
        answerPlaceholder: t("defense.answerPlaceholder"),
        send: t("mock:voice.send"),
      }}
    />
  );
}
