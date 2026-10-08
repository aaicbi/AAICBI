"use client";
import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

/**
 * The natural moment to ask for an account: right when a visitor tries
 * to do something that needs one. Opens a short dialog that says why and
 * offers to create an account or sign in, and brings a returning member
 * straight back to where they were.
 */
export default function SignupPromptButton({
  label,
  title,
  reason,
  next,
  size = "lg",
}: {
  label: string;
  title: string;
  reason: string;
  /** Where sign-in should return to. Must be a path on this site. */
  next: string;
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return (
    <>
      <Button type="button" size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="sm">
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{reason}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button href="/trainee/register" size="md">
            Create a free account
          </Button>
          <Button href={`/trainee/login?next=${encodeURIComponent(safeNext)}`} variant="secondary" size="md">
            I already have an account
          </Button>
          <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] text-sm font-semibold text-gray-600 hover:underline">
            Keep looking around
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Employer or organization?{" "}
          <Link href="/employer/login" className="font-semibold text-brand-teal underline underline-offset-2">
            Sign in here
          </Link>
          .
        </p>
      </Modal>
    </>
  );
}
