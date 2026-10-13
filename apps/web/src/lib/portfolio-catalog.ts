import { getPublicSupabaseEnv } from "./supabase/env";
import { createClient } from "./supabase/server";

export interface PortfolioDetailItem {
  id?: string;
  slug: string;
  title_en: string;
  title_bn: string;
  summary_en: string;
  summary_bn: string;
  challenge_en: string;
  challenge_bn: string;
  solution_en: string;
  solution_bn: string;
  result_en: string;
  result_bn: string;
  cover_path?: string | null;
  live_url?: string | null;
  tech_stack: string[];
  public_client_name?: string | null;
  client_consent: boolean;
  completed_on?: string | null;
  is_featured: boolean;
  is_published: boolean;
  category: "web" | "ai" | "saas" | "automation";
  metrics?: { label_en: string; label_bn: string; value: string }[];
}

interface DbPortfolioRow {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  summary_en: string | null;
  summary_bn: string | null;
  challenge_en: string | null;
  challenge_bn: string | null;
  solution_en: string | null;
  solution_bn: string | null;
  result_en: string | null;
  result_bn: string | null;
  cover_path: string | null;
  live_url: string | null;
  tech_stack: string[] | null;
  public_client_name: string | null;
  client_consent: boolean;
  completed_on: string | null;
  is_featured: boolean;
  is_published: boolean;
}

