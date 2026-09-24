"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { AdminResult } from "./actions";

type Props = {
  label: string;
  action: (reason: string) => Promise<AdminResult>;
  /** Ask for a reason/note before running (stored in the audit log and shown to users). */
  askReason?: string;
  confirm?: string;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
};

/** Small admin control: optional confirm/reason prompt, pending state and result message. */
export function AdminActionButton({ label, action, askReason, confirm, variant = "outline" }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminResult>();

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant={variant}
        disabled={pending}
        onClick={() => {
          let reason = "";
          if (askReason) {
            const answer = window.prompt(askReason);
            if (answer === null) return;
            reason = answer;
          } else if (confirm && !window.confirm(confirm)) {
            return;
          }
          start(async () => setResult(await action(reason)));
        }}
      >
        {pending ? "…" : label}
      </Button>
      {result?.error && <span className="text-xs font-semibold text-destructive">{result.error}</span>}
      {result?.ok && <span className="text-xs font-semibold text-accent-foreground">{result.ok}</span>}
    </span>
  );
}
