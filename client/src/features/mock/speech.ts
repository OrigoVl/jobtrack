// Browser-native Web Speech API wrapper (STT via SpeechRecognition + TTS via speechSynthesis),
// now fronted by a server-side neural TTS endpoint (see speak() below) with the browser
// speechSynthesis as an automatic fallback when the cloud voice is unavailable. SpeechRecognition
// is still non-standard (Chrome/Edge only in practice, prefixed as `webkitSpeechRecognition` in
// some builds), so this file hand-declares the minimal interface it actually uses instead of
// relying on a global ambient .d.ts or `any` casts (CLAUDE.md: no `any`) —
// speechSynthesis/SpeechSynthesisUtterance ARE standard DOM types already covered by
// lib.dom.d.ts, so only the recognition side needs this.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppLocale } from "../../i18n/locales";
import { api } from "../../shared/api";

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as SpeechRecognitionCtor) : null;
}

export function sttSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

const BCP47: Record<AppLocale, string> = { en: "en-US", uk: "uk-UA" };

export function localeToBcp47(locale: AppLocale): string {
  return BCP47[locale];
}

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** `speechSynthesis.getVoices()` is often empty on the very first call — the list populates
 * asynchronously, signaled by the `voiceschanged` event. Resolves immediately if voices are
 * already available. */
function getVoices(): Promise<SpeechSynthesisVoice[]> {
  const existing = speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  if (!voicesPromise) {
    voicesPromise = new Promise((resolve) => {
      const handler = () => {
        speechSynthesis.removeEventListener("voiceschanged", handler);
        resolve(speechSynthesis.getVoices());
      };
      speechSynthesis.addEventListener("voiceschanged", handler);
    });
  }
  return voicesPromise;
}

/** Rough "sounds less robotic" heuristic: browsers typically ship a mix of offline/local voices
 * (fast, always available, but noticeably synthetic — e.g. classic "Microsoft David/Zira"-style
 * voices) and network-backed ones (fetched from the OS/browser vendor's servers, generally much
 * more natural — e.g. Chrome's "Google" voices). Neither `SpeechSynthesisVoice` nor any browser
 * exposes an actual quality score, so this only orders candidates; it can't guarantee "best". */
function voiceQualityScore(voice: SpeechSynthesisVoice): number {
  let score = 0;
  if (!voice.localService) score += 2; // network voice — usually the biggest quality jump
  if (/neural|natural|premium|enhanced|online/i.test(voice.name)) score += 2;
  if (voice.default) score += 1;
  return score;
}

/** All installed/available voices matching `locale`, best-sounding first (see voiceQualityScore).
 * Used both to auto-pick a default in speak() and to let the user browse/override that choice. */
export async function listVoicesForLocale(locale: AppLocale): Promise<SpeechSynthesisVoice[]> {
  const bcp47 = localeToBcp47(locale).slice(0, 2).toLowerCase();
  const voices = await getVoices();
  return voices.filter((v) => v.lang.toLowerCase().startsWith(bcp47)).sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a));
}

// Module-level singleton for the cloud-TTS audio element — mirrors the "only one utterance in
// flight" invariant speechSynthesis gives for free, but there's no such built-in for a plain
// <audio>/Audio() element, so this file tracks it by hand. `cloudAudioDone` lets stopCloudAudio()
// resolve whatever playCloudAudio() promise is still pending when it's superseded/cancelled,
// instead of leaving it hanging forever.
let cloudAudioEl: HTMLAudioElement | null = null;
let cloudAudioUrl: string | null = null;
let cloudAudioDone: (() => void) | null = null;

function stopCloudAudio(): void {
  if (cloudAudioEl) {
    cloudAudioEl.pause();
    cloudAudioEl.src = "";
    cloudAudioEl = null;
  }
  if (cloudAudioUrl) {
    // Object URLs aren't garbage-collected on their own — over a long interview session with many
    // questions, forgetting this revoke would leak one blob per question for the life of the tab.
    URL.revokeObjectURL(cloudAudioUrl);
    cloudAudioUrl = null;
  }
  cloudAudioDone?.();
  cloudAudioDone = null;
}

/** Stops whichever TTS source is currently playing — browser speechSynthesis AND/OR the cloud-TTS
 * audio element, since speak() below can end up using either one and a caller (e.g. "user started
 * talking, interrupt the question being read") shouldn't have to know which. The single
 * cancellation point for this feature — call this instead of `speechSynthesis.cancel()` directly. */
