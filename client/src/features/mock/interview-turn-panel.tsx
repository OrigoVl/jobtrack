import { Btn, Card } from "../../shared/ui";
import { speak, sttSupported, ttsSupported, type SpeechToText } from "./speech";
import type { AppLocale } from "../../i18n/locales";

interface InterviewTurnPanelLabels {
  progress: string;
  finish: string;
  replay: string;
  record: string;
  stopRecording: string;
  listening: string;
  micUnsupported: string;
  answerAriaLabel: string;
  answerPlaceholder: string;
  send: string;
}

interface InterviewTurnPanelProps {
  question: string;
  answer: string;
  onAnswerChange: (value: string) => void;
  onSend: () => void;
  onFinish: () => void;
  busy: boolean;
  locale: AppLocale;
  voiceURI: string;
  stt: SpeechToText;
  labels: InterviewTurnPanelLabels;
}

/** The genuinely reusable part of a live, turn-based AI conversation — question display + TTS
 * replay + STT record + answer textarea + send — extracted from voice-interview.tsx so
 * design-defense-panel.tsx (the architecture-trainer "defend your solution" mode) can reuse it
 * without duplicating the speech-synthesis/recognition wiring. Fully controlled/presentational:
 * no internal useUi state, so each caller owns its own persisted keys under its own namespace.
 */
export function InterviewTurnPanel({
  question,
  answer,
  onAnswerChange,
  onSend,
  onFinish,
  busy,
  locale,
  voiceURI,
  stt,
  labels,
}: InterviewTurnPanelProps) {
  const toggleRecording = () => {
    if (stt.listening) {
      stt.stop();
      return;
    }
    stt.start((text) => {
      if (!text) return;
      onAnswerChange(answer ? `${answer} ${text}` : text);
    });
  };

  const onAnswerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-ink-dim">
        <span>{labels.progress}</span>
        <Btn size="sm" variant="subtle" className="ml-auto" onClick={onFinish}>
          {labels.finish}
        </Btn>
      </div>
      <Card className="min-h-[240px] flex flex-col">
        <div aria-live="polite" className="text-lg font-semibold text-ink">
          {question}
        </div>
        <div className="mt-2">
          <Btn size="sm" variant="ghost" onClick={() => void speak(question, locale, voiceURI || undefined)} disabled={!ttsSupported()}>
            {labels.replay}
          </Btn>
        </div>
        <div className="mt-3">
          {sttSupported() ? (
            <div className="flex items-center gap-2 mb-2">
              <Btn size="sm" variant={stt.listening ? "primary" : "ghost"} aria-pressed={stt.listening} onClick={toggleRecording}>
                {stt.listening ? labels.stopRecording : labels.record}
              </Btn>
              {stt.listening && (
                <span aria-live="polite" className="text-xs text-ink-dim italic">
                  {stt.interimText || labels.listening}
                </span>
              )}
              {stt.error && <span className="text-xs text-alert">{stt.error}</span>}
            </div>
          ) : (
            <div className="text-xs text-ink-dim mb-2">{labels.micUnsupported}</div>
          )}
          <textarea
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            onKeyDown={onAnswerKeyDown}
            aria-label={labels.answerAriaLabel}
            placeholder={labels.answerPlaceholder}
            className="w-full h-24 bg-surface-2 border border-grid rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-signal/50"
          />
          <div className="flex gap-2 mt-2 items-center">
            <Btn size="sm" onClick={onSend} loading={busy} disabled={!answer.trim()}>
              {labels.send}
            </Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}
