import { SERVICES_CATALOG, ServiceDetailItem } from "./services-catalog";


export interface WizardOption {
  id: string;
  label_en: string;
  label_bn: string;
  scores: Record<string, number>; // service slug -> weight
}

export interface WizardQuestion {
  id: string;
  key: string;
  text_en: string;
  text_bn: string;
  kind: "single" | "multi";
  options: WizardOption[];
}

export interface TopServiceResult {
  service: ServiceDetailItem;
  score: number;
  matchPercentage: number;
}

export const FALLBACK_WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    id: "q-1",
    key: "primary_goal",
    text_en: "What is the primary technical objective of your project?",
    text_bn: "আপনার প্রজেক্টের প্রধান প্রযুক্তিগত লক্ষ্য কী?",
    kind: "single",
    options: [
      {
        id: "opt-1-1",
        label_en: "Build a bespoke modern website, web application, or client portal",
        label_bn: "আধুনিক দ্রুতগতির ওয়েবসাইট, ওয়েব অ্যাপ্লিকেশন বা ক্লায়েন্ট পোর্টাল তৈরি",
        scores: {
          "website-development": 15,
          "ui-ux-design": 8,
          "software-development": 6,
        },
      },
      {
        id: "opt-1-2",
        label_en: "Deploy autonomous AI chatbots, RAG retrieval, or customer agents",
        label_bn: "বুদ্ধিমান এআই চ্যাটবট, নলেজ রিট্রিভাল বা স্বয়ংক্রিয় কাস্টমার এজেন্ট স্থাপন",
        scores: {
          "ai-chatbots-agents": 18,
          "ai-automation": 10,
          "software-development": 4,
        },
      },
      {
        id: "opt-1-3",
        label_en: "Automate repetitive manual operations, document parsing, or data ingestion",
        label_bn: "পুনরাবৃত্তিমূলক কাজ, ডকুমেন্ট প্রসেসিং বা ডেটা ইনজেশন স্বয়ংক্রিয় করা",
        scores: {
          "ai-automation": 18,
          "crm-integration": 10,
          "software-development": 6,
        },
      },
      {
        id: "opt-1-4",
        label_en: "Launch a multi-tenant SaaS business with subscriptions and billing",
        label_bn: "আন্তর্জাতিক সাবস্ক্রিপশন ও বিলিং সহ মাল্টি-টেন্যান্ট SaaS প্ল্যাটফর্ম তৈরি",
        scores: {
          "saas-development": 18,
          "system-architecture-design": 8,
          "software-development": 8,
        },
      },
      {
        id: "opt-1-5",
        label_en: "Manage, secure, and scale existing cloud infrastructure and servers",
        label_bn: "বিদ্যমান ক্লাউড সার্ভার ও অবকাঠামো সুরক্ষিত, পরিচালনা ও স্কেল করা",
        scores: {
          "system-management": 18,
          "system-architecture-design": 10,
          "adsense-services": 4,
        },
      },
    ],
  },
  {
    id: "q-2",
    key: "core_priority",
    text_en: "Which core priority matters most to your team right now?",
    text_bn: "বর্তমানে আপনার টিমের জন্য কোন বিষয়টি সবচেয়ে গুরুত্বপূর্ণ?",
    kind: "single",
    options: [
      {
        id: "opt-2-1",
        label_en: "Flawless mobile UI, design system, and fast user conversion",
        label_bn: "সহজবোধ্য ইউজার ইন্টারফেস, ডিজাইন সিস্টেম ও দ্রুত কনভার্সন",
        scores: {
          "ui-ux-design": 14,
          "website-development": 10,
          "marketing": 6,
        },
      },
      {
        id: "opt-2-2",
        label_en: "Connecting our web forms to CRM pipelines (HubSpot / Salesforce)",
        label_bn: "ওয়েব ফর্ম ও লিড সরাসরি CRM সিস্টেমে (HubSpot/Salesforce) সিঙ্ক করা",
        scores: {
          "crm-integration": 16,
          "ai-automation": 8,
          "marketing": 4,
        },
      },
      {
        id: "opt-2-3",
        label_en: "High availability, database partitioning, and enterprise security",
        label_bn: "উচ্চ নির্ভরযোগ্যতা, ডেটাবেস পার্টিশনিং ও এন্টারপ্রাইজ নিরাপত্তা",
        scores: {
          "system-architecture-design": 15,
          "system-management": 10,
          "software-development": 8,
        },
      },
      {
        id: "opt-2-4",
        label_en: "Maximizing ad revenue and RPM while preserving 95+ Core Web Vitals",
        label_bn: "সাইটের গতি ঠিক রেখে বিজ্ঞাপন ও অ্যাডসেন্স থেকে আয় সর্বোচ্চকরণ",
        scores: {
          "adsense-services": 18,
          "marketing": 8,
          "website-development": 4,
        },
      },
    ],
  },
  {
    id: "q-3",
    key: "integrations",
    text_en: "Which technical capabilities do you anticipate needing?",
    text_bn: "কোন কোন প্রযুক্তিগত সংযোগ আপনার প্রজেক্টে প্রয়োজন হতে পারে?",
    kind: "multi",
    options: [
      {
        id: "opt-3-1",
        label_en: "Bilingual English & Bengali routing and localization",
        label_bn: "বাংলা ও ইংরেজি উভয় ভাষার সাপোর্ট (লোকালাইজেশন)",
        scores: {
          "website-development": 8,
          "ui-ux-design": 6,
          "marketing": 5,
        },
      },
      {
        id: "opt-3-2",
        label_en: "Custom Postgres database with Row Level Security (RLS)",
        label_bn: "রো লেভেল সিকিউরিটি (RLS) সহ সুরক্ষিত কাস্টম Postgres ডেটাবেস",
        scores: {
          "software-development": 8,
          "saas-development": 8,
          "system-architecture-design": 6,
        },
      },
      {
        id: "opt-3-3",
        label_en: "Large-scale web scraping, data extraction, or Python workers",
        label_bn: "বৃহৎ আকারের ডেটা স্ক্র্যাপিং বা পাইথন ব্যাকগ্রাউন্ড প্রসেসিং",
        scores: {
          "software-development": 8,
          "ai-automation": 7,
          "system-management": 4,
        },
      },
      {
        id: "opt-3-4",
        label_en: "Continuous search ranking (SEO) and performance ad tracking",
        label_bn: "সার্চ ইঞ্জিন র‍্যাঙ্কিং (SEO) এবং বিজ্ঞাপন ক্যাম্পেইন পরিচালনা",
        scores: {
          "marketing": 12,
          "adsense-services": 8,
          "website-development": 4,
        },
      },
    ],
  },
  {
    id: "q-4",
    key: "delivery_model",
    text_en: "What engagement model best aligns with your timeline and budget?",
    text_bn: "কোন ধরনের চুক্তি আপনার সময় ও বাজেটের সাথে সবচেয়ে উপযুক্ত?",
    kind: "single",
    options: [
      {
        id: "opt-4-1",
        label_en: "Fixed-scope milestone project with guaranteed turnaround",
        label_bn: "নির্দিষ্ট পরিধি ও মাইলস্টোন-ভিত্তিক ডেলিভারি",
        scores: {
          "website-development": 8,
          "ui-ux-design": 8,
          "crm-integration": 6,
          "ai-chatbots-agents": 6,
        },
      },
      {
        id: "opt-4-2",
        label_en: "Monthly ongoing engineering retainer with SLA coverage",
        label_bn: "সার্বক্ষণিক সাপোর্ট ও নিয়মিত আপডেটের জন্য মাসিক রিটেইনার",
        scores: {
          "system-management": 12,
          "marketing": 10,
          "adsense-services": 10,
        },
      },
      {
        id: "opt-4-3",
        label_en: "Full custom architectural roadmap for high-scale enterprise launch",
        label_bn: "বৃহৎ এন্টারপ্রাইজ লঞ্চের জন্য সম্পূর্ণ কাস্টম আর্কিটেকচারাল পরিকল্পনা",
        scores: {
          "system-architecture-design": 12,
          "saas-development": 12,
          "software-development": 8,
        },
      },
    ],
  },
];

