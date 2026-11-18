import { BLOG_CATALOG } from "@/lib/blog-catalog";
import { PORTFOLIO_CATALOG } from "@/lib/portfolio-catalog";
import { SERVICES_CATALOG, type ServiceDetailItem } from "@/lib/services-catalog";

type Locale = "en" | "bn";
type Document = { title: string; content: string; path: string };
type ChatMessage = { role: "user" | "assistant"; content: string };
const stopwords = new Set(["what", "when", "where", "which", "about", "answer", "from", "the", "for", "your", "you", "our", "does", "are", "can", "how", "with", "this", "that"]);

function documents(locale: Locale): Document[] {
  const isBn = locale === "bn";
  return [
    ...SERVICES_CATALOG.flatMap((service) => {
      const path = `/services/${service.slug}`;
      const title = isBn ? service.name_bn : service.name_en;
      const faqs = isBn ? service.faqs_bn : service.faqs_en;
      return [
        {
          title,
          path,
          content: [
            isBn ? service.summary_bn : service.summary_en,
            service.starting_from_usd === null
              ? "Price: custom quote"
              : `Starting price: USD ${service.starting_from_usd}`,
            isBn ? service.body_bn : service.body_en,
          ].join("\n").slice(0, 320),
        },
        ...faqs.map((faq) => ({ title: faq.question, content: faq.answer, path })),
      ];
    }),
    ...PORTFOLIO_CATALOG.filter((item) => item.is_published).map((item) => ({
      title: isBn ? item.title_bn : item.title_en,
      content: [isBn ? item.summary_bn : item.summary_en, isBn ? item.result_bn : item.result_en].join("\n"),
      path: `/portfolio/${item.slug}`,
    })),
    ...BLOG_CATALOG.filter((post) => post.status === "published").map((post) => ({
      title: isBn ? post.title_bn : post.title_en,
      content: [isBn ? post.excerpt_bn : post.excerpt_en, isBn ? post.body_bn : post.body_en].join("\n").slice(0, 320),
      path: `/blog/${post.slug}`,
    })),
  ];
}

function terms(value: string) {
  return [...new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((term) => term.length > 2 && !stopwords.has(term)))];
}