export function stopSpeaking(): void {
  if (ttsSupported()) speechSynthesis.cancel();
  stopCloudAudio();
}

function playCloudAudio(blob: Blob): Promise<void> {
  stopCloudAudio();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  cloudAudioUrl = url;
  cloudAudioEl = audio;
  return new Promise((resolve) => {
    cloudAudioDone = resolve;
    const finish = () => {
      if (cloudAudioEl === audio) cloudAudioEl = null;
      if (cloudAudioUrl === url) {
        URL.revokeObjectURL(url);
        cloudAudioUrl = null;
      }
      cloudAudioDone = null;
      resolve();
    };
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    // `HTMLMediaElement.play()` is spec'd to return a Promise, but not every environment honors
    // that (older Safari, and jsdom in tests, both return `undefined`) — Promise.resolve(...)
    // normalizes either shape so `.catch` never throws on a missing method.
    Promise.resolve(audio.play()).catch(finish);
  });
}

/** Reads `text` aloud in `locale`. Tries the server's neural TTS first (see
 * shared/api.ts's speakViaCloudTts) for a natural-sounding voice; falls back to the browser's
 * speechSynthesis — unchanged from before this existed — when the cloud voice is unavailable (no
 * key configured, cost cap hit, or any network/server error). Cancels any speech already in
 * flight from either source first — two overlapping questions would otherwise talk over each
 * other. `voiceURI` pins an exact browser voice (from listVoicesForLocale/getVoices) for the
 * fallback path — when omitted, picks the best-scoring voice for the locale, and falls back to
 * the browser's default voice when nothing matches (rather than silently doing nothing). */
export async function speak(text: string, locale: AppLocale, voiceURI?: string): Promise<void> {
  if (!text.trim()) return;
  stopSpeaking();
  const cloudAudio = await api.speakViaCloudTts(text);
  if (cloudAudio) {
    await playCloudAudio(cloudAudio);
    return;
  }
  if (!ttsSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = localeToBcp47(locale);
  const candidates = await listVoicesForLocale(locale);
  const picked = (voiceURI && candidates.find((v) => v.voiceURI === voiceURI)) || candidates[0];
  if (picked) utterance.voice = picked;
  speechSynthesis.speak(utterance);
}

export interface SpeechToText {
  supported: boolean;
  listening: boolean;
  interimText: string;
  error: string | null;
  /** Starts listening; `onFinal` fires once with the accumulated transcript when stop() is called
   * (or the recognition ends after an explicit stop request). */
  start: (onFinal: (text: string) => void) => void;
  stop: () => void;
}

/** Wraps SpeechRecognition as a start/stop-to-finalize hook. Uses `continuous: true` (not the
 * default single-utterance mode) because a real interview answer runs 30-90s with pauses — a
 * non-continuous recognizer would cut off at the first pause. Chrome also ends a long continuous
 * session on its own before the user is done; this restarts it transparently unless the user
 * explicitly asked to stop. */
export function useSpeechToText(locale: AppLocale): SpeechToText {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef("");
  const stoppedByUserRef = useRef(false);
  const onFinalRef = useRef<((text: string) => void) | null>(null);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;
      onFinalRef.current = onFinal;
      finalTextRef.current = "";
      stoppedByUserRef.current = false;
      setInterimText("");
      setError(null);
      const recognition = new Ctor();
      recognition.lang = localeToBcp47(locale);
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (ev) => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const result = ev.results[i]!;
          if (result.isFinal) finalTextRef.current += result[0].transcript + " ";
          else interim += result[0].transcript;
        }
        setInterimText(interim);
      };
      recognition.onerror = (ev) => setError(ev.error);
      recognition.onend = () => {
        if (stoppedByUserRef.current) {
          setListening(false);
          onFinalRef.current?.(finalTextRef.current.trim());
        } else {
          recognition.start();
        }
      };
      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    },
    [locale],
  );

  // Cleanup on unmount — a navigated-away recognizer/utterance is otherwise a global that outlives
  // the component (keeps the mic hot / keeps talking).
  useEffect(
    () => () => {
      stoppedByUserRef.current = true;
      recognitionRef.current?.abort();
      stopSpeaking();
    },
    [],
  );

  return { supported: sttSupported(), listening, interimText, error, start, stop };
}
