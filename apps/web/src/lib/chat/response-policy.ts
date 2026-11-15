export type ChatLocale = "en" | "bn";

const greetings = {
  en: new Set(["hi", "hello", "hey", "hi there", "hello there", "good morning", "good afternoon", "good evening"]),
  bn: new Set(["হাই", "হ্যালো", "হেলো", "সালাম", "আসসালামু আলাইকুম", "শুভ সকাল", "শুভ সন্ধ্যা"]),
};

const thanks = {
  en: new Set(["thanks", "thank you", "thank you very much", "thanks a lot", "no thanks", "no thank you"]),
  bn: new Set(["ধন্যবাদ", "অনেক ধন্যবাদ", "না ধন্যবাদ"]),
};

const goodbyes = {
  en: new Set(["bye", "goodbye", "see you", "talk later"]),
  bn: new Set(["বিদায়", "আবার দেখা হবে", "পরে কথা হবে"]),
};

const restrictedRequests = [
  /\b(?:write|generate|create|provide|give|show|share|send|explain)\b.{0,48}\b(?:source\s+code|code|script|repository|repo)\b/iu,
  /\b(?:system\s+prompt|hidden\s+instructions?|environment\s+variables?|\.env|web\.env|api[_ -]?key|access[_ -]?token|secret|password|credentials?|connection\s+string)\b/iu,
  /\b(?:show|give|reveal|dump|list|share|provide|send|export|access|read|download)\b.{0,64}\b(?:database|schema|tables?|sql|source\s+code|repository|internal|private|confidential|logs?|documents?|files?)\b/iu,
  /\b(?:show|give|reveal|dump|list|share|provide|send|export|access|tell)\b.{0,64}\b(?:users?|clients?|customers?|admins?|project\s+managers?|developers?|staff)\b.{0,32}\b(?:information|data|details|emails?|phones?|names?|accounts?|records?|passwords?)\b/iu,
  /\b(?:list|dump|export|access)\b.{0,32}\b(?:users?|clients?|customers?|admins?|project\s+managers?|developers?|staff)\b|\b(?:internal|private|confidential)\s+(?:documents?|files?|logs?|code|repository)\b|\bdatabase\s+dump\b/iu,
  /\b(?:ignore|disregard)\b.{0,32}\b(?:instructions?|prompts?|rules?)\b|\b(?:jailbreak|developer\s+mode|bypass\s+(?:safety|security|rules|filters))\b/iu,
  /\b(?:weather|recipe|cook(?:ing)?|medical\s+advice|diagnos(?:e|is)|legal\s+advice|politics|election|sports?\s+score|homework|exam\s+answers?|write\s+(?:a\s+)?(?:poem|song|story|joke)|stock\s+tips?|crypto(?:currency)?\s+trading|capital\s+of)\b/iu,
  /(?:কোড|স্ক্রিপ্ট|সোর্স\s*কোড).{0,32}(?:লিখ|তৈরি|দাও|দেখাও)|(?:সিস্টেম\s*প্রম্পট|গোপন\s*নির্দেশ|পাসওয়ার্ড|সিক্রেট|এপিআই\s*কি|ডাটাবেস\s*ডাম্প|ডেটাবেস\s*ডাম্প)/u,
];

const emailPattern = /(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}(?![\w.-])/g;
const phonePattern = /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g;
const secretPattern = /\b(?:api[_ -]?key|access[_ -]?token|secret|password|connection\s+string)\b\s*[:=]\s*\S+/giu;

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function restrictedChatReply(value: string, locale: ChatLocale): string | null {
  if (!restrictedRequests.some((pattern) => pattern.test(value))) return null;
  return locale === "bn"
    ? "দুঃখিত, আমি শুধু রিভার্স ক্লাউডের সহকারী। আমি এ বিষয়ে সাহায্য করতে পারি না। আমি আমাদের সেবা, প্রজেক্টের আনুমানিক বাজেট বা মিটিং বুকিংয়ে সাহায্য করতে পারি।"
    : "Sorry, I’m only the Reverse Cloud assistant, so I can’t help with that. I can help with our services, project estimates, or meeting bookings.";
}

