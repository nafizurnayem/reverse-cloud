import { BLOG_CATALOG } from "@/lib/blog-catalog";
import { PORTFOLIO_CATALOG } from "@/lib/portfolio-catalog";
import { SERVICES_CATALOG } from "@/lib/services-catalog";

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

export function directPublicKnowledgeReply(query: string, locale: Locale): string | null {
  const normalized = query.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const asksForServices = locale === "bn"
    ? /(?:কী|কি|কোন|তালিকা|সম্পর্কে).{0,28}(?:সেবা|সার্ভিস)|(?:সেবা|সার্ভিস).{0,28}(?:কী|কি|কোন)/u.test(normalized)
    : /\b(?:what|which|list|show|tell).{0,36}\bservices?\b|\bservices?\b.{0,24}\b(?:offer|provide|available)\b|\bwhat do you do\b/u.test(normalized);
  if (!asksForServices) return null;

  const names = SERVICES_CATALOG
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((service) => locale === "bn" ? service.name_bn : service.name_en);
  return locale === "bn"
    ? `আমাদের সেবাগুলো হলো: ${names.join("、")}। বিস্তারিত জানতে /services দেখুন, অথবা আপনার প্রজেক্ট সম্পর্কে বললে আমি উপযুক্ত সেবা বেছে দিতে পারি।`
    : `Our services are: ${names.join(", ")}. See /services for details, or tell me about your project and I can suggest the best fit.`;
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
