/** Sounds made in the browser (no files): a game-show kit built from small synthesized notes. Audio wakes on the player's first tap. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

type Wave = OscillatorType;
/** One note: soft attack, exponential fade, optional pitch slide. */
function note(freq: number, when: number, dur: number, vol = 0.12, type: Wave = "triangle", slideTo?: number) {
  const c = audio(); if (!c || !master) return;
  const t = c.currentTime + when;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
/** A short burst of filtered noise: whooshes, clicks, cymbal-like shimmer. */
function noise(when: number, dur: number, vol = 0.08, from = 800, to = 4000) {
  const c = audio(); if (!c || !master) return;
  const t = c.currentTime + when;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur); f.Q.value = 1.2;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.5, G6 = 1568;

/** The answer clock: a crisp woodblock tick that gets higher and sharper as time runs out. */
export const tick = (urgent: boolean) => { note(urgent ? 1500 : 980, 0, 0.05, urgent ? 0.1 : 0.06, "square"); noise(0, 0.02, 0.03, 2500, 5000); };
/** The other half of the clock: a lower, rounder "tock", so ticks and tocks alternate like a real clock. */
export const tock = (urgent: boolean) => { note(urgent ? 1150 : 700, 0, 0.07, urgent ? 0.1 : 0.06, "triangle"); noise(0, 0.02, 0.025, 1500, 3000); };
/** The last five seconds: a rising beep for each. */
export const countdownBeep = (left: number) => note(600 + (6 - Math.min(left, 5)) * 120, 0, 0.14, 0.11, "square");
export const tap = () => note(520, 0, 0.06, 0.07, "sine", 780);
/** Picking a number: a bright "pop" with a little sparkle. */
export const select = () => { note(440, 0, 0.1, 0.1, "triangle", 880); note(1320, 0.07, 0.12, 0.05, "sine"); };
/** A new question arrives. */
export const whoosh = () => { noise(0, 0.35, 0.09, 300, 3500); note(330, 0.02, 0.28, 0.06, "sawtooth", 660); };
/** Right answer: a bright rising arpeggio, bigger for longer streaks. */
export const correct = (streak = 1) => {
  const base = [C5, E5, G5, C6];
  base.forEach((f, i) => note(f, i * 0.07, 0.22, 0.12, "triangle"));
  note(C6, 0.3, 0.4, 0.09, "sine"); noise(0.28, 0.4, 0.05, 4000, 9000);
  if (streak >= 3) [E6, G6].forEach((f, i) => note(f, 0.34 + i * 0.08, 0.3, 0.08, "triangle"));
};
/** A miss: a gentle falling "bwomp", never harsh. */
export const wrong = () => { note(300, 0, 0.32, 0.12, "triangle", 150); note(220, 0.18, 0.34, 0.09, "sine", 110); };
/** Bonus chance: a quick dramatic stinger. */
export const stealAlert = () => { [392, 523, 392, 659].forEach((f, i) => note(f, i * 0.09, 0.16, 0.1, "square")); noise(0, 0.3, 0.07, 500, 3000); };
/** Points awarded: coin-style two-note ding. */
export const coin = () => { note(988, 0, 0.09, 0.1, "square"); note(1319, 0.08, 0.35, 0.1, "square"); };
export const countHit = (n: number) => note(440 + n * 110, 0, 0.18, 0.12, "triangle");
export const go = () => { [C5, E5, G5, C6].forEach((f) => note(f, 0, 0.5, 0.07, "triangle")); noise(0, 0.5, 0.08, 1000, 8000); };
/** Reactions: a pop with a pitch of its own so each one is recognisable. */
export const reactionPop = (kind: string) => {
  const pitch: Record<string, number> = { applause: 700, cheer: 880, wow: 560, fire: 620, love: 780, strong: 480, nervous: 400, sad: 330, laugh: 940, thumbs: 720, gg: 660, think: 500 };
  const f = pitch[kind] ?? 700;
  if (kind === "applause") { for (let i = 0; i < 7; i++) noise(i * 0.06, 0.05, 0.07, 1500, 6000); return; }
  if (kind === "cheer") { noise(0, 0.5, 0.08, 800, 6000); [C5, G5, C6].forEach((x, i) => note(x, i * 0.08, 0.2, 0.09)); return; }
  note(f, 0, 0.12, 0.1, "triangle", f * 1.5); note(f * 1.5, 0.1, 0.16, 0.08, "sine");
};
export const message = () => { note(880, 0, 0.08, 0.06, "sine"); note(1175, 0.07, 0.1, 0.05, "sine"); };
/** Victory fanfare. */
export const victory = () => {
  [C5, C5, C5, G5].forEach((f, i) => note(f, i * 0.13, i === 3 ? 0.3 : 0.12, 0.12, "square"));
  [E5, G5, C6].forEach((f, i) => note(f, 0.62 + i * 0.1, 0.6, 0.1, "triangle"));
  [E6, G6].forEach((f, i) => note(f, 0.95 + i * 0.1, 0.7, 0.08, "sine"));
  noise(0.62, 1.2, 0.07, 3000, 10000);
};
/** Defeat: warm and kind, a sigh rather than a sting. */
export const defeat = () => { [G5, E5, C5].forEach((f, i) => note(f, i * 0.2, 0.4, 0.09, "triangle")); };
export const draw = () => { [C5, G5, C5].forEach((f, i) => note(f, i * 0.15, 0.3, 0.09, "triangle")); };
export const wake = () => { audio(); };