export function calculateTopServices(
  answers: Record<string, string[]>,
  questions: WizardQuestion[] = FALLBACK_WIZARD_QUESTIONS
): TopServiceResult[] {
  const scores: Record<string, number> = {};

  // Initialize all known service slugs
  for (const s of SERVICES_CATALOG) {
    scores[s.slug] = 0;
  }

  // Accumulate scores for selected answers
  for (const question of questions) {
    const selectedOptionIds = answers[question.key] || [];
    for (const optId of selectedOptionIds) {
      const option = question.options.find((o) => o.id === optId);
      if (option && option.scores) {
        for (const [slug, weight] of Object.entries(option.scores)) {
          scores[slug] = (scores[slug] || 0) + weight;
        }
      }
    }
  }

  // Sort descending by score
  const sortedSlugs = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);

  // Find max score to compute normalized percentage
  const maxScore = Math.max(...Object.values(scores), 1);

  // Take top 3
  const top3Slugs = sortedSlugs.slice(0, 3);

  return top3Slugs.map((slug) => {
    const service = SERVICES_CATALOG.find((s) => s.slug === slug)!;
    const score = scores[slug];
    const matchPercentage = Math.min(Math.round((score / maxScore) * 100), 100);
    return {
      service,
      score,
      matchPercentage,
    };
  });
}

