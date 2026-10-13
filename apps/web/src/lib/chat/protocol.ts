export type ChatRole = "user" | "assistant" | "system";

export interface EstimateCardData {
  serviceSlug?: string;
  serviceTitle: string;
  minPriceUsd: number;
  maxPriceUsd: number;
  minPriceBdt: number;
  maxPriceBdt: number;
  timelineWeeksMin: number;
  timelineWeeksMax: number;
  deliverables: string[];
  summary: string;
}

export interface LeadSavedCardData {
  leadId?: string;
  name: string;
  email: string;
  phone?: string;
  serviceInterest?: string;
  message?: string;
  savedAt?: string;
}

export interface HumanHandoffCardData {
  status: "queued" | "available" | "offline";
  reason: string;
  suggestedAction: "contact_form" | "email" | "call";
  contactEmail?: string;
  supportHours?: string;
}

export type ChatCard =
  | { type: "estimate"; data: EstimateCardData }
  | { type: "lead_saved"; data: LeadSavedCardData }
  | { type: "human_handoff"; data: HumanHandoffCardData };

export interface ChatMessageItem {
  id: string;
  role: ChatRole;
  content: string;
  cards?: ChatCard[];
  createdAt: number;
  isStreaming?: boolean;
  error?: string;
}

export type ChatStreamEvent =
  | { event: "message_start"; data: { conversation_id?: string } }
  | { event: "text_delta"; data: { text: string } }
  | { event: "card"; data: ChatCard }
  | { event: "message_end"; data: { reason: string } }
  | { event: "error"; data: { code: string; message: string } };

export type ChatStreamEventType = ChatStreamEvent["event"];
