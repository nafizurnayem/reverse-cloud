"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  locale?: "en" | "bn";
  placeholder?: string;
  quickPrompts?: string[];
  /** Text placed in the box for the visitor to review; a new `id` applies it again. */
  prefill?: { id: number; text: string };
}

export function ChatInput({
  onSendMessage,
  isStreaming,
  disabled = false,
  locale = "en",
  placeholder,
  quickPrompts,
  prefill,
}: ChatInputProps) {
  const isBn = locale === "bn";
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Apply a new prefill during render (not in an effect) to avoid a cascading update.
  const [appliedPrefillId, setAppliedPrefillId] = useState<number | null>(null);
  if (prefill && prefill.id !== appliedPrefillId) {
    setAppliedPrefillId(prefill.id);
    setText(prefill.text);
  }

  useEffect(() => {
    if (appliedPrefillId !== null) textareaRef.current?.focus();
  }, [appliedPrefillId]);

  const defaultPlaceholder = isBn
    ? "সার্ভিস, বাজেট বা আর্কিটেকচার সম্পর্কে জিজ্ঞাসা করুন..."
    : "Ask about services, architecture, or project estimates...";

  const prompts = quickPrompts ?? (isBn
    ? [
        "ক্লাউড আর্কিটেকচার এস্টিমেট দিন",
        "ফুল-স্ট্যাক ওয়েব প্রজেক্টের বাজেট কত?",
        "সিনিয়র আর্কিটেক্টের সাথে কথা বলতে চাই",
      ]
    : [
        "Estimate a Cloud Architecture project",
        "How much does a full-stack web app cost?",
        "Connect me with a solutions architect",
      ]);

  function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSendMessage(trimmed);
    setText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t bg-card p-3 space-y-2">
      {prompts.length > 0 && !isStreaming && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
          <Sparkles className="h-3 w-3 text-primary shrink-0" />
          {prompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSendMessage(p)}
              disabled={disabled || isStreaming}
              className="shrink-0 rounded-full border bg-muted/60 px-2.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={12000}
          disabled={disabled || isStreaming}
          placeholder={placeholder || defaultPlaceholder}
          className="flex-1 max-h-28 min-h-[38px] resize-none rounded-xl border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!text.trim() || isStreaming || disabled}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40 transition-colors"
          aria-label={isBn ? "বার্তা পাঠান" : "Send message"}
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span>{isBn ? "Enter চাপুন পাঠাতে, Shift+Enter নতুন লাইনের জন্য" : "Enter to send, Shift+Enter for new line"}</span>
        <span>{text.length}/12000</span>
      </div>
    </div>
  );
}
