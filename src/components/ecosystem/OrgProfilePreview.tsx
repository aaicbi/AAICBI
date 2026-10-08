"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import VerifiedBadge from "./VerifiedBadge";

export interface OrgProfilePreviewProps {
  name: string;
  logoUrl: string | null;
  slug: string;
  tagline: string;
  description: string;
  location: string;
  coverUrl: string;
  verified: boolean;
  publicEnabled: boolean;
}

const WEB_URL = /^https?:\/\//i;

/**
 * What visitors will see at the top of the organization's page, drawn from
 * the form as it is right now (saved or not), at computer or phone width.
 * It mirrors the real page's header, tagline and About text; the follow
 * button and tabs are shown inert so the shape is right without being
 * clickable.
 */
export default function OrgProfilePreview(p: OrgProfilePreviewProps) {
  const [width, setWidth] = useState<"computer" | "phone">("computer");
  const [coverFailed, setCoverFailed] = useState(false);
  useEffect(() => setCoverFailed(false), [p.coverUrl]);
  const showCover = WEB_URL.test(p.coverUrl) && !coverFailed;

  return (
    <section aria-labelledby="profile-preview-heading" className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="profile-preview-heading" className="font-display text-lg font-semibold text-brand-ink">Preview</h2>
          <p className="text-xs text-gray-600">How visitors and trainees will see your page. Updates as you type; nothing is shown publicly until you save and switch your page on.</p>
        </div>
        <div role="group" aria-label="Preview width" className="flex overflow-hidden rounded-lg border border-brand-gray text-xs font-semibold">
          {(["computer", "phone"] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={width === w}
              onClick={() => setWidth(w)}
              className={`px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal ${width === w ? "bg-brand-teal text-brand-onAccent" : "bg-brand-surface text-gray-700 hover:text-brand-teal"}`}
            >
              {w === "computer" ? "Computer" : "Phone"}
            </button>
          ))}
        </div>
      </div>

      {!p.publicEnabled && (
        <p className="mt-2 rounded-lg bg-brand-mint px-3 py-2 text-xs text-brand-ink">Your page is switched off, so visitors cannot see it yet. This is what they will see once you turn it on.</p>
      )}

      <div className="mt-3 overflow-x-auto rounded-xl bg-brand-sand p-3 sm:p-4">
        <div className="mx-auto" style={{ maxWidth: width === "phone" ? 360 : 720 }}>
          <div className="overflow-hidden rounded-xl border border-brand-gray bg-brand-surface">
            <div className="h-28 bg-brand-mint sm:h-36">
              {showCover && (
                // eslint-disable-next-line @next/next/no-img-element -- previewing an address the organization is typing.
                <img src={p.coverUrl} alt="" onError={() => setCoverFailed(true)} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="p-4">
              {p.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- the organization's own uploaded logo.
                <img src={p.logoUrl} alt="" className="-mt-12 h-16 w-16 rounded-xl border-4 border-brand-surface bg-brand-surface object-cover" />
              ) : (
                <span className="-mt-12 flex h-16 w-16 items-center justify-center rounded-xl border-4 border-brand-surface bg-brand-mint text-xl font-semibold text-brand-teal">{p.name.slice(0, 1)}</span>
              )}
              <h3 className="mt-2 font-display text-lg font-semibold text-brand-ink">{p.name}</h3>
              {p.verified && <VerifiedBadge />}
              {p.location.trim() && <p className="text-sm text-gray-600">{p.location}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {p.tagline.trim() && <p className="text-sm text-gray-700">{p.tagline}</p>}
                <span aria-hidden="true" className="rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-semibold text-brand-onAccent">Follow</span>
              </div>
            </div>
            <div aria-hidden="true" className="flex gap-1 overflow-hidden border-t border-brand-gray px-3 text-sm font-semibold text-gray-600">
              {["Home", "Programs", "Education", "Events", "About"].map((t, i) => (
                <span key={t} className={`whitespace-nowrap px-3 py-2.5 ${i === 0 ? "border-b-2 border-brand-teal text-brand-teal" : ""}`}>{t}</span>
              ))}
            </div>
          </div>
          <Card className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">About</p>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{p.description.trim() || "Nothing here yet. Add an About text so visitors know what you teach."}</p>
          </Card>
          <p className="mt-2 text-center text-xs text-gray-500">aaicbi.org/organizations/{p.slug}</p>
        </div>
      </div>
    </section>
  );
}
