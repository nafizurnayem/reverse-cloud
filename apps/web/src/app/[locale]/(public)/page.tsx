import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { ShowreelStage } from "@/components/home/showreel-stage";
import { StudioMetrics } from "@/components/home/studio-metrics";
import { StudioCaseStudies } from "@/components/home/studio-case-studies";
import { getPublishedServices } from "@/lib/services-server";
import { getApprovedReviews } from "@/lib/reviews-catalog";
import { StudioReviewCarousel } from "@/components/home/studio-review-carousel";
import "./studio-home.css";

type Props = {
  params?: Promise<{ locale: string }>;
};

const projects = [
  {
    name: "k-ID",
    image: "/images/stitch/kid-case-study.jpg",
    alt: { en: "k-ID identity verification dashboard mockup", bn: "k-ID পরিচয় যাচাইকরণ ড্যাশবোর্ডের মকআপ" },
    outcome: { en: "Privacy-first identity and consent for families.", bn: "পরিবারের জন্য গোপনীয়তাকেন্দ্রিক পরিচয় ও সম্মতি।" },
  },
  {
    name: "Valara",
    image: "/images/stitch/valara-case-study.jpg",
    alt: { en: "Valara portfolio and risk analytics dashboard mockup", bn: "Valara পোর্টফোলিও ও ঝুঁকি বিশ্লেষণ ড্যাশবোর্ডের মকআপ" },
    outcome: { en: "A clearer view of portfolios and risk.", bn: "পোর্টফোলিও ও ঝুঁকি বোঝার আরও সহজ উপায়।" },
  },
];

const clients = ["k-ID", "ROOT", "KCRW", "CASTABILITY", "INTERRA", "MITSUBISHI"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale = "en" } = (await params) ?? {};
  if (!hasLocale(routing.locales, locale)) notFound();
  return {
    title: locale === "bn" ? "Reverse Cloud — AI পণ্য দল" : "Reverse Cloud — An AI Product Team That Thinks Beyond The Build",
    description: locale === "bn"
      ? "পণ্যের কৌশল, ডিজাইন ও প্রকৌশল। ধারণা থেকে লঞ্চ পর্যন্ত।"
      : "Product strategy, design, and engineering. From first idea to launch.",
    alternates: { canonical: getPathname({ href: "/", locale }) },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale = "en" } = (await params) ?? {};
  const language = locale === "bn" ? "bn" : "en";
  const isBn = language === "bn";
  const [services, reviews] = await Promise.all([
    getPublishedServices(),
    getApprovedReviews(locale, false),
  ]);

  return (
    <div className="studio-home">
      <ShowreelStage locale={locale} fullMotion />

      <section className="studio-proof" id="studio-proof" aria-labelledby="studio-proof-heading">
        <div className="studio-container">
          <h2 id="studio-proof-heading">
            {isBn
              ? "আমাদের অভিজ্ঞ দল আপনার দলের সঙ্গে কাজ করে দ্রুত উদ্ভাবন এগিয়ে নেয়।"
              : "Our senior, forward-deployed pods embed within your team to drive innovation at speed."}
          </h2>
          <StudioMetrics locale={locale} fullMotion />
        </div>
      </section>

      <section className="studio-work" id="work" aria-labelledby="studio-work-heading">
        <div className="studio-container studio-work-grid">
          <div className="studio-work-intro">
            <h2 id="studio-work-heading">{isBn ? "কেস স্টাডি" : "Case Studies"}</h2>
            <p>
              {isBn
                ? "জটিল সমস্যা থেকে সহজে ব্যবহারযোগ্য ডিজিটাল পণ্য। আমাদের নির্বাচিত কাজ দেখুন।"
                : "A closer look at how we turn complex problems into products people can use."}
            </p>
            <Link href="/portfolio" className="studio-work-link">{isBn ? "সব কাজ দেখুন" : "View All Work"}</Link>
          </div>
          <StudioCaseStudies projects={projects} language={language} />
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="studio-reviews" aria-labelledby="studio-reviews-heading">
          <div className="studio-container">
            <h2 id="studio-reviews-heading">
              {isBn ? "দূরদর্শী দলগুলোর আস্থায়" : <>Trusted by forward-thinking<br className="hidden sm:block" /> teams<span className="studio-reviews-period">.</span></>}
            </h2>
            <p className="studio-reviews-intro">
              {isBn
                ? "প্রকৌশল নেতা, প্রধান স্থপতি এবং উদ্যোগের প্রতিষ্ঠাতারা কীভাবে গুরুত্বপূর্ণ প্রযুক্তিগত অগ্রগতিতে Reverse Cloud-এর সঙ্গে কাজ করেন, তা জানুন।"
                : "Hear how engineering leaders, principal architects, and venture founders partner with Reverse Cloud to accelerate mission-critical rollouts."}
            </p>
            <StudioReviewCarousel reviews={reviews} locale={locale} />
          </div>
        </section>
      )}

      <section className="studio-services" id="services" aria-labelledby="studio-services-heading">
        <div className="studio-container">
          <p className="studio-services-eyebrow">{isBn ? "আমরা যা করি" : "WHAT WE DO"}</p>
          <h2 id="studio-services-heading">{isBn ? "আইডিয়া থেকে বাস্তব প্রভাব।" : "From bold ideas to real-world impact."}</h2>
          <div className="studio-services-list">
            {services.map((service, index) => (
              <Link href={`/services/${service.slug}`} key={service.slug} className="studio-service-row">
                <span className="studio-service-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="studio-service-copy">
                  <strong>{isBn ? service.name_bn : service.name_en}</strong>
                  <span>{isBn ? service.summary_bn : service.summary_en}</span>
                </span>
                <span className="studio-service-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="studio-clients" aria-label={isBn ? "ক্লায়েন্ট ও অংশীদার" : "Clients and partners"}>
        <div className="studio-wordmark-track">
          {[0, 1].map((copy) => (
            <ul className="studio-wordmarks" key={copy} aria-hidden={copy === 1}>
              {clients.map((name) => <li key={name}>{name}</li>)}
            </ul>
          ))}
        </div>
      </section>
      <section className="studio-booking" aria-labelledby="studio-booking-heading">
        <div className="studio-booking-inner">
          <h2 id="studio-booking-heading">{isBn ? "চলুন কথা বলি" : "Let’s Talk"}</h2>
          <Link href="/schedule" className="studio-booking-link">
            {isBn ? "কল বুক করুন" : "Book a Call"}
            <ArrowUpRight aria-hidden="true" size={40} strokeWidth={1.75} />
          </Link>
        </div>
      </section>
    </div>
  );
}