export function directChatReply(value: string, locale: ChatLocale): string | null {
  const text = normalize(value);
  if (greetings[locale].has(text)) {
    return locale === "bn"
      ? "হ্যালো! রিভার্স ক্লাউডে স্বাগতম। আমি আমাদের সেবা, প্রজেক্টের বাজেট, মিটিং বুকিং বা আপনার প্রজেক্টের পরিকল্পনা নিয়ে সাহায্য করতে পারি। আপনি কী নিয়ে কাজ করছেন?"
      : "Hello! Welcome to Reverse Cloud. I can help with our services, project estimates, meeting bookings, or planning your project. What are you working on?";
  }
  if (thanks[locale].has(text)) {
    return locale === "bn"
      ? "স্বাগতম! আর কিছু জানতে বা পরিকল্পনা করতে চাইলে বলুন।"
      : "You’re welcome! Tell me if you’d like help with anything else.";
  }
  if (goodbyes[locale].has(text)) {
    return locale === "bn"
      ? "বিদায়! প্রয়োজন হলে যেকোনো সময় আবার যোগাযোগ করুন।"
      : "Goodbye! Come back anytime if you need help with your project.";
  }
  return null;
}

export function isBookingRequest(value: string) {
  const text = normalize(value);
  return /\b(?:book|booking|schedule|appointment|consultation|meeting|call)\b/u.test(text)
    || /(?:বুক|বুকিং|সময়|সময়|মিটিং|পরামর্শ|কল)/u.test(text);
}

export function isCancellationRequest(value: string) {
  const text = normalize(value);
  return (/\b(?:cancel|cancellation)\b/u.test(text)
    && /\b(?:booking|appointment|meeting|call|schedule)\b/u.test(text))
    || /(?:বুকিং|অ্যাপয়েন্টমেন্ট|মিটিং|কল).{0,20}বাতিল|বাতিল.{0,20}(?:বুকিং|অ্যাপয়েন্টমেন্ট|মিটিং|কল)/u.test(text);
}

export function safeChatFallback(locale: ChatLocale) {
  return locale === "bn"
    ? "আমি এই প্রশ্নের নির্ভরযোগ্য উত্তর এখনই যাচাই করতে পারিনি। তবে আমাদের সেবা, প্রজেক্টের আনুমানিক বাজেট বা মিটিং বুকিংয়ে সাহায্য করতে পারি। চাইলে আমি টিমের কারও সঙ্গেও যুক্ত করে দেব।"
    : "I couldn’t verify a reliable answer to that yet. I can still help with our services, a project estimate, or booking a meeting—and I can connect you with the team if needed.";
}

export function ensureUsefulChatReply(value: string, locale: ChatLocale) {
  let reply = value
    .replace(secretPattern, "[REDACTED_SECRET]")
    .replace(emailPattern, "[REDACTED_EMAIL]")
    .replace(phonePattern, "[REDACTED_PHONE]")
    .replace(/\s+/g, " ")
    .trim();
  if (reply && !/[.!?।]$/u.test(reply)) {
    const lastCompleteSentence = Math.max(
      reply.lastIndexOf("."),
      reply.lastIndexOf("!"),
      reply.lastIndexOf("?"),
      reply.lastIndexOf("।"),
    );
    if (lastCompleteSentence >= 20) reply = reply.slice(0, lastCompleteSentence + 1);
  }
  if (!reply || /(.)\1{7,}/u.test(reply)) return safeChatFallback(locale);
  if (/^(?:i\s+)?(?:do\s+not|don['’]?t)\s+know|^no\s+idea|^not\s+sure/i.test(reply)) {
    return safeChatFallback(locale);
  }
  if (/^(?:আমি\s+)?জানি\s+না|^নিশ্চিত\s+নই/u.test(reply)) return safeChatFallback(locale);
  const words = normalize(reply).split(" ").filter(Boolean);
  if (words.length >= 6) {
    const counts = new Map<string, number>();
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    if (Math.max(...counts.values()) / words.length >= 0.6) return safeChatFallback(locale);
  }
  return reply;
}
