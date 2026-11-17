"use client";

import { Sparkles } from "lucide-react";
import { openChat } from "@/lib/chat/launcher";
import { cn } from "@/lib/utils";

interface AskAiButtonProps {
  label: string;
  /** Message sent to the assistant when the button is clicked. */
  prompt: string;
  variant?: "primary" | "outline";
  className?: string;
}

/** Opens the chat widget and asks the assistant about the current page. */
export function AskAiButton({ label, prompt, variant = "outline", className }: AskAiButtonProps) {
  return (
    <button
      type="button"
      onClick={() => openChat({ prompt, autoSend: true })}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
        variant === "primary"
          ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          : "border border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5",
        className,
      )}
    >
      <Sparkles className="h-4 w-4 text-current" />
      <span>{label}</span>
    </button>
  );
}
