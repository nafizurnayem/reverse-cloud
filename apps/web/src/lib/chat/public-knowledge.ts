import { BLOG_CATALOG } from "@/lib/blog-catalog";
import { PORTFOLIO_CATALOG } from "@/lib/portfolio-catalog";
import { SERVICES_CATALOG, type ServiceDetailItem } from "@/lib/services-catalog";

type Locale = "en" | "bn";
type Document = { title: string; content: string; path: string };
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
  const asksForAll = /\b(?:all|every|full|complete)\b.{0,24}\bservices?\b/u.test(normalized)
    || /(?:সব|সকল|সম্পূর্ণ).{0,16}(?:সেবা|সার্ভিস)/u.test(normalized);
  if (asksForAll) return true;

  // A named service should keep its own details and booking flow.
  const namesSpecificService = SERVICES_CATALOG.some((service) =>
    normalized.includes(normalizeServiceQuery(service.name_en))
    || normalized.includes(normalizeServiceQuery(service.name_bn))
    || normalized.includes(service.slug.replaceAll("-", " ")),
  );
  if (namesSpecificService) return false;

  return /^(?:(?:please|your|our|available)\s+)*services?(?:\s+please)?$/u.test(normalized)
    || /\b(?:what|which|list|show|tell).{0,36}\bservices?\b|\bservices?\b.{0,24}\b(?:offer|provide|available)\b|\bwhat do you do\b/u.test(normalized)
    || /\b(?:want|need|book)\b.{0,24}\b(?:a\s+)?services?\b/u.test(normalized)
    || /^(?:(?:আপনাদের|আপনার)\s*)?(?:সেবা(?:গুলো|সমূহ)?|সার্ভিস(?:গুলো|সমূহ)?)$/u.test(normalized)
    || /(?:কী|কি|কোন|তালিকা|সম্পর্কে).{0,28}(?:সেবা|সার্ভিস)|(?:সেবা|সার্ভিস).{0,28}(?:কী|কি|কোন|চাই)/u.test(normalized);
}

export function directPublicKnowledgeReply(
  query: string,
  locale: Locale,
  services: Pick<ServiceDetailItem, "name_en" | "name_bn" | "sort_order">[] = SERVICES_CATALOG,
): string | null {
  if (!isServiceListRequest(query)) return null;

  const names = services
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((service) => `• ${locale === "bn" ? service.name_bn : service.name_en}`);
  return locale === "bn"
    ? `আমাদের সেবাগুলো\n\n${names.join("\n")}\n\nআপনি কোন সেবাটি বুক করতে চান?`
    : `Our services\n\n${names.join("\n")}\n\nWhich service would you like to book?`;
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
