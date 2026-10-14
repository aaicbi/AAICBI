"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSoundEngine, readSoundPref, writeSoundPref, type SoundEngine, type SoundName } from "@/lib/games/sound";

/** Sound for the games: off until switched on, remembered on this device, and a no-op when the browser can't make sound. */
export function useGameSound() {
  const [enabled, setEnabled] = useState(false);
  const engine = useRef<SoundEngine | null>(null);
  const enabledRef = useRef(false);

  useEffect(() => {
    engine.current = createSoundEngine();
    const on = readSoundPref(window.localStorage);
    enabledRef.current = on;
    setEnabled(on);
    return () => {
      engine.current?.close();
      engine.current = null;
    };
  }, []);

  /** Plays only if sound is on. Never throws. */
  const play = useCallback((name: SoundName) => {
    if (enabledRef.current) engine.current?.play(name);
  }, []);

  /** Needs a tap or click, which is what unlocks sound in the browser. */
  const toggle = useCallback(() => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    writeSoundPref(window.localStorage, next);
    if (next) {
      engine.current?.unlock();
      // The context may need a moment to start running after the tap.
      setTimeout(() => engine.current?.play("select"), 60);
    }
  }, []);

  /** Also unlocks sound when the learner taps Start with sound already on from before. */
  const unlock = useCallback(() => {
    if (enabledRef.current) engine.current?.unlock();
  }, []);

  return { enabled, toggle, play, unlock };
}
