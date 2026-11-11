"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import {
  Bot,
  MessageSquare,
  Minus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { ChatCard, ChatMessageItem } from "@/lib/chat/protocol";
import { parseChatStream } from "@/lib/chat/stream-parser";
import {
  createMockChatResponse,
  type MockStreamScenario,
} from "@/lib/chat/mock-stream";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";
import { FallbackState } from "./cards";

const welcomeNotificationKey = "rc_chat_welcome_notified_v2";
let preparedAudioContext: AudioContext | null = null;

function audioContextConstructor() {
  return window.AudioContext ?? (
    window as typeof window & { webkitAudioContext?: typeof AudioContext }
  ).webkitAudioContext;
}

function primeChatAudio() {
  try {
    const AudioContextConstructor = audioContextConstructor();
    if (!AudioContextConstructor) return;
    preparedAudioContext ??= new AudioContextConstructor();
    if (preparedAudioContext.state === "suspended") {
      void preparedAudioContext.resume().catch(() => {
        preparedAudioContext = null;
      });
    }
  } catch {
    preparedAudioContext = null;
  }
}

function playChatChime() {
  try {
    const AudioContextConstructor = audioContextConstructor();
    if (!AudioContextConstructor) return;

    const context = preparedAudioContext ?? new AudioContextConstructor();
    preparedAudioContext = context;
    const play = () => {
      const now = context.currentTime;
      const notes = [
        { frequency: 523.25, startsAt: 0, duration: 0.18, volume: 0.09 },
        { frequency: 783.99, startsAt: 0.13, duration: 0.28, volume: 0.075 },
      ];

      notes.forEach((note, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + note.startsAt;
        const end = start + note.duration;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(note.frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(note.volume, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(end);
        if (index === notes.length - 1) {
          oscillator.addEventListener("ended", () => {
            preparedAudioContext = null;
            void context.close();
          }, { once: true });
        }
      });
    };

    if (context.state === "suspended") {
      void context.resume().then(play).catch(() => {
        preparedAudioContext = null;
        void context.close();
      });
    } else {
      play();
    }
  } catch {
    // Browsers may block sound until the visitor has interacted with the page.
  }
}

interface ChatWidgetProps {
  locale?: "en" | "bn";
  initialOpen?: boolean;
  useMockStreamDefault?: boolean;
  turnstileSiteKey?: string;
}

export function ChatWidget({
  locale,
  initialOpen = false,
  useMockStreamDefault = false,
  turnstileSiteKey = "",
}: ChatWidgetProps) {
  const activeLocale = useLocale() === "bn" ? "bn" : "en";
  const effectiveLocale = locale ?? activeLocale;
  const isBn = effectiveLocale === "bn";
  const [isOpen, setIsOpen] = useState(initialOpen);
  const wasOpen = useRef(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showWelcomeNotification, setShowWelcomeNotification] = useState(false);
  const [useMock, setUseMock] = useState(() => {
    if (useMockStreamDefault) return true;
    return process.env.NEXT_PUBLIC_ENABLE_MOCK_CHAT === "true";
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [selectedMockScenario, setSelectedMockScenario] = useState<MockStreamScenario>("greeting");

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);

  // Restore chat messages from sessionStorage and check openChat/confirmProposal URL query params
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const shouldOpen = searchParams.get("openChat") === "true";
        const proposalId = searchParams.get("confirmProposal");

        if (shouldOpen || proposalId) {
          setIsOpen(true);
          setIsMinimized(false);
          sessionStorage.setItem(welcomeNotificationKey, "1");
        }

        const saved = sessionStorage.getItem("rc_chat_history");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch {
        // storage errors ignored
      }
    });
  }, []);

  // Prompt a first-time visitor once, provided they have not opened the chat.
  useEffect(() => {
    if (isOpen) {
      try {
        sessionStorage.setItem(welcomeNotificationKey, "1");
      } catch {
        // storage errors ignored
      }
      return;
    }

    try {
      if (sessionStorage.getItem(welcomeNotificationKey) === "1") return;
    } catch {
      // Continue with an in-memory notification when storage is unavailable.
    }

    const timer = window.setTimeout(() => {
      setShowWelcomeNotification(true);
      playChatChime();
      try {
        sessionStorage.setItem(welcomeNotificationKey, "1");
      } catch {
        // storage errors ignored
      }
    }, 3_000);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Play only after the panel and its first assistant message have appeared.
  useEffect(() => {
    if (!isOpen) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;

    const timer = window.setTimeout(playChatChime, 180);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Persist chat messages to sessionStorage across navigations / login return
  useEffect(() => {
    try {
      if (messages.length > 0) {
        sessionStorage.setItem("rc_chat_history", JSON.stringify(messages));
      }
    } catch {
      // storage errors ignored
    }
  }, [messages]);

  const greetingMessage: ChatMessageItem = {
    id: "welcome-1",
    role: "assistant",
    content: isBn
      ? "হ্যালো! রিভার্স ক্লাউডে আপনাকে স্বাগতম। আপনি কি কোনো প্রজেক্টের বাজেট এস্টিমেট বা আমাদের ইঞ্জিনিয়ারিং সার্ভিস সম্পর্কে জানতে চান?"
      : "Hello! Welcome to Reverse Cloud. How can I help you today? Would you like a project budget estimate, or details on our engineering services?",
    createdAt: 0,
  };

  const activeMessages = messages.length > 0 ? messages : [greetingMessage];

  function handleOpenChat() {
    primeChatAudio();
    setShowWelcomeNotification(false);
    setIsMinimized(false);
    setIsOpen(true);
    try {
      sessionStorage.setItem(welcomeNotificationKey, "1");
    } catch {
      // storage errors ignored
    }
  }

  function handleReset() {
    setMessages([]);
    setFallbackMode(false);
    setIsStreaming(false);
    try {
      sessionStorage.removeItem("rc_chat_history");
    } catch {
      // storage errors ignored
    }
  }

  function handleCardAction(action: string) {
    if (action === "consultation") {
      const discussMsg = isBn
        ? "আমি এই প্রজেক্টটি নিয়ে আলোচনা করতে চাই এবং একটি পরামর্শ মিটিং নির্ধারণ করতে চাই।"
        : "I would like to discuss this project and schedule a consultation.";
      void handleSendMessage(discussMsg);
    } else {
      setFallbackMode(true);
    }
  }

  async function handleSendMessage(userInput: string) {
    if (!userInput.trim() || isStreaming) return;

    const now = Date.now();
    const userMsg: ChatMessageItem = {
      id: `user-${now}`,
      role: "user",
      content: userInput,
      createdAt: now,
    };

    const assistantMsgId = `asst-${now}`;
    const assistantMsg: ChatMessageItem = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      cards: [],
      createdAt: now,
      isStreaming: true,
    };

    const baseMessages = messages.length > 0 ? messages : [greetingMessage];
    const updatedMessages = [...baseMessages, userMsg];
    setMessages([...updatedMessages, assistantMsg]);
    setIsStreaming(true);

    try {
      let response: Response;

      if (useMock) {
        // Map user input keywords to rich scenarios for testing
        let scenario: MockStreamScenario = selectedMockScenario;
        const lower = userInput.toLowerCase();
        if (lower.includes("estimate") || lower.includes("cost") || lower.includes("বাজেট") || lower.includes("এস্টিমেট")) {
          scenario = "estimate";
        } else if (lower.includes("save") || lower.includes("lead") || lower.includes("contact") || lower.includes("তথ্য")) {
          scenario = "lead_saved";
        } else if (lower.includes("human") || lower.includes("architect") || lower.includes("দল") || lower.includes("মানুষ")) {
          scenario = "human_handoff";
        } else if (
          lower.includes("booking") ||
          lower.includes("schedule") ||
          lower.includes("consult") ||
          lower.includes("meeting") ||
          lower.includes("মিটিং") ||
          lower.includes("সময়")
        ) {
          scenario = "booking_proposal";
        } else if (lower.includes("error") || lower.includes("fail") || lower.includes("ত্রুটি")) {
          scenario = "kill_switch_error";
        }

        response = createMockChatResponse(scenario, {
          delayMs: 20,
          locale: effectiveLocale,
        });
      } else {
        // Live API call
        response = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
            locale: effectiveLocale,
          }),
        });
      }

      // Check HTTP error or kill switch
      if (!response.ok || !response.body) {
        setFallbackMode(true);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  isStreaming: false,
                  error: isBn
                    ? "চ্যাট পরিষেবা সাময়িকভাবে অনুপলব্ধ। আমাদের সাথে সরাসরি যোগাযোগ করুন।"
                    : "Live chat service is temporarily unavailable. Please connect via our contact form.",
                }
              : m,
          ),
        );
        setIsStreaming(false);
        return;
      }

      if (response.headers.get("content-type")?.includes("application/json")) {
        const payload = await response.json() as { reply?: unknown; cards?: unknown };
        if (typeof payload.reply !== "string" || !payload.reply.trim()) {
          throw new Error("Chatbot returned an invalid reply");
        }
        const cards = Array.isArray(payload.cards) ? payload.cards as ChatCard[] : [];
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId
            ? { ...m, content: payload.reply as string, cards, isStreaming: false }
            : m),
        );
        return;
      }

      // Stream the response
      let streamedText = "";
      const streamedCards: ChatCard[] = [];

      for await (const event of parseChatStream(response.body)) {
        if (event.event === "text_delta") {
          streamedText += event.data.text;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: streamedText }
                : m,
            ),
          );
        } else if (event.event === "card") {
          streamedCards.push(event.data);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, cards: [...streamedCards] }
                : m,
            ),
          );
        } else if (event.event === "error") {
          setFallbackMode(true);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, error: event.data.message }
                : m,
            ),
          );
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, isStreaming: false }
            : m,
        ),
      );
    } catch {
      setFallbackMode(true);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                isStreaming: false,
                error: isBn
                  ? "নেটওয়ার্ক ত্রুটি। যোগাযোগ ফর্ম ব্যবহার করুন।"
                  : "Network error occurred. Please use our contact form.",
              }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end">
      {/* Floating Launcher Button */}
      {!isOpen && (
        <div className="flex flex-col items-end gap-2">
          {showWelcomeNotification && (
            <button
              type="button"
              onClick={handleOpenChat}
              className="max-w-[min(18rem,calc(100vw-2rem))] rounded-2xl rounded-br-sm border bg-card px-4 py-3 text-left text-sm text-card-foreground shadow-xl transition hover:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/20"
              aria-label={isBn ? "স্বাগত বার্তা খুলুন" : "Open welcome message"}
            >
              <span className="block font-semibold text-foreground">
                {isBn ? "হ্যালো! 👋" : "Hello! 👋"}
              </span>
              <span className="text-muted-foreground">
                {isBn ? "আমি কীভাবে আপনাকে সহায়তা করতে পারি?" : "How can I assist you?"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenChat}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-primary/95 focus:outline-none focus:ring-4 focus:ring-primary/30"
            aria-label={isBn ? "চ্যাট উইজেট খুলুন" : "Open chat widget"}
          >
            <MessageSquare className="h-6 w-6 transition-transform group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500" />
            </span>
          </button>
        </div>
      )}

      {/* Main Chat Panel */}
      {isOpen && (
        <div
          className={`flex w-[min(410px,calc(100vw-2rem))] flex-col rounded-2xl border bg-card text-card-foreground shadow-2xl transition-all duration-300 overflow-hidden ${
            isMinimized ? "h-auto" : "h-[min(590px,calc(100dvh-2rem))]"
          }`}
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-3 shrink-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Bot className="h-4 w-4" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
              </div>
              <div>
                <h3 className="text-xs font-bold leading-tight text-foreground flex items-center gap-1.5">
                  <span>{isBn ? "রিভার্স ক্লাউড এআই" : "Reverse Cloud AI"}</span>
                  <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-semibold text-primary">
                    v2.6
                  </span>
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  {isBn ? "তাৎক্ষণিক এস্টিমেট ও পরামর্শ" : "Instant Estimates & Architecture"}
                </p>
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {/* Mock stream toggle for development */}
              {process.env.NODE_ENV !== "production" && <button
                type="button"
                onClick={() => setUseMock(!useMock)}
                title={useMock ? "Using Mock Stream (click to use live API)" : "Using Live API (click to use Mock)"}
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-mono border transition-colors ${
                  useMock
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                }`}
              >
                {useMock ? "MOCK" : "LIVE"}
              </button>}

              <button
                type="button"
                onClick={handleReset}
                title={isBn ? "নতুন চ্যাট" : "New Chat"}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Expand" : "Minimize"}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title={isBn ? "বন্ধ করুন" : "Close"}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!isMinimized && (
            <>
              {/* Optional Scenario Selector when in Mock mode */}
              {process.env.NODE_ENV !== "production" && useMock && (
                <div className="flex items-center gap-1 bg-muted/30 px-3 py-1 border-b text-[10px] overflow-x-auto scrollbar-none">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span>Scenario:</span>
                  </span>
                  {(["greeting", "estimate", "lead_saved", "human_handoff", "booking_proposal", "kill_switch_error"] as MockStreamScenario[]).map(
                    (sc) => (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => setSelectedMockScenario(sc)}
                        className={`shrink-0 rounded px-1.5 py-0.5 font-medium transition-colors ${
                          selectedMockScenario === sc
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground border"
                        }`}
                      >
                        {sc}
                      </button>
                    ),
                  )}
                </div>
              )}

              {/* Message List */}
              <ChatMessageList
                messages={activeMessages}
                locale={effectiveLocale}
                turnstileSiteKey={turnstileSiteKey}
                onTriggerFallback={() => setFallbackMode(true)}
                onCardAction={handleCardAction}
              />

              {/* Fallback Banner rendered once at container level when in Error/Fallback Mode */}
              {fallbackMode && (
                <div className="p-3 border-t bg-card">
                  <FallbackState
                    locale={effectiveLocale}
                    onSuccess={() => setFallbackMode(false)}
                  />
                </div>
              )}

              {/* Input Area */}
              {!fallbackMode && (
                <ChatInput
                  onSendMessage={handleSendMessage}
                  isStreaming={isStreaming}
                  locale={effectiveLocale}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
