export type ChatLocale = "en" | "bn";

const greetings = {
  en: new Set(["hi", "hello", "hey", "hi there", "hello there", "good morning", "good afternoon", "good evening"]),
  bn: new Set(["হাই", "হ্যালো", "হেলো", "সালাম", "আসসালামু আলাইকুম", "শুভ সকাল", "শুভ সন্ধ্যা"]),
};

const thanks = {
  en: new Set(["thanks", "thank you", "thank you very much", "thanks a lot"]),
  bn: new Set(["ধন্যবাদ", "অনেক ধন্যবাদ"]),
};

const goodbyes = {
  en: new Set(["bye", "goodbye", "see you", "talk later"]),
  bn: new Set(["বিদায়", "আবার দেখা হবে", "পরে কথা হবে"]),
};

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export function safeChatFallback(locale: ChatLocale) {
  return locale === "bn"
    ? "আমি এই প্রশ্নের নির্ভরযোগ্য উত্তর এখনই যাচাই করতে পারিনি। তবে আমাদের সেবা, প্রজেক্টের আনুমানিক বাজেট বা মিটিং বুকিংয়ে সাহায্য করতে পারি। চাইলে আমি টিমের কারও সঙ্গেও যুক্ত করে দেব।"
    : "I couldn’t verify a reliable answer to that yet. I can still help with our services, a project estimate, or booking a meeting—and I can connect you with the team if needed.";
}

export function ensureUsefulChatReply(value: string, locale: ChatLocale) {
  const reply = value.replace(/\s+/g, " ").trim();
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