export const PORTFOLIO_CATALOG: PortfolioDetailItem[] = [
  {
    slug: "cloud-logistics-ai",
    title_en: "Autonomous Logistics Ingestion & Routing Engine",
    title_bn: "স্বয়ংক্রিয় লজিস্টিকস ইনজেশন ও রাউটিং ইঞ্জিন",
    summary_en:
      "Enterprise supply chain workflow parsing 10,000+ daily freight manifests with multimodal AI and automated warehouse routing.",
    summary_bn:
      "মাল্টিমোডাল এআই ও ওয়্যারহাউজ রাউটিংয়ের মাধ্যমে দৈনিক ১০,০০০+ ফ্রেইট ম্যানিফেস্ট প্রসেস করার এন্টারপ্রাইজ সাপ্লাই চেইন প্ল্যাটফর্ম।",
    challenge_en:
      "Freight operators spent 25+ manual hours daily transcribing unstructured PDF shipping bills, causing clearance delays and human transcription errors across three shipping hubs.",
    challenge_bn:
      "প্রতিদিন আনস্ট্রাকচার্ড পিডিএফ শিপিং বিল এন্ট্রির জন্য ২৫ ঘণ্টার বেশি সময় ব্যয় হতো, যার ফলে তিনটি বন্দর ও ওয়্যারহাউজে পণ্য খালাসে বিলম্ব ও ভুল হতো।",
    solution_en:
      "Engineered an asynchronous processing pipeline using Next.js App Router, Python 3.12, PydanticAI, and Celery queues. Integrated OCR extraction with strict schema validation and automated exception routing.",
    solution_bn:
      "Next.js অ্যাপ রাউটার, পাইথন ৩.১২, PydanticAI ও Celery কিউ ব্যবহার করে একটি নিরাপদ অ্যাসিঙ্ক্রোনাস প্রসেসিং পাইপলাইন তৈরি করা হয়েছে যা সরাসরি ব্যতিক্রমী বিলগুলোকে স্বয়ংক্রিয়ভাবে চিহ্নিত করে।",
    result_en:
      "Reduced invoice ingestion turnaround from 4 hours to 45 seconds while cutting human error rates to under 0.05% across 250,000 processed shipments.",
    result_bn:
      "বিল প্রসেসিং সময় ৪ ঘণ্টা থেকে মাত্র ৪৫ সেকেন্ডে নেমে এসেছে এবং আড়াই লক্ষাধিক শিপমেন্টের ক্ষেত্রে ভুলের হার ০.০৫%-এর নিচে নামিয়ে আনা সম্ভব হয়েছে।",
    tech_stack: ["Next.js 16", "Python", "FastAPI", "PostgreSQL", "PydanticAI", "Redis", "Docker"],
    public_client_name: "TransGlobal Freight Solutions",
    client_consent: true,
    completed_on: "2026-08-15",
    is_featured: true,
    is_published: true,
    category: "ai",
    metrics: [
      { label_en: "Processing Time", label_bn: "প্রসেসিং সময়", value: "-98%" },
      { label_en: "Daily Manifests", label_bn: "দৈনিক ম্যানিফেস্ট", value: "10k+" },
      { label_en: "Extraction Accuracy", label_bn: "নিখুঁত ফলাফল", value: "99.95%" },
    ],
  },
  {
    slug: "fintech-payment-portal",
    title_en: "Institutional Cross-Border Payment Infrastructure",
    title_bn: "আন্তর্জাতিক ক্রস-বর্ডার পেমেন্ট প্ল্যাটফর্ম",
    summary_en:
      "High-throughput multi-currency settlement gateway with Postgres Row Level Security, instant ledger reconciliation, and strict audit logging.",
    summary_bn:
      "পোস্টগ্রেস রো লেভেল সিকিউরিটি, তাৎক্ষণিক লেজার ব্যালেন্স ও অডিট লগ সহ বহু-মুদ্রা ক্রস-বর্ডার সেটেলমেন্ট গেটওয়ে।",
    challenge_en:
      "A fast-growing fintech needed to support USD-to-BDT business remittances with zero-loss transaction guarantees, banking compliance, and microsecond ledger audits.",
    challenge_bn:
      "একটি দ্রুত বর্ধনশীল ফিনটেক কোম্পানির জন্য শূন্য-লেনদেন-ক্ষতির নিশ্চয়তা, ব্যাংকিং কমপ্লায়েন্স এবং মাইক্রোসেকেন্ড লেজার অডিট সহ ইউএসডি-থেকে-বিডিটি রেমিট্যান্স প্ল্যাটফর্ম প্রয়োজন ছিল।",
    solution_en:
      "Built a secure web application leveraging Next.js, Supabase PostgreSQL with double-entry accounting constraints, HMAC webhook validation, and automated Telegram/email monitoring alerts.",
    solution_bn:
      "ডাবল-এন্ট্রি বুককিপিং কনস্ট্রেইন্ট, HMAC ওয়েবহুক ভ্যালিডেশন এবং স্বয়ংক্রিয় নোটিফিকেশন অ্যালার্ট সহ Next.js এবং Supabase আর্কিটেকচারে প্ল্যাটফর্মটি নির্মাণ করা হয়েছে।",
    result_en:
      "Processed over $14M in institutional remittances in the first 6 months with zero financial discrepancies and passed third-party SOC-2 readiness reviews.",
    result_bn:
      "প্রথম ৬ মাসে শূন্য আর্থিক গরমিল সহ ১৪ মিলিয়ন মার্কিন ডলারের বেশি লেনদেন সফলভাবে সম্পন্ন এবং তৃতীয় পক্ষের নিরাপত্তা অডিটে উত্তীর্ণ।",
    tech_stack: ["Next.js", "React 19", "Supabase", "PostgreSQL RLS", "TypeScript", "Tailwind CSS"],
    public_client_name: "Apex Currency Gateway",
    client_consent: true,
    completed_on: "2026-06-20",
    is_featured: true,
    is_published: true,
    category: "web",
    metrics: [
      { label_en: "Settled Volume", label_bn: "লেনদেন ভলিউম", value: "$14M+" },
      { label_en: "Discrepancy Rate", label_bn: "গরমিল হার", value: "0.00%" },
      { label_en: "Uptime SLA", label_bn: "আপটাইম এসএলএ", value: "99.99%" },
    ],
  },
  {
    slug: "healthtech-telemedicine-saas",
    title_en: "Multi-Clinic Telehealth & Scheduling SaaS",
    title_bn: "মাল্টি-ক্লিনিক টেলিমেডিসিন ও শিডিউলিং স্যাস",
    summary_en:
      "HIPAA-conscious multi-tenant SaaS for specialized healthcare clinics featuring video consultations, prescription dispatch, and billing.",
    summary_bn:
      "ভিডিও কনসালটেশন, প্রেসক্রিপশন পাঠানো ও বিলিং সমন্বিত বিশেষায়িত ক্লিনিকসমূহের জন্য মাল্টি-টেন্যান্ট টেলিমেডিসিন SaaS।",
    challenge_en:
      "Private medical practices struggled with fragmented scheduling software that lacked patient record localization and reliable video consultation integrations.",
    challenge_bn:
      "ব্যক্তিগত ক্লিনিকগুলো বিভিন্ন বিচ্ছিন্ন সফটওয়্যার ব্যবহার করত যা বাংলা ও ইংরেজি রোগীর তথ্য এবং নিরবচ্ছিন্ন ভিডিও কনসালটেশন একত্রিত করতে ব্যর্থ হচ্ছিল।",
    solution_en:
      "Engineered an all-in-one multi-tenant SaaS platform featuring isolated tenant database schemas, WebRTC end-to-end encrypted consultations, and patient SMS reminders.",
    solution_bn:
      "আইসোলেটেড টেন্যান্ট ডেটাবেস, এন্ড-টু-এন্ড এনক্রিপ্টেড WebRTC ভিডিও কনসালটেশন এবং রোগীর স্বয়ংক্রিয় SMS অ্যালার্ট সহ পূর্ণাঙ্গ SaaS আর্কিটেকচার গড়ে তোলা হয়েছে।",
    result_en:
      "Onboarded 42 independent healthcare clinics, reducing appointment no-show rates by 48% and handling 85,000 patient consultations annually.",
    result_bn:
      "৪২টি ক্লিনিক অনবোর্ড করে রোগীর অনুপস্থিতির হার ৪৮% কমানো হয়েছে এবং বছরে ৮৫,০০০ রোগীর চিকিৎসা সেবা প্রদান করা হচ্ছে।",
    tech_stack: ["Next.js", "TypeScript", "Tailwind CSS", "WebRTC", "PostgreSQL", "Stripe API"],
    public_client_name: "NovaHealth Network",
    client_consent: true,
    completed_on: "2026-04-10",
    is_featured: false,
    is_published: true,
    category: "saas",
    metrics: [
      { label_en: "Clinics Onboarded", label_bn: "যুক্ত ক্লিনিক", value: "42+" },
      { label_en: "No-Show Reduction", label_bn: "অনুপস্থিতি হ্রাস", value: "48%" },
      { label_en: "Patient Consults", label_bn: "চিকিৎসা সেশন", value: "85k/yr" },
    ],
  },
  {
    slug: "autonomous-crawler-engine",
    title_en: "Distributed High-Volume E-Commerce Intelligence Crawler",
    title_bn: "উচ্চগতির ই-কমার্স ইন্টেলিজেন্স ও প্রাইস ক্রলার",
    summary_en:
      "Resilient Python scraper monitoring 2M+ product pricing changes daily with anti-ban rotating proxies and automated market alerts.",
    summary_bn:
      "অ্যান্টি-ব্যান প্রক্সি ও স্বয়ংক্রিয় মার্কেট অ্যালার্ট সহ দৈনিক ২০ লক্ষাধিক পণ্যের মূল্য পর্যবেক্ষণকারী দ্রুতগতির পাইথন ক্রলার।",
    challenge_en:
      "An omnichannel retailer needed near-real-time competitive pricing intelligence across 15 competitor marketplaces protected by advanced bot mitigations.",
    challenge_bn:
      "একটি রিটেইলার কোম্পানির জন্য ১৫টি প্রতিদ্বন্দ্বী মার্কেটপ্লেসের জটিল বট-প্রতিরোধ ব্যবস্থা অতিক্রম করে রিয়েল-টাইমে পণ্যমূল্যের পরিবর্তন পর্যবেক্ষণ করা জরুরি ছিল।",
    solution_en:
      "Developed a distributed headless scraping fleet using Playwright, asyncpg, and FastAPI with rotating residential proxies, TLS fingerprint impersonation, and schema validation.",
    solution_bn:
      "Playwright, asyncpg ও FastAPI দিয়ে রেসিডেন্সিয়াল প্রক্সি এবং TLS ফিঙ্গারপ্রিন্ট সমন্বয়ে একটি শক্তিশালী ডিস্ট্রিবিউটেড স্ক্র্যাপিং নেটওয়ার্ক তৈরি করা হয়েছে।",
    result_en:
      "Delivered 99.4% scraping success rate across 2,000,000 daily price updates, enabling automated real-time dynamic pricing that lifted margins by 7.2%.",
    result_bn:
      "প্রতিদিন ২০ লক্ষ প্রাইস আপডেটে ৯৯.৪% নির্ভরযোগ্যতা নিশ্চিত করা হয়েছে, যা তাৎক্ষণিক ডায়নামিক প্রাইসিংয়ের মাধ্যমে প্রতিষ্ঠানের লাভ ৭.২% বৃদ্ধি করেছে।",
    tech_stack: ["Python 3.12", "Playwright", "asyncpg", "FastAPI", "ClickHouse", "Docker"],
    public_client_name: "CommercePulse Analytics",
    client_consent: true,
    completed_on: "2026-03-01",
    is_featured: false,
    is_published: true,
    category: "automation",
    metrics: [
      { label_en: "Daily Price Points", label_bn: "দৈনিক প্রাইস আপডেট", value: "2M+" },
      { label_en: "Success Rate", label_bn: "সফলতার হার", value: "99.4%" },
      { label_en: "Margin Lift", label_bn: "মুনাফা বৃদ্ধি", value: "+7.2%" },
    ],
  },
  {
    slug: "bilingual-ecommerce-platform",
    title_en: "High-Performance Bilingual Retail Platform",
    title_bn: "উচ্চগতির বহুভাষিক ই-কমার্স প্ল্যাটফর্ম",
    summary_en:
      "Bespoke headless commerce application delivering sub-second page transitions, full Bangla localization, and automated courier API dispatch.",
    summary_bn:
      "সাব-সেকেন্ড পেজ ট্রানজিশন, পূর্ণ বাংলা লোকালাইজেশন এবং কুরিয়ার এপিআই অটোমেশন সহ কাস্টম হেডলেস ই-কমার্স প্ল্যাটফর্ম।",
    challenge_en:
      "A lifestyle retail brand's legacy Shopify storefront struggled with poor mobile load times, weak Bengali script rendering, and detached local delivery courier sync.",
    challenge_bn:
      "একটি জনপ্রিয় লাইফস্টাইল ব্র্যান্ডের পূর্ববর্তী স্টোরে ধীরগতির মোবাইল স্পিড, ভাঙা বাংলা ফন্ট এবং কুরিয়ার ট্র্যাকিংয়ের অভাব ছিল।",
    solution_en:
      "Re-platformed to Next.js 16 App Router with next-intl, Noto Sans Bengali font optimization, Redis Edge caching, and automated Pathao / SteadFast courier dispatch.",
    solution_bn:
      "Next.js ১৬ অ্যাপ রাউটার, next-intl, Noto Sans Bengali ফন্ট অপটিমাইজেশন এবং স্বয়ংক্রিয় কুরিয়ার এপিআই সমন্বয়ে একটি সুপারফাস্ট হেডলেস প্ল্যাটফর্ম তৈরি করা হয়েছে।",
    result_en:
      "Achieved a 98 Mobile Lighthouse score, slashed page load times from 4.8s to 0.7s, and generated a 34% increase in mobile checkout completions.",
    result_bn:
      "মোবাইলে ৯৮ লাইটহাউস স্কোর অর্জন, পেজ লোডের সময় ৪.৮ সেকেন্ড থেকে ০.৭ সেকেন্ডে হ্রাস এবং মোবাইল চেকআউট কনভার্সনে ৩৪% প্রবৃদ্ধি।",
    tech_stack: ["Next.js 16", "React 19", "Tailwind CSS", "Supabase", "Redis", "TypeScript"],
    public_client_name: "DeshiWear Lifestyle",
    client_consent: true,
    completed_on: "2026-01-25",
    is_featured: true,
    is_published: true,
    category: "web",
    metrics: [
      { label_en: "Lighthouse Mobile", label_bn: "লাইটহাউস মোবাইল", value: "98/100" },
      { label_en: "Page Load Time", label_bn: "লোড টাইম", value: "0.7s" },
      { label_en: "Checkout Lift", label_bn: "কনভার্সন বৃদ্ধি", value: "+34%" },
    ],
  },
];

