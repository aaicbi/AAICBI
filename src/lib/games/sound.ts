/**
 * Optional sound for the games. Short tones made in the browser (Web Audio), so there are no audio files to download, license or
 * lose. It is OFF until the learner turns it on, the choice is remembered on that device, nothing plays before the learner has
 * touched the page, and the game works the same with sound off or if the browser can't make sound at all.
 */

export type SoundName = "start" | "select" | "correct" | "wrong" | "achievement" | "streak" | "complete";

export const SOUND_PREF_KEY = "aaicbi.game.sound";

export function readSoundPref(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  try {
    return storage?.getItem(SOUND_PREF_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeSoundPref(storage: Pick<Storage, "setItem"> | null | undefined, on: boolean): void {
  try {
    storage?.setItem(SOUND_PREF_KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the choice just won't be remembered.
  }
}

export interface Note {
  /** Pitch in hertz. */
  f: number;
  /** When it starts, seconds from now. */
  t: number;
  /** How long it lasts, in seconds. */
  d: number;
  type?: OscillatorType;
  /** Loudness, 0 to 1. Kept low on purpose. */
  v: number;
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const B5 = 987.77;
const C6 = 1046.5;
const E6 = 1318.5;

/** Every sound is brief and gentle. A miss is soft and falling, never a buzzer. */
export const SOUND_SCORES: Record<SoundName, Note[]> = {
  select: [{ f: 640, t: 0, d: 0.05, type: "sine", v: 0.05 }],
  start: [
    { f: C5, t: 0, d: 0.12, type: "triangle", v: 0.09 },
    { f: E5, t: 0.1, d: 0.12, type: "triangle", v: 0.09 },
    { f: G5, t: 0.2, d: 0.2, type: "triangle", v: 0.09 },
  ],
  correct: [
    { f: C5, t: 0, d: 0.1, type: "triangle", v: 0.1 },
    { f: E5, t: 0.08, d: 0.2, type: "triangle", v: 0.1 },
  ],
  wrong: [
    { f: 262, t: 0, d: 0.16, type: "sine", v: 0.07 },
    { f: 220, t: 0.13, d: 0.24, type: "sine", v: 0.06 },
  ],
  achievement: [
    { f: C5, t: 0, d: 0.1, type: "triangle", v: 0.1 },
    { f: E5, t: 0.09, d: 0.1, type: "triangle", v: 0.1 },
    { f: G5, t: 0.18, d: 0.1, type: "triangle", v: 0.1 },
    { f: C6, t: 0.27, d: 0.32, type: "triangle", v: 0.11 },
  ],
  streak: [
    { f: E5, t: 0, d: 0.09, type: "triangle", v: 0.1 },
    { f: G5, t: 0.08, d: 0.09, type: "triangle", v: 0.1 },
    { f: B5, t: 0.16, d: 0.09, type: "triangle", v: 0.1 },
    { f: E6, t: 0.24, d: 0.34, type: "triangle", v: 0.11 },
  ],
  complete: [
    { f: C5, t: 0, d: 0.14, type: "triangle", v: 0.1 },
    { f: E5, t: 0.12, d: 0.14, type: "triangle", v: 0.1 },
    { f: G5, t: 0.24, d: 0.14, type: "triangle", v: 0.1 },
    { f: C6, t: 0.36, d: 0.4, type: "triangle", v: 0.12 },
    { f: E6, t: 0.36, d: 0.4, type: "sine", v: 0.05 },
  ],
};

type AudioCtor = typeof AudioContext;
type AudioWindow = { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };

export interface SoundEngine {
  /** Call from a tap or click: browsers only allow sound after the learner has touched the page. */
  unlock(): void;
  play(name: SoundName): void;
  close(): void;
}

export function createSoundEngine(win: AudioWindow | undefined = typeof window === "undefined" ? undefined : (window as unknown as AudioWindow)): SoundEngine {
  let ctx: AudioContext | null = null;
  const Ctor = win ? win.AudioContext ?? win.webkitAudioContext : undefined;

  function context(): AudioContext | null {
    if (!Ctor) return null;
    try {
      ctx = ctx ?? new Ctor();
      return ctx;
    } catch {
      return null;
    }
  }

  return {
    unlock() {
      const c = context();
      if (c && c.state === "suspended") void c.resume().catch(() => {});
    },
    play(name) {
      // Only ever play on a context that has been unlocked by a tap: never create one just to play.
      if (!ctx || ctx.state !== "running") return;
      try {
        const now = ctx.currentTime;
        for (const n of SOUND_SCORES[name]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = n.type ?? "sine";
          osc.frequency.value = n.f;
          const start = now + n.t;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(Math.max(n.v, 0.0002), start + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + n.d + 0.03);
        }
      } catch {
        // A failure to make a sound must never get in the way of the game.
      }
    },
    close() {
      const c = ctx;
      ctx = null;
      if (c) void c.close().catch(() => {});
    },
  };
}
