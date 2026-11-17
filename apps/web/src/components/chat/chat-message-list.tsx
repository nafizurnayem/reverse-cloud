"use client";

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import type { ChatCard, ChatMessageItem } from "@/lib/chat/protocol";
import {
  ConfirmationCard,
  BookingCancellationCard,
  BookingSchedulerCard,
  EstimateCard,
  HumanHandoffCard,
  LeadSavedCard,
} from "./cards";

interface ChatMessageListProps {
  messages: ChatMessageItem[];
  locale?: "en" | "bn";
  turnstileSiteKey?: string;
  onTriggerFallback?: () => void;
  onCardAction?: (action: string) => void;
  onBookingConfirmed?: () => void;
  onBookingCancelled?: () => void;
}

export function ChatMessageList({
  messages,
  locale = "en",
  turnstileSiteKey = "",
  onTriggerFallback,
  onCardAction,
  onBookingConfirmed,
  onBookingCancelled,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const isStreaming = messages.some((message) => message.isStreaming);
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: isStreaming ? "auto" : "smooth",
      });
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 space-y-4 text-xs"
    >
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const isTyping = !isUser && msg.isStreaming && !msg.content && !msg.error && !msg.cards?.length;

        return (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isUser
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground border"
              }`}
            >
              {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-primary" />}
            </div>

            <div className={`flex min-w-0 flex-col space-y-1.5 max-w-[85%] [overflow-wrap:anywhere] ${isUser ? "items-end" : "items-start"}`}>
              {isTyping && (
                <div
                  role="status"
                  aria-label={locale === "bn" ? "রিভার্স ক্লাউড এআই লিখছে" : "Reverse Cloud AI is typing"}
                  className="chat-typing-bubble flex h-9 items-center gap-1.5 rounded-2xl rounded-tl-none border bg-muted px-3.5"
                >
                  <span className="chat-typing-dot" aria-hidden="true" />
                  <span className="chat-typing-dot" aria-hidden="true" />
                  <span className="chat-typing-dot" aria-hidden="true" />
                  <span className="sr-only">
                    {locale === "bn" ? "উত্তর লেখা হচ্ছে…" : "Writing a reply…"}
                  </span>
                </div>
              )}
              {msg.content && (
                <div
                  className={`rounded-2xl px-3.5 py-2.5 leading-relaxed text-xs ${
                    isUser
                      ? "bg-primary text-primary-foreground rounded-tr-none shadow-sm"
                      : "bg-muted text-foreground rounded-tl-none border"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.isStreaming && (
                    <span className="inline-block h-3 w-1.5 ml-1 bg-primary animate-pulse align-middle" />
                  )}
                </div>
              )}

              {/* Cards rendering */}
              {msg.cards && msg.cards.length > 0 && (
                <div className="w-full space-y-2 pt-1">
                  {msg.cards.map((card: ChatCard, idx: number) => {
                    if (card.type === "estimate") {
                      return (
                        <EstimateCard
                          key={idx}
                          data={card.data}
                          locale={locale}
                          onActionClick={onCardAction}
                        />
                      );
                    }
                    if (card.type === "lead_saved") {
                      return <LeadSavedCard key={idx} data={card.data} locale={locale} />;
                    }
                    if (card.type === "human_handoff") {
                      return (
                        <HumanHandoffCard
                          key={idx}
                          data={card.data}
                          locale={locale}
                          onTriggerFallback={onTriggerFallback}
                        />
                      );
                    }
                    if (card.type === "booking_proposal") {
                      return (
                        <ConfirmationCard
                          key={idx}
                          data={card.data}
                          locale={locale}
                        />
                      );
                    }
                    if (card.type === "booking_scheduler") {
                      return (
                        <BookingSchedulerCard
                          key={idx}
                          data={card.data}
                          locale={locale}
                          turnstileSiteKey={turnstileSiteKey}
                          onBookingConfirmed={onBookingConfirmed}
                        />
                      );
                    }
                    if (card.type === "booking_cancellation") {
                      return <BookingCancellationCard key={idx} locale={locale} onCancelled={onBookingCancelled} />;
                    }
                    return null;
                  })}
                </div>
              )}

              {/* Error note within message bubble */}
              {msg.error && (
                <div className="w-full rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <p>{msg.error}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