export async function getPortfolioItems(): Promise<PortfolioDetailItem[]> {
  const env = getPublicSupabaseEnv();
  if (env) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("is_published", true)
        .eq("client_consent", true)
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return (data as DbPortfolioRow[]).map((row) => {
          const fallback = PORTFOLIO_CATALOG.find((c) => c.slug === row.slug);
          return {
            id: row.id,
            slug: row.slug,
            title_en: row.title_en,
            title_bn: row.title_bn || row.title_en,
            summary_en: row.summary_en || "",
            summary_bn: row.summary_bn || row.summary_en || "",
            challenge_en: row.challenge_en || "",
            challenge_bn: row.challenge_bn || row.challenge_en || "",
            solution_en: row.solution_en || "",
            solution_bn: row.solution_bn || row.solution_en || "",
            result_en: row.result_en || "",
            result_bn: row.result_bn || row.result_en || "",
            cover_path: row.cover_path,
            live_url: row.live_url,
            tech_stack: row.tech_stack || fallback?.tech_stack || [],
            public_client_name: row.public_client_name,
            client_consent: row.client_consent,
            completed_on: row.completed_on,
            is_featured: row.is_featured,
            is_published: row.is_published,
            category: fallback?.category || "web",
            metrics: fallback?.metrics,
          };
        });
      }
    } catch {
      // Fall through to catalog fallback
    }
  }

  return PORTFOLIO_CATALOG;
}

