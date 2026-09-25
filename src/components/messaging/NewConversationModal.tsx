"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { SkeletonList } from "@/components/ui/Skeleton";

interface Contact {
  type: "TRAINEE" | "STAFF";
  id: string;
  name: string;
  alreadyBlocked: boolean;
}

/**
 * The "new conversation" picker shared by the trainee and admin
 * Messages list pages — GET /api/conversations/contacts already scopes
 * the list correctly per caller (cohort-mates + reachable staff for a
 * trainee, owned-cohort trainees for ADMIN/INSTRUCTOR, everyone for
 * SUPER_ADMIN), so this component just renders whatever it returns.
 */
export default function NewConversationModal({ open, onClose, redirectBase }: { open: boolean; onClose: () => void; redirectBase: string }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    setContacts(null);
    fetch("/api/conversations/contacts")
      .then((r) => (r.ok ? r.json() : []))
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [open]);

  if (!open) return null;

  async function startChat(contact: Contact) {
    setStarting(`${contact.type}:${contact.id}`);
    const res = await fetch("/api/conversations/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerType: contact.type, peerId: contact.id }),
    });
    setStarting(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Couldn't start that conversation.", "error");
      return;
    }
    const { id } = await res.json();
    onClose();
    router.push(`${redirectBase}/${id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 px-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-brand-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-semibold text-brand-ink">New conversation</h2>
        {contacts === null ? (
          <div className="mt-4">
            <SkeletonList rows={3} />
          </div>
        ) : contacts.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No one is reachable yet.</p>
        ) : (
          <div className="mt-4 space-y-1">
            {contacts.map((c) => (
              <button
                key={`${c.type}:${c.id}`}
                onClick={() => startChat(c)}
                disabled={c.alreadyBlocked || starting !== null}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-brand-ink hover:bg-brand-mint/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {c.name} {c.type === "STAFF" && <span className="text-xs text-brand-teal">Staff</span>}
                </span>
                {c.alreadyBlocked && <span className="text-xs text-gray-400">Blocked</span>}
              </button>
            ))}
          </div>
        )}
        <Button variant="secondary" onClick={onClose} className="mt-4 w-full">
          Close
        </Button>
      </div>
    </div>
  );
}
