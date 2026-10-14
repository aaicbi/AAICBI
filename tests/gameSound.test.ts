import { describe, expect, it, vi } from "vitest";
import { SOUND_PREF_KEY, SOUND_SCORES, createSoundEngine, readSoundPref, writeSoundPref, type SoundName } from "@/lib/games/sound";

describe("the sound choice", () => {
  it("is off until the learner turns it on", () => {
    expect(readSoundPref(null)).toBe(false);
    expect(readSoundPref({ getItem: () => null })).toBe(false);
    expect(readSoundPref({ getItem: () => "off" })).toBe(false);
    expect(readSoundPref({ getItem: () => "on" })).toBe(true);
  });
  it("is remembered, and a blocked store never breaks the game", () => {
    const store: Record<string, string> = {};
    writeSoundPref({ setItem: (k, v) => void (store[k] = v) }, true);
    expect(store[SOUND_PREF_KEY]).toBe("on");
    writeSoundPref({ setItem: (k, v) => void (store[k] = v) }, false);
    expect(store[SOUND_PREF_KEY]).toBe("off");
    expect(() => writeSoundPref({ setItem: () => { throw new Error("blocked"); } }, true)).not.toThrow();
    expect(readSoundPref({ getItem: () => { throw new Error("blocked"); } })).toBe(false);
  });
});

describe("the sounds themselves", () => {
  const names = Object.keys(SOUND_SCORES) as SoundName[];
  it("are brief, quiet and finite", () => {
    for (const name of names) {
      const notes = SOUND_SCORES[name];
      expect(notes.length).toBeGreaterThan(0);
      const end = Math.max(...notes.map((n) => n.t + n.d));
      expect(end).toBeLessThanOrEqual(0.8);
      for (const n of notes) {
        expect(Number.isFinite(n.f) && n.f > 100 && n.f < 4000).toBe(true);
        expect(n.v).toBeGreaterThan(0);
        expect(n.v).toBeLessThanOrEqual(0.15);
      }
    }
  });
  it("make a miss softer and lower than a success", () => {
    const peak = (n: SoundName) => Math.max(...SOUND_SCORES[n].map((x) => x.v));
    const pitch = (n: SoundName) => Math.max(...SOUND_SCORES[n].map((x) => x.f));
    expect(peak("wrong")).toBeLessThan(peak("correct"));
    expect(pitch("wrong")).toBeLessThan(pitch("correct"));
  });
});

describe("the sound engine", () => {
  it("does nothing, without error, when the browser can't make sound", () => {
    const engine = createSoundEngine({} as never);
    expect(() => { engine.unlock(); engine.play("correct"); engine.close(); }).not.toThrow();
  });
  it("never plays before it has been unlocked by a tap", () => {
    const create = vi.fn();
    class FakeCtx {
      state = "suspended";
      currentTime = 0;
      destination = {};
      createOscillator = create;
      createGain = create;
      resume = async () => {};
      close = async () => {};
    }
    const engine = createSoundEngine({ AudioContext: FakeCtx } as never);
    engine.play("correct"); // no context yet
    expect(create).not.toHaveBeenCalled();
    engine.unlock(); // creates the context but it is still suspended
    engine.play("correct");
    expect(create).not.toHaveBeenCalled();
  });
  it("plays once the context is running", () => {
    const osc = { type: "", frequency: { value: 0 }, connect: vi.fn(function (this: unknown) { return { connect: vi.fn() }; }), start: vi.fn(), stop: vi.fn() };
    const gain = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(() => ({ connect: vi.fn() })) };
    class FakeCtx {
      state = "running";
      currentTime = 0;
      destination = {};
      createOscillator = () => ({ ...osc, connect: () => ({ connect: () => {} }) });
      createGain = () => gain;
      resume = async () => {};
      close = async () => {};
    }
    const engine = createSoundEngine({ AudioContext: FakeCtx } as never);
    engine.unlock();
    expect(() => engine.play("correct")).not.toThrow();
    expect(gain.gain.setValueAtTime).toHaveBeenCalled();
  });
});