export async function getPortfolioItemBySlug(slug: string): Promise<PortfolioDetailItem | null> {
  const env = getPublicSupabaseEnv();
  let dbRow: DbPortfolioRow | null = null;

  if (env) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .eq("client_consent", true)
        .maybeSingle();

      if (!error && data) {
        dbRow = data as DbPortfolioRow;
      }
    } catch {
      // Fall through
    }
  }

  const fallback = PORTFOLIO_CATALOG.find((item) => item.slug === slug);

  if (!dbRow && !fallback) {
    return null;
  }

  if (!dbRow) {
    return fallback!;
  }

  return {
    id: dbRow.id,
    slug: dbRow.slug,
    title_en: dbRow.title_en,
    title_bn: dbRow.title_bn || dbRow.title_en,
    summary_en: dbRow.summary_en || fallback?.summary_en || "",
    summary_bn: dbRow.summary_bn || fallback?.summary_bn || dbRow.summary_en || "",
    challenge_en: dbRow.challenge_en || fallback?.challenge_en || "",
    challenge_bn: dbRow.challenge_bn || fallback?.challenge_bn || dbRow.challenge_en || "",
    solution_en: dbRow.solution_en || fallback?.solution_en || "",
    solution_bn: dbRow.solution_bn || fallback?.solution_bn || dbRow.solution_en || "",
    result_en: dbRow.result_en || fallback?.result_en || "",
    result_bn: dbRow.result_bn || fallback?.result_bn || dbRow.result_en || "",
    cover_path: dbRow.cover_path || fallback?.cover_path,
    live_url: dbRow.live_url || fallback?.live_url,
    tech_stack: dbRow.tech_stack || fallback?.tech_stack || [],
    public_client_name: dbRow.public_client_name || fallback?.public_client_name,
    client_consent: dbRow.client_consent,
    completed_on: dbRow.completed_on || fallback?.completed_on,
    is_featured: dbRow.is_featured,
    is_published: dbRow.is_published,
    category: fallback?.category || "web",
    metrics: fallback?.metrics,
  };
}

export function getAllPortfolioSlugs(): string[] {
  return PORTFOLIO_CATALOG.map((item) => item.slug);
}
