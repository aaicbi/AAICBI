"use client";
import { useEffect, useState } from "react";

/** The signed-in person's permissions, for pages that show or hide things. `null` while loading. The server still checks every action. */
export function useMyAccess(): { kind: string; permissions: Set<string> } | null {
  const [v, setV] = useState<{ kind: string; permissions: Set<string> } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/me/access", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (live) setV({ kind: j.kind ?? "none", permissions: new Set<string>(Array.isArray(j.permissions) ? j.permissions : []) }); })
      .catch(() => { if (live) setV({ kind: "none", permissions: new Set() }); });
    return () => { live = false; };
  }, []);
  return v;
}
