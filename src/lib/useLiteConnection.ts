"use client";
import { useEffect, useState } from "react";

/**
 * True on a slow (2G/3G) or data-saver connection. Starts true so the first paint never starts a big download;
 * a good connection flips it to false a moment later. Used to keep videos from downloading by themselves.
 */
export function useLiteConnection(): boolean {
  const [lite, setLite] = useState(true);
  useEffect(() => {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    setLite(!!c && (!!c.saveData || /^(slow-2g|2g|3g)$/.test(c.effectiveType ?? "")));
  }, []);
  return lite;
}
