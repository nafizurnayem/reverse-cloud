export type PricingModel = "fixed" | "hourly" | "retainer" | "custom";


export interface ServiceDetailItem {
  id?: string;
  slug: string;
  name_en: string;
  name_bn: string;
  pricing_model: PricingModel;
  starting_from_usd: number | null;
  sort_order: number;
  icon: string;
  summary_en: string;
  summary_bn: string;
  body_en: string;
  body_bn: string;
  deliverables_en: string[];
  deliverables_bn: string[];
  process_en: { step: number; title: string; description: string }[];
  process_bn: { step: number; title: string; description: string }[];
  tech_stack: string[];
  faqs_en: { question: string; answer: string }[];
  faqs_bn: { question: string; answer: string }[];
}

export const SERVICES_CATALOG: ServiceDetailItem[] = [
  {
    slug: "website-development",
    name_en: "Website Development",
    name_bn: "ওয়েবসাইট ডেভেলপমেন্ট",
    pricing_model: "fixed",
    starting_from_usd: 1200,
    sort_order: 10,
    icon: "Globe",
    summary_en:
      "Modern, high-converting, and blazing-fast web platforms engineered with Next.js App Router, React 19, TypeScript, and clean responsive CSS.",
    summary_bn:
      "Next.js অ্যাপ রাউটার, React 19, TypeScript ও পরিচ্ছন্ন রেসপনসিভ CSS দিয়ে তৈরি আধুনিক, দ্রুতগতির এবং উচ্চ রূপান্তরক্ষম ওয়েব প্ল্যাটফর্ম।",
    body_en:
      "We design and build production-grade web applications from initial wireframes to production deployment. Every site includes bilingual routing (i18n), full Core Web Vitals optimization, secure backend integration, and a content management workflow tailored to your operational velocity.",
    body_bn:
      "আমরা প্রাথমিক ওয়্যারফ্রেম থেকে শুরু করে প্রোডাকশন ডিপ্লয়মেন্ট পর্যন্ত পূর্ণাঙ্গ ওয়েব অ্যাপ্লিকেশন তৈরি করি। প্রতিটি সাইটে থাকে বহুভাষিক রাউটিং (i18n), কোর ওয়েব ভাইটালস অপটিমাইজেশন, নিরাপদ ব্যাকএন্ড ইন্টিগ্রেশন এবং আপনার পছন্দসই কনটেন্ট ম্যানেজমেন্ট।",
    deliverables_en: [
      "Custom responsive Next.js frontend with Tailwind CSS and Radix UI",
      "Full localization architecture (English and Bengali key parity)",
      "Supabase PostgreSQL database schemas with Row Level Security",
      "Automated CI/CD pipelines, Docker containerization, and staging setups",
      "SEO semantic metadata, JSON-LD schema, and OpenGraph social cards",
      "Lighthouse 95+ score optimization for performance and accessibility",
    ],
    deliverables_bn: [
      "Tailwind CSS ও Radix UI সমন্বয়ে কাস্টম রেসপনসিভ Next.js ফ্রন্টএন্ড",
      "পূর্ণ বহুভাষিক আর্কিটেকচার (ইংরেজি ও বাংলা অনুবাদের পূর্ণ সমতা)",
      "রো লেভেল সিকিউরিটি (RLS) সহ Supabase PostgreSQL ডেটাবেস স্কিমা",
      "স্বয়ংক্রিয় CI/CD পাইপলাইন, ডকার কন্টেইনার এবং স্টেজিং এনভায়রনমেন্ট",
      "এসইও সিম্যান্টিক মেটাডেটা, JSON-LD স্কিমা এবং ওপেন গ্রাফ সোশ্যাল কার্ড",
      "পারফরম্যান্স এবং অ্যাক্সেসিবিলিটির জন্য লাইটহাউস ৯৫+ স্কোর নিশ্চিতকরণ",
    ],
    process_en: [
      {
        step: 1,
        title: "Architecture & Wireframes",
        description: "We map your user flows, define relational database schemas, and create high-fidelity UI prototypes.",
      },
      {
        step: 2,
        title: "Full-Stack Development",
        description: "Modular development with strict TypeScript typing, server-side rendering, and responsive design tokens.",
      },
      {
        step: 3,
        title: "Testing & Security Audit",
        description: "Rigorous unit testing, Vitest coverage, RLS policy verification, and Core Web Vitals audit.",
      },
      {
        step: 4,
        title: "Deployment & Knowledge Transfer",
        description: "Zero-downtime production launch, staging previews, DNS config, and comprehensive documentation handoff.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "আর্কিটেকচার ও ওয়্যারফ্রেম",
        description: "আমরা ইউজার ফ্লো বিশ্লেষণ করি, ডেটাবেস স্কিমা নির্ধারণ করি এবং হাই-ফিডেলিটি প্রোটোটাইপ তৈরি করি।",
      },
      {
        step: 2,
        title: "ফুল-স্ট্যাক ডেভেলপমেন্ট",
        description: "TypeScript টাইপিং, সার্ভার-সাইড রেন্ডারিং এবং রেসপনসিভ ডিজাইন টোকেন সহ মডুলার কোড নির্মাণ।",
      },
      {
        step: 3,
        title: "টেস্টিং ও নিরাপত্তা অডিট",
        description: "Vitest টেস্ট কভারেজ, ডেটাবেস RLS পলিসি যাচাই এবং কোর ওয়েব ভাইটালস পারফরম্যান্স নিরীক্ষণ।",
      },
      {
        step: 4,
        title: "ডিপ্লয়মেন্ট ও হস্তান্তর",
        description: "জিরো-ডাউনটাইম প্রোডাকশন লঞ্চ, ডিএনএস কনফিগারেশন এবং ব্যবহারের জন্য সম্পূর্ণ নির্দেশিকা হস্তান্তর।",
      },
    ],
    tech_stack: ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS", "Supabase", "PostgreSQL", "Docker"],
    faqs_en: [
      {
        question: "How long does a custom website project typically take?",
        answer: "A standard bespoke website takes between 2 to 4 weeks depending on scope, design iterations, and backend integrations.",
      },
      {
        question: "Will the website be optimized for mobile devices and search engines?",
        answer: "Yes, 100% of our builds are mobile-first, meet strict Core Web Vitals thresholds, and include structured JSON-LD data for search engines.",
      },
      {
        question: "Can our team update content after launch?",
        answer: "Absolutely. We build role-based admin panels and headless CMS integrations so your marketing team can publish and edit content without developer assistance.",
      },
    ],
    faqs_bn: [
      {
        question: "ওয়েবসাইট তৈরি করতে সাধারণত কত সময় লাগে?",
        answer: "প্রজেক্টের পরিধি, ডিজাইনের জটিলতা এবং ব্যাকএন্ড ইন্টিগ্রেশনের ওপর ভিত্তি করে সাধারণত ২ থেকে ৪ সপ্তাহ সময় লাগে।",
      },
      {
        question: "ওয়েবসাইটটি কি মোবাইল ও সার্চ ইঞ্জিনের জন্য অপটিমাইজড থাকবে?",
        answer: "হ্যাঁ, আমাদের প্রতিটি সাইট মোবাইল-ফার্স্ট ডিজাইনে তৈরি, দ্রুত লোড হয় এবং সার্চ ইঞ্জিনের জন্য সঠিক মেটা ও স্কিমা অন্তর্ভুক্ত থাকে।",
      },
      {
        question: "লঞ্চের পর কি আমরা নিজেরা কনটেন্ট পরিবর্তন করতে পারব?",
        answer: "অবশ্যই। আমরা নিরাপদ অ্যাডমিন প্যানেল তৈরি করে দিই যার মাধ্যমে আপনার টিম সহজেই টেক্সট, ছবি ও নতুন কনটেন্ট আপডেট করতে পারবে।",
      },
    ],
  },
  {
    slug: "ai-automation",
    name_en: "AI Automation",
    name_bn: "এআই অটোমেশন",
    pricing_model: "fixed",
    starting_from_usd: 1500,
    sort_order: 20,
    icon: "Cpu",
    summary_en:
      "Streamline operations by automating repetitive workflows, unstructured data ingestion, and document processing with production AI agents.",
    summary_bn:
      "প্রোডাকশন এআই এজেন্টের সাহায্যে পুনরাবৃত্তিমূলক কাজ, জটিল ডেটা নিষ্কাশন এবং ডকুমেন্ট প্রসেসিং সম্পূর্ণ স্বয়ংক্রিয় করুন।",
    body_en:
      "We replace brittle manual tasks with resilient AI-powered workflows. From processing complex PDF invoices and parsing unstructured emails to building automated reporting pipelines, our automations run reliably in asynchronous background queues with comprehensive audit logs.",
    body_bn:
      "আমরা মানুষের ম্যানুয়াল কাজের বদলে নির্ভরযোগ্য এআই-চালিত ওয়ার্কফ্লো স্থাপন করি। জটিল ইনভয়েস স্ক্যানিং থেকে শুরু করে আনস্ট্রাকচার্ড ডেটা প্রসেসিং ও স্বয়ংক্রিয় রিপোর্টিং—সবকিছু ব্যাকগ্রাউন্ড কিউ ও পুঙ্খানুপুঙ্খ অডিট লগ সহ পরিচালিত হয়।",
    deliverables_en: [
      "Custom workflow automation engine with async task queues and retry logic",
      "PydanticAI and LangChain integrations for deterministic LLM outputs",
      "Document processing pipelines with OCR, parsing, and structured JSON output",
      "Third-party integrations via secure webhooks, Zapier, Make, or direct REST APIs",
      "Failure fallback alerts via Telegram, Slack, or email notifications",
    ],
    deliverables_bn: [
      "অ্যাসিঙ্ক টাস্ক কিউ এবং রিট্রাই লজিক সহ কাস্টম ওয়ার্কফ্লো অটোমেশন ইঞ্জিন",
      "নির্ধারিত আউটপুটের জন্য PydanticAI ও আধুনিক LLM ইন্টিগ্রেশন",
      "ওসিআর এবং স্ট্রাকচার্ড JSON রূপান্তর সহ ডকুমেন্ট প্রসেসিং পাইপলাইন",
      "নিরাপদ ওয়েবহুক ও সরাসরি REST এপিআই-এর মাধ্যমে থার্ড-পার্টি সিস্টেম ইন্টিগ্রেশন",
      "ব্যর্থতা রোধে তাৎক্ষণিক টেলিগ্রাম, স্ল্যাক বা ইমেল অ্যালার্ট ব্যবস্থা",
    ],
    process_en: [
      {
        step: 1,
        title: "Workflow Audit",
        description: "We analyze your recurring manual bottlenecks, volume, and data sources.",
      },
      {
        step: 2,
        title: "Pipeline Architecture",
        description: "Design stateful agents with deterministic schemas, fallback models, and rate limits.",
      },
      {
        step: 3,
        title: "Implementation & Staging",
        description: "Build asynchronous job workers, audit tables, and alerting channels.",
      },
      {
        step: 4,
        title: "Production Guardrails",
        description: "Deploy with retry budgets, idempotency keys, and telemetry dashboards.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "ওয়ার্কফ্লো অডিট",
        description: "আমরা আপনার টিমের পুনরাবৃত্তিমূলক কাজ, কাজের পরিধি এবং ডেটা সোর্স পর্যালোচনা করি।",
      },
      {
        step: 2,
        title: "পাইপলাইন আর্কিটেকচার",
        description: "নির্ভরযোগ্য স্কিমা, ব্যাকআপ মডেল এবং রেট লিমিট সহ স্টেটফুল এজেন্ট ডিজাইন করি।",
      },
      {
        step: 3,
        title: "নির্মাণ ও টেস্ট",
        description: "অ্যাসিঙ্ক্রোনাস জব ওয়ার্কার, ডেটাবেস অডিট টেবিল এবং অ্যালার্ট চ্যানেল তৈরি করি।",
      },
      {
        step: 4,
        title: "গার্ডরেল ও ডিপ্লয়",
        description: "আইডেমপোটেন্সি কি, রিট্রাই পলিসি ও টেলিমেট্রি ড্যাশবোর্ড সহ প্রোডাকশনে চালু করি।",
      },
    ],
    tech_stack: ["Python 3.12", "FastAPI", "PydanticAI", "PostgreSQL", "Redis", "Celery", "OpenAI / Claude"],
    faqs_en: [
      {
        question: "How do you prevent hallucinations in automated workflows?",
        answer: "We enforce strict Pydantic schema validation, self-correcting retry loops, and deterministic fallback functions for all extracted data.",
      },
      {
        question: "Can the automation connect to our existing CRM or ERP?",
        answer: "Yes, our pipelines integrate with standard APIs like Salesforce, HubSpot, QuickBooks, Google Workspace, and proprietary databases.",
      },
    ],
    faqs_bn: [
      {
        question: "অটোমেশনে এআই-এর ভুল তথ্য (হ্যালুসিনেশন) কিভাবে প্রতিরোধ করা হয়?",
        answer: "আমরা কঠোর Pydantic স্কিমা ভ্যালিডেশন, সেলফ-কারেক্টিং রিট্রাই লুপ এবং সুনির্দিষ্ট ফলব্যাক ফাংশন ব্যবহার করি।",
      },
      {
        question: "এটি কি আমাদের বর্তমান CRM বা ডেটাবেসের সাথে যুক্ত হতে পারে?",
        answer: "হ্যাঁ, আমাদের পাইপলাইন সহজেই Salesforce, HubSpot, Google Workspace এবং যেকোনো REST এপিআই-এর সাথে যুক্ত হতে পারে।",
      },
    ],
  },
  {
    slug: "ai-chatbots-agents",
    name_en: "AI Chatbots & Agents",
    name_bn: "এআই চ্যাটবট ও এজেন্ট",
    pricing_model: "fixed",
    starting_from_usd: 1800,
    sort_order: 30,
    icon: "Bot",
    summary_en:
      "Enterprise conversational agents equipped with domain retrieval (RAG), multi-step tool execution, and guardrailed contextual memory.",
    summary_bn:
      "ডোমেন রিট্রিভাল (RAG), মাল্টি-স্টেপ টুল এক্সিকিউশন এবং নিয়ন্ত্রিত মেমরি সম্পন্ন বুদ্ধিমান এন্টারপ্রাইজ চ্যাটবট ও এজেন্ট।",
    body_en:
      "Deploy intelligent assistants that go beyond canned responses. Our autonomous agents query proprietary knowledge bases, verify facts against live databases, execute internal APIs on behalf of users, and route complex edge-cases seamlessly to human staff.",
    body_bn:
      "সাধারণ বাঁধাধরা উত্তরের পরিবর্তে বুদ্ধিমান সহকারী তৈরি করুন যা আপনার অভ্যন্তরীণ নলেজ বেস থেকে তথ্য খুঁজে আনে, ডেটাবেস যাচাই করে, এপিআই কল সম্পন্ন করে এবং জটিল ক্ষেত্রে সরাসরি মানব প্রতিনিধিদের কাছে হস্তান্তর করে।",
    deliverables_en: [
      "Vector database embeddings with pgvector or Qdrant for semantic search",
      "Retrieval Augmented Generation (RAG) pipeline with hybrid search & reranking",
      "Function calling & tool execution engine with sandboxed permissions",
      "Multi-channel deployment (Web widget, WhatsApp, Telegram, or internal portals)",
      "Admin telemetry dashboard for conversation review, latency, and feedback loops",
    ],
    deliverables_bn: [
      "সিম্যান্টিক সার্চের জন্য pgvector বা Qdrant ভেক্টর ডেটাবেস এমবেডিং",
      "হাইব্রিড সার্চ এবং রির‍্যাঙ্কিং সহ Retrieval Augmented Generation (RAG) পাইপলাইন",
      "অনুমোদিত কার্য সম্পাদনের জন্য ফাংশন কলিং এবং টুল এক্সিকিউশন ইঞ্জিন",
      "ওয়েব উইজেট, হোয়াটসঅ্যাপ, টেলিগ্রাম বা ইন্টারনাল পোর্টালে ব্যবহারের সুবিধা",
      "কথোপকথন নিরীক্ষণ ও ফিডব্যাকের জন্য অ্যাডমিন টেলিমেট্রি ড্যাশবোর্ড",
    ],
    process_en: [
      {
        step: 1,
        title: "Knowledge Ingestion",
        description: "Scrape, chunk, and index your documentation, FAQs, and product manuals into vector stores.",
      },
      {
        step: 2,
        title: "Prompt Engineering & Tools",
        description: "Define agent boundaries, tone of voice, tool access, and safety guardrails.",
      },
      {
        step: 3,
        title: "Interface Integration",
        description: "Build responsive, accessible chat UIs with streaming markdown and citation badges.",
      },
      {
        step: 4,
        title: "Golden Dataset Evaluation",
        description: "Benchmark responses against representative questions to guarantee high accuracy before launch.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "নলেজ ইনজেশন",
        description: "আপনার কোম্পানির ডকুমেন্ট, এফএকিউ এবং ম্যানুয়াল ভেক্টর ডেটাবেসে ইনডেক্স করা।",
      },
      {
        step: 2,
        title: "প্রম্পট ও টুল কনফিগারেশন",
        description: "এজেন্টের ব্যক্তিত্ব, সুরক্ষা সীমা এবং এপিআই টুল অ্যাক্সেস নির্ধারণ করা।",
      },
      {
        step: 3,
        title: "ইন্টারফেস ইন্টিগ্রেশন",
        description: "স্ট্রিমিং রেসপন্স এবং রেফারেন্স সাইটেশন সহ রেসপনসিভ চ্যাট ইন্টারফেস তৈরি।",
      },
      {
        step: 4,
        title: "মূল্যায়ন ও পরীক্ষণ",
        description: "গোল্ডেন ডেটাসেটের সাথে শতভাগ যথার্থতা পরীক্ষা করে প্রোডাকশনে উন্মুক্ত করা।",
      },
    ],
    tech_stack: ["TypeScript", "Next.js", "Python", "pgvector", "LangChain", "OpenAI", "Anthropic Claude"],
    faqs_en: [
      {
        question: "Can the chatbot answer questions only from our company's documents?",
        answer: "Yes. Using strict RAG constraints, the agent will only cite verified information from your supplied knowledge base and politely decline unknown queries.",
      },
      {
        question: "Does the chatbot support Bengali and English simultaneously?",
        answer: "Yes, our models automatically detect the user's language and respond fluently in Bengali or English.",
      },
    ],
    faqs_bn: [
      {
        question: "চ্যাটবট কি শুধুমাত্র আমাদের দেওয়া তথ্য থেকেই উত্তর দেবে?",
        answer: "হ্যাঁ। কড়া RAG নিয়মের মাধ্যমে চ্যাটবট শুধুমাত্র অনুমোদিত নথি থেকে উত্তর দেবে এবং অজানা তথ্যের ক্ষেত্রে মানব সহায়তা নেওয়ার পরামর্শ দেবে।",
      },
      {
        question: "এটি কি একই সাথে বাংলা এবং ইংরেজি উভয় ভাষা বুঝতে পারে?",
        answer: "হ্যাঁ, সিস্টেমটি স্বয়ংক্রিয়ভাবে ব্যবহারকারীর ভাষা শনাক্ত করে সাবলীল বাংলা বা ইংরেজিতে উত্তর দিতে সক্ষম।",
      },
    ],
  },
  {
    slug: "ui-ux-design",
    name_en: "UI/UX Design",
    name_bn: "ইউআই/ইউএক্স ডিজাইন",
    pricing_model: "fixed",
    starting_from_usd: 900,
    sort_order: 40,
    icon: "Palette",
    summary_en:
      "Intuitive, accessible, and polished digital experiences with custom design systems, atomic components, and interactive prototypes.",
    summary_bn:
      "সহজবোধ্য ও দৃষ্টিনন্দন ডিজিটাল অভিজ্ঞতা, পরিচ্ছন্ন ডিজাইন সিস্টেম এবং ইন্টারঅ্যাক্টিভ প্রোটোটাইপ।",
    body_en:
      "Great software starts with clear thinking. We turn complex business workflows into simple, elegant digital interfaces. We deliver production-ready Figma design systems with strict typography, WCAG AA color contrast, fluid micro-interactions, and developer-friendly token specifications.",
    body_bn:
      "একটি সফল প্রোডাক্টের মূল ভিত্তি চমৎকার ডিজাইন। আমরা জটিল ব্যবসায়িক প্রক্রিয়াকে সহজ ও সাবলীল ইন্টারফেসে রূপান্তর করি। সুনির্দিষ্ট টাইপোগ্রাফি, অ্যাক্সেসিবিলিটি এবং কোডিং উপযোগী ডিজাইন সিস্টেম সরবরাহ করি।",
    deliverables_en: [
      "Complete Figma design system with components, variants, and design tokens",
      "Interactive high-fidelity user click-through prototypes",
      "Dark mode and light mode color palette specifications with WCAG AA compliance",
      "Responsive layout artboards for mobile, tablet, and desktop screens",
      "Comprehensive developer handoff documentation with spacing tokens and assets",
    ],
    deliverables_bn: [
      "ভেরিয়েন্ট ও ডিজাইন টোকেন সহ পূর্ণাঙ্গ Figma ডিজাইন সিস্টেম",
      "ব্যবহারকারী পরীক্ষার জন্য ইন্টারঅ্যাক্টিভ হাই-ফিডেলিটি প্রোটোটাইপ",
      "WCAG AA কমপ্লায়েন্স সহ ডার্ক মোড ও লাইট মোড কালার প্যালেট",
      "মোবাইল, ট্যাবলেট এবং ডেস্কটপের জন্য রেসপনসিভ আর্টবোর্ড",
      "ডেভেলপারদের সুবিধার্থে স্পষ্ট স্পেসিং ও অ্যাসেট হ্যান্ডঅফ গাইড",
    ],
    process_en: [
      {
        step: 1,
        title: "User Research & Information Architecture",
        description: "User interviews, persona mapping, and sitemap hierarchy definition.",
      },
      {
        step: 2,
        title: "Wireframing & UX Exploration",
        description: "Low-fidelity screen flows to validate usability before committing to visual polish.",
      },
      {
        step: 3,
        title: "Visual System & High-Fidelity UI",
        description: "Creating the component library, typography scale, iconography, and polished layouts.",
      },
      {
        step: 4,
        title: "Developer Handoff & Review",
        description: "Token export, asset optimization, and pairing with frontend engineers during build.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "ইউজার রিসার্চ ও আর্কিটেকচার",
        description: "ব্যবহারকারীর প্রয়োজনীয়তা বিশ্লেষণ এবং সাইটম্যাপ কাঠামো নির্ধারণ।",
      },
      {
        step: 2,
        title: "ওয়্যারফ্রেমিং ও ইউএক্স ডিজাইন",
        description: "মূল ইন্টারঅ্যাকশন যাচাইয়ের জন্য প্রাথমিক স্ক্রিন ফ্লো তৈরি।",
      },
      {
        step: 3,
        title: "ভিজ্যুয়াল সিস্টেম ও হাই-ফিডেলিটি ইউআই",
        description: "কম্পোনেন্ট লাইব্রেরি, রঙের বিন্যাস এবং চূড়ান্ত আধুনিক ইন্টারফেস প্রস্তুতকরণ।",
      },
      {
        step: 4,
        title: "হ্যান্ডঅফ ও বাস্তবায়ন সহায়তা",
        description: "টোকেন এক্সপোর্ট এবং কোডিং বাস্তবায়নের সময় ডেভেলপারদের সাথে সমন্বয়।",
      },
    ],
    tech_stack: ["Figma", "Tailwind Design Tokens", "Radix UI", "WCAG 2.1 AA", "Storybook"],
    faqs_en: [
      {
        question: "Do you provide Figma files that our developers can easily code?",
        answer: "Yes. Our Figma files are built using auto-layout, named design tokens, and components that map 1:1 with Tailwind CSS classes.",
      },
    ],
    faqs_bn: [
      {
        question: "আপনারা কি এমন Figma ফাইল দেন যা দিয়ে সহজে কোড করা যায়?",
        answer: "হ্যাঁ। আমাদের ফিগমা ফাইলগুলো অটো-লেআউট এবং Tailwind CSS ক্লাসের সাথে সামঞ্জস্যপূর্ণ ডিজাইন টোকেন দিয়ে সাজানো থাকে।",
      },
    ],
  },
  {
    slug: "software-development",
    name_en: "Software Development",
    name_bn: "সফটওয়্যার ডেভেলপমেন্ট",
    pricing_model: "fixed",
    starting_from_usd: 2500,
    sort_order: 50,
    icon: "Layers",
    summary_en:
      "Bespoke backend architectures, microservices, high-throughput APIs, and custom software designed for reliability and scalability.",
    summary_bn:
      "কাস্টম ব্যাকএন্ড আর্কিটেকচার, মাইক্রোসার্ভিসেস, উচ্চগতির এপিআই এবং দীর্ঘমেয়াদী স্কেলেবল সফটওয়্যার সমাধান।",
    body_en:
      "When off-the-shelf software falls short, we engineer bespoke applications built to your precise operational specifications. We emphasize type-safe code, strict database constraints, automated testing, and clean architecture principles to ensure your software remains maintainable as your volume expands.",
    body_bn:
      "সাধারণ রেডিমেড সফটওয়্যারে কাজ না হলে আমরা তৈরি করি আপনার ব্যবসার উপযোগী কাস্টম সফটওয়্যার। টাইপ-সেফ কোডিং, ডেটাবেস কনস্ট্রেইন্ট, স্বয়ংক্রিয় টেস্টিং এবং ক্লিন আর্কিটেকচারের মাধ্যমে আমরা সর্বোচ্চ স্থায়িত্ব নিশ্চিত করি।",
    deliverables_en: [
      "Modular backend API services built with Node.js, Next.js, or FastAPI",
      "PostgreSQL database schemas with strict foreign keys, indexes, and triggers",
      "Role-based access control (RBAC) and Row Level Security implementation",
      "Comprehensive unit and integration test suites with CI execution",
      "Dockerized microservice deployment with health checks and log shipping",
    ],
    deliverables_bn: [
      "Node.js, Next.js বা FastAPI দিয়ে নির্মিত মডুলার ব্যাকএন্ড এপিআই",
      "প্রয়োজনীয় ইনডেক্স ও সিকিউরিটি ট্রিগার সহ PostgreSQL ডেটাবেস স্কিমা",
      "রোল-ভিত্তিক অ্যাক্সেস কন্ট্রোল (RBAC) এবং রো লেভেল সিকিউরিটি (RLS)",
      "স্বয়ংক্রিয় CI পাইপলাইন সহ ইউনিট ও ইন্টিগ্রেশন টেস্ট স্যুট",
      "হেলথ চেক ও সেন্ট্রালাইজড লগিং সহ ডকারাইজড সার্ভিস ডিপ্লয়মেন্ট",
    ],
    process_en: [
      {
        step: 1,
        title: "System Specifications",
        description: "Defining data entities, API contracts, security vectors, and performance milestones.",
      },
      {
        step: 2,
        title: "Domain Core & Persistence",
        description: "Implementing pure business logic, database migrations, and transaction safety.",
      },
      {
        step: 3,
        title: "API Layer & Integration",
        description: "Building authenticated endpoints, input validation, and asynchronous webhooks.",
      },
      {
        step: 4,
        title: "Load Testing & Release",
        description: "Stress testing concurrent workloads, securing secrets, and containerized deployment.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "সিস্টেম স্পেসিফিকেশন",
        description: "ডেটা এনটিটি, এপিআই চুক্তি, নিরাপত্তা নির্দেশিকা এবং পারফরম্যান্স মাইলস্টোন নির্ধারণ।",
      },
      {
        step: 2,
        title: "ডোমেন লজিক ও ডেটাবেস",
        description: "বিজনেস লজিক, ডেটাবেস মাইগ্রেশন এবং লেনদেনের নির্ভুলতা বাস্তবায়ন।",
      },
      {
        step: 3,
        title: "এপিআই ও ইন্টিগ্রেশন",
        description: "নিরাপদ এন্ডপয়েন্ট, ইনপুট ভ্যালিডেশন এবং ব্যাকগ্রাউন্ড প্রসেসিং তৈরি।",
      },
      {
        step: 4,
        title: "লোড টেস্টিং ও লঞ্চ",
        description: "চাপ সহ্য করার ক্ষমতা পরীক্ষা এবং ডকারাইজড ক্লাউডে স্থিতিশীল ডিপ্লয়মেন্ট।",
      },
    ],
    tech_stack: ["TypeScript", "Python", "PostgreSQL", "Next.js", "FastAPI", "Docker", "Redis"],
    faqs_en: [
      {
        question: "Do we retain full ownership of the source code?",
        answer: "Yes, you own 100% of the repository, documentation, architecture diagrams, and deployed infrastructure upon milestone completion.",
      },
    ],
    faqs_bn: [
      {
        question: "সোর্স কোডের পূর্ণ মালিকানা কি আমাদের থাকবে?",
        answer: "হ্যাঁ, কাজ সমাপ্তির সাথে সাথে সোর্স কোড, নথিপত্র এবং পুরো সিস্টেমের শতভাগ মালিকানা আপনার কাছে হস্তান্তর করা হয়।",
      },
    ],
  },
  {
    slug: "system-management",
    name_en: "System Management",
    name_bn: "সিস্টেম ম্যানেজমেন্ট",
    pricing_model: "retainer",
    starting_from_usd: 800,
    sort_order: 60,
    icon: "Server",
    summary_en:
      "Reliable 24/7 cloud server administration, uptime monitoring, container maintenance, security hardening, and disaster recovery.",
    summary_bn:
      "২৪/৭ নির্ভরযোগ্য ক্লাউড সার্ভার অ্যাডমিনিস্ট্রেশন, আপটাইম মনিটরিং, সিকিউরিটি প্যাচিং এবং ব্যাকআপ ব্যবস্থাপনা।",
    body_en:
      "Ensure your critical digital infrastructure never skips a beat. Our proactive system management covers regular operating system upgrades, SSL renewals, automated encrypted backups, intrusion prevention, resource optimization, and rapid emergency incident resolution.",
    body_bn:
      "আপনার ক্লাউড ইনফ্রাস্ট্রাকচারের সুরক্ষা ও কার্যকারিতা সবসময় সচল রাখুন। আমরা নিয়মিত সিস্টেম আপডেট, SSL রিনিউয়াল, এনক্রিপ্টেড ব্যাকআপ, ফায়ারওয়াল কনফিগারেশন এবং জরুরি সমস্যা দ্রুত সমাধানের সার্বক্ষণিক সেবা প্রদান করি।",
    deliverables_en: [
      "24/7 automated uptime and latency monitoring with incident alerting",
      "Automated daily database snapshots with disaster recovery test runs",
      "Zero-downtime OS and package security patch management",
      "Web Application Firewall (WAF) and DDoS mitigation rules",
      "Monthly server health and capacity utilization reports",
    ],
    deliverables_bn: [
      "তাৎক্ষণিক অ্যালার্ট সহ সার্বক্ষণিক (২৪/৭) আপটাইম ও পারফরম্যান্স মনিটরিং",
      "নিয়মিত ডেটাবেস স্ন্যাপশট ও ডিজাস্টার রিকভারি ড্রিল",
      "জিরো-ডাউনটাইমে সিকিউরিটি প্যাচ ও অপারেটিং সিস্টেম আপডেট",
      "ওয়েব অ্যাপ্লিকেশন ফায়ারওয়াল (WAF) এবং DDoS সুরক্ষা কনফিগারেশন",
      "মাসিক সার্ভার স্বাস্থ্য এবং রিসোর্স ব্যবহারের বিস্তারিত রিপোর্ট",
    ],
    process_en: [
      {
        step: 1,
        title: "Infrastructure Audit",
        description: "Cataloging all nodes, open ports, SSL certificates, backup paths, and resource bottlenecks.",
      },
      {
        step: 2,
        title: "Hardening & Monitoring",
        description: "Locking down SSH, enabling firewall rules, and wiring real-time alert channels.",
      },
      {
        step: 3,
        title: "Automation Setup",
        description: "Deploying automated backup scripts to isolated cold storage with verified checksums.",
      },
      {
        step: 4,
        title: "Continuous Maintenance",
        description: "Scheduled maintenance windows, vulnerability scans, and SLA-backed emergency coverage.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "ইনফ্রাস্ট্রাকচার অডিট",
        description: "সব সার্ভার, পোর্ট, সিকিউরিটি সার্টিফিকেট এবং রিসোর্স ব্যবহারের অবস্থা মূল্যায়ন।",
      },
      {
        step: 2,
        title: "নিরাপত্তা জোরদার ও মনিটরিং",
        description: "ফায়ারওয়াল কনফিগারেশন এবং রিয়েল-টাইম নোটিফিকেশন চ্যানেল সক্রিয় করা।",
      },
      {
        step: 3,
        title: "ব্যাকআপ অটোমেশন",
        description: "আইসোলেটেড ক্লাউড স্টোরেজে স্বয়ংক্রিয় দৈনিক ব্যাকআপ সেটআপ ও পরীক্ষা।",
      },
      {
        step: 4,
        title: "নিয়মিত রক্ষণাবেক্ষণ",
        description: "নিয়মিত ভালনারেবিলিটি স্ক্যান এবং দ্রুত জরুরি সহায়তা প্রদান।",
      },
    ],
    tech_stack: ["Linux (Ubuntu/Debian)", "Docker", "Kubernetes", "Prometheus", "Grafana", "Cloudflare", "AWS / Hetzner"],
    faqs_en: [
      {
        question: "What is your emergency response time for downtime?",
        answer: "Under our retainer SLA, critical downtime incidents receive engineering response within 15 to 30 minutes.",
      },
    ],
    faqs_bn: [
      {
        question: "সার্ভার ডাউন হলে আপনারা কত দ্রুত সাড়া দেন?",
        answer: "আমাদের রিটেইনার চুক্তির অধীনে গুরুতর সার্ভার সমস্যায় আমরা ১৫ থেকে ৩০ মিনিটের মধ্যে সমাধান প্রক্রিয়া শুরু করি।",
      },
    ],
  },
  {
    slug: "system-architecture-design",
    name_en: "System Architecture Design",
    name_bn: "সিস্টেম আর্কিটেকচার ডিজাইন",
    pricing_model: "custom",
    starting_from_usd: 2000,
    sort_order: 70,
    icon: "Network",
    summary_en:
      "Enterprise technical roadmaps, high-availability multi-region design, data modeling, and cost-efficient cloud topology.",
    summary_bn:
      "উচ্চ ট্র্যাফিক ও স্কেলেবিলিটির জন্য এন্টারপ্রাইজ সিস্টেম আর্কিটেকচার, ক্লাউড টপোলজি এবং ডেটাবেস মডেলিং।",
    body_en:
      "Avoid costly architectural rebuilds before writing code. We evaluate your product goals and engineer resilient technical foundations: decoupling monolithic apps, designing event-driven messaging, configuring data partitions, and eliminating single points of failure.",
    body_bn:
      "কোডিং শুরু করার আগেই সঠিক আর্কিটেকচার নির্ধারণ করুন। আমরা আপনার প্রোডাক্টের লক্ষ্য পর্যালোচনা করে দীর্ঘস্থায়ী ও সাশ্রয়ী ক্লাউড টপোলজি তৈরি করি, যাতে ট্র্যাফিক বাড়লেও সিস্টেম অটল থাকে এবং অপ্রয়োজনীয় ক্লাউড বিল কমে।",
    deliverables_en: [
      "Comprehensive system architecture diagrams (C4 model / Mermaid)",
      "Database entity-relationship schemas with indexing and partitioning strategy",
      "High-availability and disaster recovery cloud infrastructure blueprints",
      "API contract specifications and event streaming architecture",
      "Cloud budget forecasting and unit-economics optimization analysis",
    ],
    deliverables_bn: [
      "বিস্তারিত সিস্টেম আর্কিটেকচার ডায়াগ্রাম এবং ফ্লোচার্ট",
      "অপটিমাইজড ডেটাবেস স্কিমা, ইনডেক্সিং এবং পার্টিশনিং প্ল্যান",
      "উচ্চ নির্ভরযোগ্যতা ও দুর্যোগ মোকাবিলার ক্লাউড ব্লুপ্রিন্ট",
      "এপিআই স্পেসিফিকেশন এবং ইভেন্ট-ভিত্তিক মেসেজিং ডিজাইন",
      "ক্লাউড খরচ বিশ্লেষণ এবং সাশ্রয়ী রিসোর্স পরিকল্পনা",
    ],
    process_en: [
      {
        step: 1,
        title: "Discovery & Requirements",
        description: "Deep-dive sessions to understand traffic projections, compliance needs, and data velocity.",
      },
      {
        step: 2,
        title: "Topology Modeling",
        description: "Drafting service boundaries, cache layers, asynchronous queues, and database engines.",
      },
      {
        step: 3,
        title: "Peer Review & Threat Modeling",
        description: "Validating against security threats, latency targets, and multi-region failover conditions.",
      },
      {
        step: 4,
        title: "Blueprint Delivery & Team Briefing",
        description: "Delivering implementation-ready blueprints and conducting architectural walkthroughs.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "প্রয়োজনীয়তা বিশ্লেষণ",
        description: "ভবিষ্যতের ট্র্যাফিক, ডেটার পরিধি এবং সিকিউরিটি প্রয়োজনীয়তা গভীরভাবে বিশ্লেষণ।",
      },
      {
        step: 2,
        title: "টপোলজি মডেলিং",
        description: "সার্ভিস বাউন্ডারি, ক্যাশিং লেয়ার এবং মেসেজ ব্রোকার নির্ধারণ।",
      },
      {
        step: 3,
        title: "নিরাপত্তা ও ফেইলিউর অ্যানালাইসিস",
        description: "সুরক্ষা ঝুঁকি যাচাই এবং সিস্টেম ফেইলিউর প্রতিরোধের ব্যবস্থা পরীক্ষা।",
      },
      {
        step: 4,
        title: "ব্লুপ্রিন্ট হস্তান্তর",
        description: "বাস্তবায়নযোগ্য ডকুমেন্টেশন হস্তান্তর এবং ডেভেলপমেন্ট টিমকে বিস্তারিত ব্রিফিং।",
      },
    ],
    tech_stack: ["AWS", "Google Cloud", "PostgreSQL", "Kafka / Redis Streams", "Terraform", "Kubernetes"],
    faqs_en: [
      {
        question: "Can this service help reduce our existing AWS or GCP cloud bill?",
        answer: "Yes, architectural optimizations (such as eliminating overprovisioned instances and tuning caches) typically reduce cloud costs by 30% to 50%.",
      },
    ],
    faqs_bn: [
      {
        question: "এটি কি আমাদের বর্তমান ক্লাউড বিল কমাতে সাহায্য করতে পারে?",
        answer: "হ্যাঁ, অপ্রয়োজনীয় রিসোর্স ছাঁটাই এবং সঠিক ক্যাশিং ও আর্কিটেকচারের মাধ্যমে সাধারণত ৩০% থেকে ৫০% ক্লাউড খরচ কমানো সম্ভব হয়।",
      },
    ],
  },
  {
    slug: "marketing",
    name_en: "Marketing & Growth",
    name_bn: "ডিজিটাল মার্কেটিং ও গ্রোথ",
    pricing_model: "retainer",
    starting_from_usd: 750,
    sort_order: 80,
    icon: "TrendingUp",
    summary_en:
      "Data-driven performance marketing, technical SEO enhancements, conversion rate optimization, and localized search presence.",
    summary_bn:
      "ডেটা-চালিত পারফরম্যান্স মার্কেটিং, টেকনিক্যাল এসইও, কনভার্সন অপটিমাইজেশন এবং সুনির্দিষ্ট গ্রোথ ক্যাম্পেইন।",
    body_en:
      "Great engineering needs an audience. We marry technical engineering with growth strategies: running technical SEO audits to rank for high-intent keywords, setting up multi-touch analytics attribution, optimizing landing page conversion funnels, and managing targeted ad spend.",
    body_bn:
      "আমরা টেকনিক্যাল ইঞ্জিনিয়ারিং ও মার্কেটিং স্ট্র্যাটেজির নিখুঁত মেলবন্ধন ঘটাই। টেকনিক্যাল এসইও অডিট, কনভার্সন রেট অপটিমাইজেশন (CRO) এবং ডেটা-ভিত্তিক ক্যাম্পেইনের মাধ্যমে সঠিক গ্রাহকের কাছে পৌঁছাতে সাহায্য করি।",
    deliverables_en: [
      "Comprehensive technical SEO audit and on-page keyword optimization",
      "Google Tag Manager, Google Analytics 4, and server-side event tracking",
      "High-converting landing page A/B tests and UX optimization recommendations",
      "Search and social performance ad campaign management (Google / Meta)",
      "Bi-weekly performance analytics reports with clear ROI attribution",
    ],
    deliverables_bn: [
      "পূর্ণাঙ্গ টেকনিক্যাল এসইও অডিট এবং অন-পেজ কিওয়ার্ড অপটিমাইজেশন",
      "Google Analytics 4 এবং সার্ভার-সাইড কনভার্সন ট্র্যাকিং সেটআপ",
      "ল্যান্ডিং পেজের কনভার্সন রেট বৃদ্ধির জন্য A/B টেস্টিং",
      "গুগল এবং মেটা প্ল্যাটফর্মে টার্গেটেড অ্যাড ক্যাম্পেইন পরিচালনা",
      "স্বচ্ছ ROI বিশ্লেষণ সহ পাক্ষিক গ্রোথ এবং অ্যানালিটিক্স রিপোর্ট",
    ],
    process_en: [
      {
        step: 1,
        title: "Growth Audit & Baseline",
        description: "Auditing organic search rankings, conversion friction, and ad efficiency.",
      },
      {
        step: 2,
        title: "Strategy & Tracking Setup",
        description: "Fixing tracking discrepancies, defining custom conversion events, and selecting keywords.",
      },
      {
        step: 3,
        title: "Campaign Execution",
        description: "Launching copy, visual assets, landing pages, and targeted ad campaigns.",
      },
      {
        step: 4,
        title: "Iterative Optimization",
        description: "Weekly bid adjustments, ad creative testing, and funnel refinement based on data.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "অডিট ও বেসলাইন",
        description: "বর্তমান অর্গানিক ট্র্যাফিক, কনভার্সন ড্রপ-অফ এবং বিজ্ঞাপনের কার্যকারিতা যাচাই।",
      },
      {
        step: 2,
        title: "কৌশল ও ট্র্যাকিং সেটআপ",
        description: "সঠিক ইভেন্ট ট্র্যাকিং স্থাপন এবং লক্ষ্যভিত্তিক কিওয়ার্ড নির্বাচন।",
      },
      {
        step: 3,
        title: "ক্যাম্পেইন পরিচালনা",
        description: "বিজ্ঞাপনের কনটেন্ট, ব্যানার এবং ল্যান্ডিং পেজ প্রস্তুত করে ক্যাম্পেইন চালু।",
      },
      {
        step: 4,
        title: "নিয়মিত অপটিমাইজেশন",
        description: "প্রাপ্ত তথ্যের ভিত্তিতে প্রতি সপ্তাহে বিড সমন্বয় ও রূপান্তর বৃদ্ধির কাজ।",
      },
    ],
    tech_stack: ["Google Analytics 4", "Google Tag Manager", "Google Search Console", "Meta Ads", "Ahrefs"],
    faqs_en: [
      {
        question: "How quickly do we see results from SEO and performance marketing?",
        answer: "Paid campaigns yield immediate traffic and conversion data within days; technical SEO typically begins compounding rankings within 6 to 12 weeks.",
      },
    ],
    faqs_bn: [
      {
        question: "এসইও এবং পেইড মার্কেটিং থেকে কত দ্রুত ফলাফল পাওয়া যায়?",
        answer: "পেইড ক্যাম্পেইনে কয়েকদিনের মধ্যে ফলাফল দৃশ্যমান হয়; অপরদিকে টেকনিক্যাল এসইও-র স্থায়ী সুফল পেতে সাধারণত ৬ থেকে ১২ সপ্তাহ সময় লাগে।",
      },
    ],
  },
  {
    slug: "crm-integration",
    name_en: "CRM Integration",
    name_bn: "সিআরএম ইন্টিগ্রেশন",
    pricing_model: "fixed",
    starting_from_usd: 1100,
    sort_order: 90,
    icon: "Users",
    summary_en:
      "Connect your lead forms, customer portals, and communication channels directly with HubSpot, Salesforce, or custom Postgres CRMs.",
    summary_bn:
      "আপনার লিড ফর্ম, কাস্টমার পোর্টাল এবং কমিউনিকেশন চ্যানেলগুলোকে HubSpot, Salesforce বা নিজস্ব CRM-এর সাথে স্বয়ংক্রিয়ভাবে যুক্ত করুন।",
    body_en:
      "Never lose another inbound lead in a lost inbox. We connect your web forms, chat widgets, and sales touchpoints directly into your customer relationship management tools with bi-directional syncing, instant rep notifications, and automated deal stage progression.",
    body_bn:
      "ইনবক্সে লিড হারিয়ে যাওয়া বন্ধ করুন। আপনার ওয়েব ফর্ম, চ্যাট উইজেট এবং সেলস চ্যানেল সরাসরি CRM-এ সংযুক্ত করি—তাৎক্ষণিক সেলস রিপ্রেজেন্টেটিভ নোটিফিকেশন, স্বয়ংক্রিয় ডিল আপডেট এবং নির্ভুল সিঙ্কের সাথে।",
    deliverables_en: [
      "Custom webhook ingestion pipeline with anti-spam and verification layers",
      "Bi-directional synchronization between web application and CRM platforms",
      "Automated lead assignment, deal creation, and task notification workflows",
      "Custom field mapping and duplicate record merging rules",
      "Historical data migration and schema synchronization",
    ],
    deliverables_bn: [
      "স্প্যাম প্রতিরোধ ও ভ্যালিডেশন সহ কাস্টম ওয়েবহুক ইনজেশন পাইপলাইন",
      "ওয়েব প্ল্যাটফর্ম ও সিআরএম-এর মধ্যে স্বয়ংক্রিয় দ্বিমুখী ডেটা সিঙ্ক",
      "নতুন লিড আসলে তাৎক্ষণিক টাস্ক অ্যাসাইনমেন্ট ও নোটিফিকেশন ওয়ার্কফ্লো",
      "কাস্টম ফিল্ড ম্যাপিং এবং ডুপ্লিকেট লিড রোধের স্বয়ংক্রিয় নিয়ম",
      "পূর্বের গ্রাহক তথ্যের নির্ভরযোগ্য মাইগ্রেশন এবং ফিল্ড সিনক্রোনাইজেশন",
    ],
    process_en: [
      {
        step: 1,
        title: "Field Schema Mapping",
        description: "Aligning web form inputs, data types, and custom lifecycle stages with your CRM schema.",
      },
      {
        step: 2,
        title: "Integration Pipeline",
        description: "Writing robust webhook handlers with retry queues and security signatures.",
      },
      {
        step: 3,
        title: "End-to-End Testing",
        description: "Simulating form submissions, edge-case validation errors, and verifying notification delivery.",
      },
      {
        step: 4,
        title: "Go-Live & Staff Training",
        description: "Production cutover, monitoring lead ingestion in real-time, and training sales staff.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "ফিল্ড স্কিমা ম্যাপিং",
        description: "ওয়েব ফর্মের তথ্য এবং সিআরএমের ফিল্ডগুলোর মধ্যে সামঞ্জস্য বিধান।",
      },
      {
        step: 2,
        title: "ইন্টিগ্রেশন পাইপলাইন নির্মাণ",
        description: "নিরাপদ ওয়েবহুক হ্যান্ডলার, রিট্রাই মেকানিজম এবং অথেনটিকেশন তৈরি।",
      },
      {
        step: 3,
        title: "পূর্ণাঙ্গ টেস্ট",
        description: "নমুনা লিড পাঠিয়ে সিঙ্ক নির্ভুলতা ও নোটিফিকেশন পৌঁছানোর গতি পরীক্ষা।",
      },
      {
        step: 4,
        title: "গো-লাইভ ও ব্রিফিং",
        description: "প্রোডাকশনে চালু, রিয়েল-টাইম লিড ইনজেশন তদারকি এবং টিমের প্রয়োজনীয় প্রশিক্ষণ।",
      },
    ],
    tech_stack: ["HubSpot API", "Salesforce REST API", "Supabase", "TypeScript", "Zapier / Webhooks"],
    faqs_en: [
      {
        question: "Can you build a custom internal CRM directly on our Supabase database?",
        answer: "Yes. For teams wanting full data sovereignty without monthly per-seat licensing fees, we build custom Postgres-backed CRM interfaces.",
      },
    ],
    faqs_bn: [
      {
        question: "আপনারা কি Supabase দিয়ে আমাদের নিজস্ব ইন্টারনাল CRM তৈরি করতে পারেন?",
        answer: "হ্যাঁ। প্রতি মাসে থার্ড-পার্টি সাবস্ক্রিপশন খরচ বাঁচাতে আমরা সরাসরি আপনার নিজস্ব ডেটাবেসে কাস্টম CRM তৈরি করে দিই।",
      },
    ],
  },
  {
    slug: "adsense-services",
    name_en: "AdSense Services",
    name_bn: "অ্যাডসেন্স সার্ভিসেস",
    pricing_model: "retainer",
    starting_from_usd: 500,
    sort_order: 100,
    icon: "DollarSign",
    summary_en:
      "Ad placement optimization, Core Web Vitals preservation, revenue yield maximization, and policy violation protection for digital publishers.",
    summary_bn:
      "বিজ্ঞাপন প্লেসমেন্ট অপটিমাইজেশন, কোর ওয়েব ভাইটালস রক্ষা, বিজ্ঞাপন থেকে আয় বৃদ্ধি এবং গুগল পলিসি সুরক্ষা।",
    body_en:
      "Maximize your publishing revenue without ruining user experience or site speed. We strategically engineer ad container placements, implement lazy-loading scripts that protect Core Web Vitals, and configure policy guardrails to keep your account safe from invalid traffic penalties.",
    body_bn:
      "ওয়েবসাইটের গতি বা ব্যবহারকারীর অভিজ্ঞতা নষ্ট না করে বিজ্ঞাপনের আয় বাড়ান। আমরা স্ট্র্যাটেজিক অ্যাড প্লেসমেন্ট, লেজি-লোডিং এবং গুগল পলিসি কমপ্লায়েন্স নিশ্চিত করি যাতে আপনার অ্যাকাউন্ট নিরাপদ থাকে এবং আয় বৃদ্ধি পায়।",
    deliverables_en: [
      "Site-wide ad unit audit and high-viewability placement blueprint",
      "Asynchronous ad script loading preventing Cumulative Layout Shift (CLS)",
      "Google Publisher Tag (GPT) optimization and Header Bidding integration",
      "Policy compliance review to eliminate accidental clicks and penalty risks",
      "Yield management and RPM (Revenue Per Mille) benchmarking reports",
    ],
    deliverables_bn: [
      "সাইটব্যাপী অ্যাড ইউনিট অডিট এবং সর্বোচ্চ ভিউয়েবিলিটি প্লেসমেন্ট প্ল্যান",
      "লেআউট শিফট (CLS) মুক্ত অ্যাসিঙ্ক্রোনাস অ্যাড লোডিং স্ক্রিপ্ট",
      "Google Publisher Tag (GPT) অপটিমাইজেশন এবং হেডার বিডিং ইন্টিগ্রেশন",
      "ভুল ক্লিক ও পলিসি ভায়োলেশন প্রতিরোধে পুঙ্খানুপুঙ্খ রিভিউ",
      "নিয়মিত আরপিএম (RPM) ট্র্যাকিং এবং আয় বৃদ্ধির অ্যানালিটিক্স রিপোর্ট",
    ],
    process_en: [
      {
        step: 1,
        title: "Publisher & Speed Audit",
        description: "Benchmarking current RPM, ad viewability rates, and measuring page speed impact.",
      },
      {
        step: 2,
        title: "Slot Re-Engineering",
        description: "Designing fixed-aspect-ratio ad placeholders to prevent sudden content layout shifts.",
      },
      {
        step: 3,
        title: "Implementation & Staging",
        description: "Deploying optimized GPT scripts, responsive unit sizes, and viewability listeners.",
      },
      {
        step: 4,
        title: "Yield Monitoring",
        description: "Tracking eCPM improvements, monitoring invalid traffic rates, and adjusting placements.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "অডিট ও স্পিড টেস্ট",
        description: "বর্তমান RPM, ভিউয়েবিলিটি রেট এবং পেজ লোডিং গতির প্রভাব বিশ্লেষণ।",
      },
      {
        step: 2,
        title: "অ্যাড স্লট রি-ইঞ্জিনিয়ারিং",
        description: "লেআউট শিফট রোধ করতে সুনির্দিষ্ট সাইজের অ্যাড কন্টেইনার প্রস্তুত।",
      },
      {
        step: 3,
        title: "বাস্তবায়ন ও টেস্টিং",
        description: "অপটিমাইজড অ্যাড স্ক্রিপ্ট এবং রেসপনসিভ ব্যানার প্লেসমেন্ট স্থাপন।",
      },
      {
        step: 4,
        title: "মনিটরিং ও অপটিমাইজেশন",
        description: "eCPM বৃদ্ধি ট্র্যাক করা এবং ট্র্যাফিক কোয়ালিটি বজায় রেখে আয় সর্বোচ্চ করা।",
      },
    ],
    tech_stack: ["Google AdSense", "Google Ad Manager", "Header Bidding (Prebid.js)", "Core Web Vitals"],
    faqs_en: [
      {
        question: "Will putting more ads slow down my website or hurt SEO?",
        answer: "Not with our implementation. We load ad tags asynchronously only when units enter the viewport, keeping Core Web Vitals fully green.",
      },
    ],
    faqs_bn: [
      {
        question: "বিজ্ঞাপন বসালে কি ওয়েবসাইট স্লো হয়ে যাবে বা এসইও ক্ষতি হবে?",
        answer: "আমাদের সিস্টেমে নয়। আমরা লেজি-লোডিং ব্যবহার করি ফলে বিজ্ঞাপন শুধুমাত্র স্ক্রিনে আসলে লোড হয় এবং সাইটের গতি বজায় থাকে।",
      },
    ],
  },
  {
    slug: "saas-development",
    name_en: "SaaS Development",
    name_bn: "স্যাস ডেভেলপমেন্ট",
    pricing_model: "custom",
    starting_from_usd: 3500,
    sort_order: 110,
    icon: "Rocket",
    summary_en:
      "Full-cycle Software-as-a-Service architecture: multi-tenancy, subscription billing, RBAC permissions, and high-converting onboarding.",
    summary_bn:
      "পূর্ণাঙ্গ সফটওয়্যার-অ্যাজ-আ-সার্ভিস (SaaS) প্ল্যাটফর্ম: মাল্টি-টেন্যান্সি, বিলিং, সাবস্ক্রিপশন ও রোল-ভিত্তিক পারমিশন।",
    body_en:
      "Turn your product vision into a scalable, monetizable SaaS business. We engineer comprehensive SaaS platforms with isolated multi-tenant data partitioning, automated Stripe or Paddle subscription billing, team invitation workflows, audit logging, and actionable product usage analytics.",
    body_bn:
      "আপনার সফটওয়্যার ধারণাকে একটি লাভজনক SaaS ব্যবসায় রূপান্তর করুন। আমরা মাল্টি-টেন্যান্ট ডেটাবেস, আন্তর্জাতিক পেমেন্ট গেটওয়ে (Stripe/Paddle), টিম রোলস ও ইনভাইটেশন এবং সাবস্ক্রিপশন অটোমেশন সহ পূর্ণাঙ্গ প্ল্যাটফর্ম তৈরি করি।",
    deliverables_en: [
      "Multi-tenant data isolation architecture with PostgreSQL Row Level Security",
      "Tiered subscription checkout, billing portal, and webhook reconciliation",
      "Organization workspaces, team invites, and fine-grained RBAC permissions",
      "Interactive onboarding flow with product tour and welcome checklists",
      "Transactional email integration, telemetry logs, and customer health dashboards",
    ],
    deliverables_bn: [
      "রো লেভেল সিকিউরিটি (RLS) সহ মাল্টি-টেন্যান্ট ডেটা আইসোলেশন",
      "আন্তর্জাতিক সাবস্ক্রিপশন বিলিং ও ওয়েবহুক রিকনসিলিয়েশন",
      "অর্গানাইজেশন ওয়ার্কস্পেস, টিম মেম্বার ইনভাইট এবং রোল-ভিত্তিক পারমিশন",
      "ব্যবহারকারী অনবোর্ডিং ফ্লো এবং ইন্টারেক্টিভ প্রোডাক্ট ট্যুর",
      "ট্রানজ্যাকশনাল ইমেল, টেলিমেট্রি লগ এবং কাস্টমার হেলথ ড্যাশবোর্ড",
    ],
    process_en: [
      {
        step: 1,
        title: "Product Scope & Multi-Tenancy Strategy",
        description: "Defining tenant isolation levels, feature tiers, and subscription monetization models.",
      },
      {
        step: 2,
        title: "Core Platform Engine",
        description: "Building auth, organization schemas, RLS policies, and team invitation workflows.",
      },
      {
        step: 3,
        title: "Billing & Feature Gates",
        description: "Integrating Stripe subscriptions, usage metering, and billing portal access.",
      },
      {
        step: 4,
        title: "Telemetry, Launch & Scale",
        description: "Setting up event analytics, error logging, and deployment to auto-scaling cloud clusters.",
      },
    ],
    process_bn: [
      {
        step: 1,
        title: "প্রোডাক্ট স্কোপ ও মাল্টি-টেন্যান্সি",
        description: "টেন্যান্ট ডেটা নিরাপত্তা, ফিচার টায়ার এবং সাবস্ক্রিপশন মডেল নির্ধারণ।",
      },
      {
        step: 2,
        title: "কোর প্ল্যাটফর্ম নির্মাণ",
        description: "অথেনটিকেশন, অর্গানাইজেশন ওয়ার্কস্পেস, RLS এবং ইনভাইটেশন ওয়ার্কফ্লো প্রস্তুত।",
      },
      {
        step: 3,
        title: "বিলিং ও পেমেন্ট ইন্টিগ্রেশন",
        description: "Stripe সাবস্ক্রিপশন বিলিং, কাস্টমার পোর্টাল এবং ফিচার গেটিং স্থাপন।",
      },
      {
        step: 4,
        title: "লঞ্চ ও স্কেলিং",
        description: "ইভেন্ট ট্র্যাকিং, এরর মনিটরিং এবং ক্লাউড ক্লাস্টারে নিরাপদ উৎপাদনমুখী প্রকাশ।",
      },
    ],
    tech_stack: ["Next.js 16", "React 19", "TypeScript", "Supabase", "PostgreSQL", "Stripe API", "Tailwind CSS"],
    faqs_en: [
      {
        question: "How do you ensure data from one company cannot be accessed by another?",
        answer: "We leverage Postgres Row Level Security (RLS) enforced at the database kernel level, strictly isolating every query by tenant organization ID.",
      },
      {
        question: "Can we support monthly, yearly, and usage-based billing models?",
        answer: "Yes, our billing layer supports recurring intervals, free trials, coupon codes, and metered usage overages.",
      },
    ],
    faqs_bn: [
      {
        question: "এক কোম্পানির ডেটা যাতে অন্য কোম্পানি দেখতে না পারে তা কিভাবে নিশ্চিত করেন?",
        answer: "আমরা PostgreSQL-এর কার্নেল লেভেলে Row Level Security (RLS) প্রয়োগ করি, যা প্রতিটি কোয়েরিকে সুনির্দিষ্ট অর্গানাইজেশনের ডেটাতে আবদ্ধ রাখে।",
      },
      {
        question: "আমরা কি মাসিক, বার্ষিক ও ব্যবহারভিত্তিক (Usage-based) প্ল্যান রাখতে পারব?",
        answer: "হ্যাঁ, আমাদের সাবস্ক্রিপশন সিস্টেমে রিকারিং বিলিং, ফ্রি ট্রায়াল, ডিসকাউন্ট কুপন এবং মিটারড ইউসেজ বিলিং সমর্থন করে।",
      },
    ],
  },
];

export function getAllServiceSlugs(): string[] {
  return SERVICES_CATALOG.map((s) => s.slug);
}

