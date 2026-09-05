"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function EnterExamCodePage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        <h1 className="text-center font-display text-xl font-semibold text-brand-ink">
          Enter your examination code
        </h1>
        <p className="mt-1 text-center text-sm text-gray-600">Your instructor will have shared this with you.</p>
        <Card className="mt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) router.push(`/exam/${code.trim().toUpperCase()}`);
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. AAICBI-EXCEL-2026"
              aria-label="Exam code"
              className="w-full rounded-lg border border-brand-gray px-4 py-3 text-center font-mono uppercase tracking-wide outline-none focus:border-brand-teal"
            />
            <Button type="submit" className="mt-4 w-full">
              Continue
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