function normalizeServiceQuery(query: string) {
  return query.toLocaleLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isServiceListRequest(query: string): boolean {
  const normalized = normalizeServiceQuery(query);
  const asksForAll = /\b(?:all|every|full|complete)\b.{0,24}\bservic\w*/u.test(normalized)
    || /(?:সব|সকল|সম্পূর্ণ).{0,16}(?:সেবা|সার্ভিস)/u.test(normalized);
  if (asksForAll) return true;

  // A named service should keep its own details and booking flow.
  const namesSpecificService = SERVICES_CATALOG.some((service) =>
    normalized.includes(normalizeServiceQuery(service.name_en))
    || normalized.includes(normalizeServiceQuery(service.name_bn))
    || normalized.includes(service.slug.replaceAll("-", " ")),
  );
  if (namesSpecificService) return false;

  return /^(?:(?:please|your|our|available|the)\s+)*servic\w*(?:\s+please)?$/u.test(normalized)
    || /\b(?:what|which|list|show|tell|know|see|learn|check|details?|info)\b.{0,36}\bservic\w*/u.test(normalized)
    || /\b(?:want|need|book)\b.{0,36}\bservic\w*/u.test(normalized)
    || /\bservic\w*.{0,24}\b(?:offer|provide|available|details?|list)\b|\bwhat do you do\b/u.test(normalized)
    || /^(?:(?:আপনাদের|আপনার)\s*)?(?:সেবা(?:গুলো|সমূহ)?|সার্ভিস(?:গুলো|সমূহ)?)$/u.test(normalized)
    || /(?:কী|কি|কোন|তালিকা|সম্পর্কে|জানতে|দেখতে).{0,28}(?:সেবা|সার্ভিস)|(?:সেবা|সার্ভিস).{0,28}(?:কী|কি|কোন|চাই|জানতে|দেখতে)/u.test(normalized);
}

export function isServiceDiscoveryRequest(query: string): boolean {
  const normalized = normalizeServiceQuery(query);
  return /\b(?:help|assist|guide|recommend|suggest).{0,24}\b(?:find(?:ing)?|choos(?:e|ing)|select(?:ing)?|pick(?:ing)?).{0,24}\bservices?\b/u.test(normalized)
    || /\b(?:find(?:ing)?|choos(?:e|ing)|select(?:ing)?|pick(?:ing)?).{0,24}\b(?:a\s+)?services?\b/u.test(normalized)
    || /\bwhich\s+service\s+(?:is\s+)?(?:right|best|suitable)\b/u.test(normalized)
    || /(?:সেবা|সার্ভিস).{0,20}(?:খুঁজে|বেছে|নির্বাচন|উপযুক্ত)/u.test(normalized);
}

export function directServiceDiscoveryReply(locale: Locale): string {
  return locale === "bn"
    ? "অবশ্যই—আপনার কোন সেবাটি প্রয়োজন? আপনি কী তৈরি বা উন্নত করতে চান, আপনার প্রধান লক্ষ্য এবং প্রয়োজনীয় ইন্টিগ্রেশন সম্পর্কে সংক্ষেপে বলুন। আপনার তথ্যের সঙ্গে মিলিয়ে আমাদের সবচেয়ে উপযুক্ত সেবাটি এবং তার বিস্তারিত জানাব।"
    : "Sure—which service do you need? Tell me what you want to build or improve, your main goal, and any integrations you need. I’ll match your needs to the most relevant service and share its details.";
}

function serviceScore(query: string, service: ServiceDetailItem, locale: Locale) {
  const queryTerms = terms(query);
  const localizedText = [
    service.name_en,
    service.name_bn,
    service.slug.replaceAll("-", " "),
    service.summary_en,
    service.summary_bn,
    service.body_en,
    service.body_bn,
    ...service.deliverables_en,
    ...service.deliverables_bn,
    ...service.tech_stack,
    ...service.faqs_en.flatMap((faq) => [faq.question, faq.answer]),
    ...service.faqs_bn.flatMap((faq) => [faq.question, faq.answer]),
  ].join(" ").toLocaleLowerCase();
  const title = (locale === "bn" ? service.name_bn : service.name_en).toLocaleLowerCase();
  return queryTerms.reduce(
    (score, term) => score + (title.includes(term) ? 5 : 0) + (localizedText.includes(term) ? 1 : 0),
    0,
  );
}

export function isServiceDiscoveryFollowUp(messages: ChatMessage[]): boolean {
  const prompt = messages.at(-2);
  return prompt?.role === "assistant" && (
    prompt.content.includes("most relevant service")
    || prompt.content.includes("উপযুক্ত সেবাটি")
  );
}

export function relevantServiceReply(
  query: string,
  locale: Locale,
  services: ServiceDetailItem[] = SERVICES_CATALOG,
): string {
  const [match, score] = services
    .map((service) => [service, serviceScore(query, service, locale)] as const)
    .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  if (!match || score < 2) {
    return locale === "bn"
      ? "আপনার প্রয়োজনটি আরও একটু বিস্তারিত বলুন—যেমন কী তৈরি করতে চান, কোন সমস্যা সমাধান করতে চান বা কোন সিস্টেমে ইন্টিগ্রেশন দরকার। তাহলে আমি সঠিক সেবাটি বেছে দিতে পারব।"
      : "Could you share a little more about what you want to build, the problem you want to solve, or the systems you need to integrate? Then I can match you with the right service.";
  }

  const name = locale === "bn" ? match.name_bn : match.name_en;
  const summary = locale === "bn" ? match.summary_bn : match.summary_en;
  const body = locale === "bn" ? match.body_bn : match.body_en;
  return locale === "bn"
    ? `আপনার প্রয়োজনের জন্য **${name}** সবচেয়ে উপযুক্ত মনে হচ্ছে।\n\n${summary}\n\n${body}\n\nবিস্তারিত: /services/${match.slug}\n\nচাইলে আমি এই সেবার জন্য একটি আনুমানিক হিসাব বা ডিসকভারি কলের ব্যবস্থা করতে পারি।`
    : `Based on your needs, **${name}** looks like the best fit.\n\n${summary}\n\n${body}\n\nDetails: /services/${match.slug}\n\nI can also prepare an estimate or arrange a discovery call for this service.`;
}

export function directPublicKnowledgeReply(
  query: string,
  locale: Locale,
  services: Partial<ServiceDetailItem>[] = SERVICES_CATALOG,
): string | null {
  if (!isServiceListRequest(query)) return null;

  const isBn = locale === "bn";
  const items = services
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((service) => {
      const name = isBn ? (service.name_bn || service.name_en) : (service.name_en || service.name_bn);
      const summary = isBn ? (service.summary_bn || service.summary_en) : (service.summary_en || service.summary_bn);
      const slug = service.slug || "";
      const link = slug ? `[${name}](/services/${slug}?openChat=true&bookService=${slug})` : name;
      const priceText = service.starting_from_usd
        ? (isBn ? ` (শুরু: $${service.starting_from_usd.toLocaleString("en-US")})` : ` (Starting from $${service.starting_from_usd.toLocaleString("en-US")})`)
        : "";
      const header = `• ${link}${priceText}`;
      return summary ? `${header}\n  ${summary}` : header;
    });

  return isBn
    ? `আমাদের সেবাগুলো\n\n${items.join("\n\n")}\n\nআপনি কোন সেবাটি বুক করতে চান? বিস্তারিত দেখতে যেকোনো সেবায় ক্লিক করুন, অথবা বুকিং করতে সেবার নামটি জানান।`
    : `Our services\n\n${items.join("\n\n")}\n\nWhich service would you like to book? Click any service above to view its details, or reply with the service name to schedule a discovery call.`;
}

export function retrievePublicKnowledge(query: string, locale: Locale): string {
  const queryTerms = terms(query);
  if (queryTerms.length === 0) return "";

  return documents(locale)
    .map((document) => {
      const title = document.title.toLocaleLowerCase();
      const content = document.content.toLocaleLowerCase();
      const score = queryTerms.reduce(
        (sum, term) => sum + (title.includes(term) ? 4 : 0) + (content.includes(term) ? 1 : 0),
        0,
      );
      return { document, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1)
    .map(({ document }) => `${document.title} (${document.path})\n${document.content}`)
    .join("\n\n");
}
