import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localeToBcp47, speak, stopSpeaking } from "./speech";
import { api } from "../../shared/api";

vi.mock("../../shared/api", () => ({
  api: { speakViaCloudTts: vi.fn() },
}));

describe("localeToBcp47()", () => {
  it("maps app locales to their BCP-47 tag", () => {
    expect(localeToBcp47("en")).toBe("en-US");
    expect(localeToBcp47("uk")).toBe("uk-UA");
  });
});

// speak() tries the cloud-TTS endpoint (shared/api.ts's speakViaCloudTts, mocked above) first and
// only falls back to the browser's speechSynthesis when that resolves to `null` — the "cloud TTS
// unavailable" signal from a 204 response, a failed call, or a network error. These tests stand
// in a fake speechSynthesis (jsdom has no real implementation) and stub the DOM Audio element
// (jsdom's HTMLMediaElement.play() isn't implemented) to observe which path actually got used.
describe("speak()", () => {
  let speakSynthesisSpy: ReturnType<typeof vi.fn>;
  let cancelSpy: ReturnType<typeof vi.fn>;
  let playSpy: ReturnType<typeof vi.spyOn>;
  let pauseSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(api.speakViaCloudTts).mockReset();

    speakSynthesisSpy = vi.fn();
    cancelSpy = vi.fn();
    // jsdom doesn't implement the Web Speech API at all — neither speechSynthesis nor its
    // Utterance constructor exist as globals, so both need a minimal stand-in here.
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        voice: unknown = null;
        constructor(public text: string) {}
      },
    );
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: speakSynthesisSpy,
        cancel: cancelSpy,
        // A non-empty list so listVoicesForLocale() (called inside speak()'s fallback branch)
        // resolves synchronously instead of waiting on a "voiceschanged" event jsdom never fires.
        getVoices: () => [
          { lang: "en-US", name: "Test Voice", voiceURI: "test-voice", default: true, localService: true } as SpeechSynthesisVoice,
        ],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-audio-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    // Simulates real playback finishing — dispatches "ended" on the next microtask so awaiting
    // speak() resolves the same way it would once real audio actually finishes playing.
    playSpy = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLAudioElement) {
      queueMicrotask(() => this.dispatchEvent(new Event("ended")));
      return Promise.resolve();
    });
    pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    stopSpeaking();
    vi.restoreAllMocks();
  });

  it("plays the cloud audio and never touches speechSynthesis when the endpoint returns a Blob", async () => {
    const blob = new Blob(["fake-mp3-bytes"], { type: "audio/mpeg" });
    vi.mocked(api.speakViaCloudTts).mockResolvedValue(blob);

    await speak("Tell me about yourself", "en");

    expect(api.speakViaCloudTts).toHaveBeenCalledWith("Tell me about yourself");
    expect(playSpy).toHaveBeenCalledTimes(1);
    expect(speakSynthesisSpy).not.toHaveBeenCalled();
  });

  it("falls back to speechSynthesis, exactly as before, when the cloud endpoint is unavailable (204 -> null)", async () => {
    vi.mocked(api.speakViaCloudTts).mockResolvedValue(null);

    await speak("Tell me about yourself", "en");

    expect(speakSynthesisSpy).toHaveBeenCalledTimes(1);
    expect(playSpy).not.toHaveBeenCalled();
  });

  it("stopSpeaking() cancels both speechSynthesis and any in-flight cloud audio playback", async () => {
    const blob = new Blob(["fake-mp3-bytes"], { type: "audio/mpeg" });
    // No auto "ended" dispatch here — playback stays "in flight" until explicitly stopped, so this
    // exercises the cancellation path itself rather than natural completion.
    playSpy.mockImplementation(() => Promise.resolve());
    vi.mocked(api.speakViaCloudTts).mockResolvedValue(blob);

    const pending = speak("Tell me about yourself", "en");
    // Let speak()'s internal awaits (speakViaCloudTts, then playCloudAudio's setup) run before the
    // audio is considered "playing".
    await Promise.resolve();
    await Promise.resolve();

    stopSpeaking();
    await pending;

    expect(pauseSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-audio-url");
    // The prior in-flight cloud audio and the (would-be) browser utterance are both stopped by a
    // single call — speechSynthesis.cancel() runs unconditionally inside stopSpeaking().
    expect(cancelSpy).toHaveBeenCalled();
  });
});
