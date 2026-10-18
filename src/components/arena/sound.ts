/** Small sounds made in the browser (no files). Kept off until a player's tap has woken the audio. */
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
function beep(freq: number, ms: number, vol: number, type: OscillatorType = "square") {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + ms / 1000);
}
/** The answer clock. Higher and sharper in the last seconds. */
export const tick = (urgent: boolean) => beep(urgent ? 1100 : 760, 70, urgent ? 0.07 : 0.045);
/** The pick-a-number clock is a softer, different tone so players can tell the two apart. */
export const pickTick = (urgent: boolean) => beep(urgent ? 620 : 420, 90, 0.05, "sine");
export const chime = () => { beep(660, 120, 0.06, "sine"); setTimeout(() => beep(880, 160, 0.06, "sine"), 110); };
export const wake = () => { audio(); };
