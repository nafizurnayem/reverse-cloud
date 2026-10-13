import type {
  ChatStreamEvent,
  EstimateCardData,
  HumanHandoffCardData,
  LeadSavedCardData,
} from "./protocol";

export type MockStreamScenario =
  | "greeting"
  | "estimate"
  | "lead_saved"
  | "human_handoff"
  | "kill_switch_error";

export interface MockStreamOptions {
  delayMs?: number;
  locale?: "en" | "bn";
  conversationId?: string;
}

export const sampleEstimate: EstimateCardData = {
  serviceSlug: "cloud-architecture",
  serviceTitle: "Cloud Architecture & Modernization",
  minPriceUsd: 4000,
  maxPriceUsd: 12000,
  minPriceBdt: 480000,
  maxPriceBdt: 1440000,
  timelineWeeksMin: 3,
  timelineWeeksMax: 6,
  deliverables: [
    "High-availability multi-region VPC design",
    "Terraform IaC automation with zero-drift state",
    "Kubernetes / Container migration & CI/CD pipeline",
    "24/7 telemetry & alerting setup",
  ],
  summary: "Comprehensive multi-cloud infrastructure blueprint with automated CI/CD and cost monitoring.",
};

export const sampleLeadSaved: LeadSavedCardData = {
  leadId: "lead-mock-8841",
  name: "Rahim Chowdhury",
  email: "rahim@techfin.example.com",
  phone: "+880 1711 000000",
  serviceInterest: "Cloud Architecture & Modernization",
  message: "Looking to migrate our legacy banking service to AWS with zero downtime.",
  savedAt: new Date().toISOString(),
};

export const sampleHumanHandoff: HumanHandoffCardData = {
  status: "available",
  reason: "Complex multi-cloud compliance and custom SLA requirements detected.",
  suggestedAction: "contact_form",
  contactEmail: "solutions@revcloud.dev",
  supportHours: "Sun - Thu, 9:00 AM - 6:00 PM BST (UTC+6)",
};

function formatSseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function getMockEvents(
  scenario: MockStreamScenario,
  locale: "en" | "bn" = "en",
  conversationId = "mock-conv-1234",
): ChatStreamEvent[] {
  const isBn = locale === "bn";

  if (scenario === "kill_switch_error") {
    return [
      { event: "message_start", data: { conversation_id: conversationId } },
      {
        event: "error",
        data: {
          code: "service_unavailable",
          message: isBn
            ? "এআই পরিষেবা সাময়িকভাবে অনুপলব্ধ। অনুগ্রহ করে যোগাযোগ ফর্ম ব্যবহার করুন।"
            : "AI service is currently unavailable. Please reach us via our contact form.",
        },
      },
    ];
  }

  const events: ChatStreamEvent[] = [
    { event: "message_start", data: { conversation_id: conversationId } },
  ];

  let text = "";
  if (scenario === "greeting") {
    text = isBn
      ? "হ্যালো! রিভার্স ক্লাউডে আপনাকে স্বাগতম। আমরা আপনাকে কীভাবে সাহায্য করতে পারি? ক্লাউড আর্কিটেকচার, ডেভঅপ্স, নাকি কাস্টম সফটওয়্যার ইঞ্জিনিয়ারিং?"
      : "Hello! Welcome to Reverse Cloud. How can we help you today? Are you interested in Cloud Architecture, DevOps, or Custom Software Engineering?";
  } else if (scenario === "estimate") {
    text = isBn
      ? "আপনার প্রয়োজনীয়তার উপর ভিত্তি করে আমরা একটি প্রাথমিক বাজেট এবং সময়সীমার হিসেব তৈরি করেছি:"
      : "Based on your technical requirements, here is an initial scope, budget, and timeline estimate:";
  } else if (scenario === "lead_saved") {
    text = isBn
      ? "ধন্যবাদ! আপনার প্রজেক্টের তথ্য সফলভাবে সংরক্ষিত হয়েছে। আমাদের টেকনিক্যাল টিম খুব শীঘ্রই আপনার সাথে যোগাযোগ করবে।"
      : "Thank you! Your project details have been successfully recorded. Our technical lead will review and get in touch.";
  } else if (scenario === "human_handoff") {
    text = isBn
      ? "আপনার এই বিশেষ রিকয়ারমেন্টের জন্য আমি আমাদের সিনিয়র ক্লাউড আর্কিটেক্টের সাথে যোগাযোগ করিয়ে দিচ্ছি:"
      : "For these specialized enterprise requirements, let's connect you directly with a Senior Solutions Architect:";
  }

  // Split into token chunks (words or characters)
  const tokens = text.split(/(\s+)/);
  for (const token of tokens) {
    if (token) {
      events.push({ event: "text_delta", data: { text: token } });
    }
  }

  // Append card if applicable
  if (scenario === "estimate") {
    events.push({ event: "card", data: { type: "estimate", data: sampleEstimate } });
  } else if (scenario === "lead_saved") {
    events.push({ event: "card", data: { type: "lead_saved", data: sampleLeadSaved } });
  } else if (scenario === "human_handoff") {
    events.push({ event: "card", data: { type: "human_handoff", data: sampleHumanHandoff } });
  }

  events.push({ event: "message_end", data: { reason: "stop" } });
  return events;
}

export function createMockChatReadableStream(
  scenario: MockStreamScenario,
  options: MockStreamOptions = {},
): ReadableStream<Uint8Array> {
  const { delayMs = 0, locale = "en", conversationId = "mock-conv-1234" } = options;
  const events = getMockEvents(scenario, locale, conversationId);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const item of events) {
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        let chunk = "";
        if (item.event === "card") {
          chunk = formatSseEvent("card", item.data as unknown as Record<string, unknown>);
        } else {
          chunk = formatSseEvent(item.event, item.data as unknown as Record<string, unknown>);
        }

        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

export function createMockChatResponse(
  scenario: MockStreamScenario,
  options: MockStreamOptions = {},
): Response {
  if (scenario === "kill_switch_error" && options.delayMs === -1) {
    // Return HTTP 503 simulation
    return new Response(
      JSON.stringify({ error: "Chat service is not configured", code: "not_configured" }),
      {
        status: 503,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const stream = createMockChatReadableStream(scenario, options);
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}
