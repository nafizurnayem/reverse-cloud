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
      const path = `/${locale}/services/${service.slug}`;
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
          ].join("\n").slice(0, 500),
        },
        ...faqs.map((faq) => ({ title: faq.question, content: faq.answer, path })),
      ];
    }),
    ...PORTFOLIO_CATALOG.filter((item) => item.is_published).map((item) => ({
      title: isBn ? item.title_bn : item.title_en,
      content: [isBn ? item.summary_bn : item.summary_en, isBn ? item.result_bn : item.result_en].join("\n"),
      path: `/${locale}/portfolio/${item.slug}`,
    })),
    ...BLOG_CATALOG.filter((post) => post.status === "published").map((post) => ({
      title: isBn ? post.title_bn : post.title_en,
      content: [isBn ? post.excerpt_bn : post.excerpt_en, isBn ? post.body_bn : post.body_en].join("\n").slice(0, 500),
      path: `/${locale}/blog/${post.slug}`,
    })),
  ];
}

function terms(value: string) {
  return [...new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((term) => term.length > 2 && !stopwords.has(term)))];
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
