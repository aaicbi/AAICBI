"use client";
import { X } from "lucide-react";
import Icon from "@/components/ui/Icon";

interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
  senderLabel: string | null;
}

interface LoopBroadcastPopupProps {
  notifications: NotificationDto[];
  onClose: (id: string) => void;
}

/**
 * The persistent, corner-anchored popup for a genuine Loop broadcast —
 * added per explicit direction: a message from Loop should "pop out at
 * any visible side of the users page and remain there until the user
 * closes it themselves," so an admin can trust it was actually seen,
 * not just technically delivered.
 *
 * Deliberately a different pattern from src/components/ui/Toast.tsx,
 * which auto-dismisses after 3.5 seconds by design — the wrong shape
 * here. This component has no timer anywhere. It's rendered inside
 * NotificationBell (which already polls /api/notifications every 60
 * seconds) rather than adding a second fetch cycle, and reuses that
 * exact same `notifications` list and the same markRead the bell's
 * dropdown already calls — so closing a card IS what marks it read,
 * the one real, honest "seen" signal, and because it's driven by real
 * unread state in the database (not local component state), it
 * survives a page refresh or navigation until the recipient actually
 * clicks close.
 *
 * Ordinary notification types are untouched — they stay exactly as
 * before, visible only in the bell's own dropdown. This treatment is
 * reserved for type === "LOOP_BROADCAST" specifically.
 */
export default function LoopBroadcastPopup({ notifications, onClose }: LoopBroadcastPopupProps) {
  const unreadBroadcasts = notifications.filter((n) => n.type === "LOOP_BROADCAST" && !n.readAt);

  if (unreadBroadcasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-80 max-w-[92vw] flex-col-reverse gap-3">
      {unreadBroadcasts.map((n) => (
        <div
          key={n.id}
          className="animate-[modal-in_0.15s_ease-out] rounded-xl border border-brand-teal/40 bg-brand-surface p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-tealDeep">
              {n.senderLabel ?? "Loop — Systems Manager"}
            </p>
            <button
              onClick={() => onClose(n.id)}
              aria-label="Close"
              className="-mt-1 -mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-brand-mint hover:text-brand-teal"
            >
              <Icon icon={X} size="sm" />
            </button>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-brand-ink">{n.title}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{n.body}</p>
        </div>
      ))}
    </div>
  );
}
