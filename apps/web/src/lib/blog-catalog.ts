import { getPublicSupabaseEnv } from "./supabase/env";
import { createClient } from "./supabase/server";

export interface BlogPostItem {
  id?: string;
  slug: string;
  title_en: string;
  title_bn: string;
  excerpt_en: string;
  excerpt_bn: string;
  body_en: string;
  body_bn: string;
  cover_path?: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  published_at: string;
  read_time_minutes: number;
  author: {
    name: string;
    role_en: string;
    role_bn: string;
  };
}

interface DbBlogRow {
  id: string;
  slug: string;
  title_en: string | null;
  title_bn: string | null;
  excerpt_en: string | null;
  excerpt_bn: string | null;
  body_en: string | null;
  body_bn: string | null;
  cover_path: string | null;
  tags: string[] | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
}

export const BLOG_CATALOG: BlogPostItem[] = [
  {
    slug: "building-production-agentic-workflows-pydantic-ai",
    title_en: "Architecting Deterministic Agentic AI Workflows in Production",
    title_bn: "প্রোডাকশন গ্রেড ডিটারমিনিস্টিক এজেন্টিক এআই আর্কিটেকচার",
    excerpt_en:
      "Why unstructured LLM outputs fail in enterprise software, and how to use PydanticAI, strict schemas, and stateful retry loops for resilient automation.",
    excerpt_bn:
      "কেন সাধারণ এলএলএম আউটপুট এন্টারপ্রাইজ সিস্টেমে ব্যর্থ হয় এবং PydanticAI ও কঠোর স্কিমা ভ্যালিডেশনের মাধ্যমে কীভাবে নির্ভরযোগ্য অটোমেশন তৈরি করা যায়।",
    body_en: `Large language models offer unprecedented generative capabilities, but enterprise systems demand predictability. When a financial calculation, inventory dispatch, or customer CRM update depends on model outputs, a 1% hallucination rate is not an edge case—it is a system-halting incident.

### The Problem With Raw Prompts

Relying on string manipulation and temperature zero is insufficient. Complex tools frequently return subtle type mismatches, missing object fields, or hallucinated enum variants. To bridge the gap between stochastic reasoning and deterministic enterprise software, your architecture must treat LLMs as untrusted client inputs that require immediate schema parsing and validation.

### Enforcing Strict Type Safety with Pydantic

By defining explicit response schemas using Pydantic models, we force the model to output structured JSON matching our operational interfaces:

\`\`\`python
from pydantic import BaseModel, Field

class FreightManifest(BaseModel):
    tracking_id: str = Field(..., regex=r"^[A-Z]{3}-\\d{6}$")
    origin_port: str
    destination_port: str
    container_count: int = Field(gt=0)
    declared_value_usd: float = Field(ge=0.0)
\`\`\`

### Resilient Retry and Fallback Loops

When validation fails, rather than crashing or swallowing the error, our agent framework feeds the exact validation error traceback directly back to the model context. The model self-corrects in 99.2% of retries without manual human intervention.

### Observability and Audit Trails

Every model call, latency benchmark, token consumption metric, and tool invocation is recorded to append-only database audit tables. This guarantees complete explainability for compliance, security audits, and financial reconciliation.`,
    body_bn: `লার্জ ল্যাঙ্গুয়েজ মডেলের ব্যাপক সক্ষমতা থাকা সত্ত্বেও এন্টারপ্রাইজ সিস্টেমে প্রয়োজন শতভাগ নির্ভরযোগ্যতা। যখন কোনো আর্থিক হিসাব, ইনভেন্টরি আপডেট বা গ্রাহক তথ্য এআই আউটপুটের ওপর নির্ভর করে, তখন ১% ভুলও পুরো সিস্টেমকে ঝুঁকিতে ফেলে।

### সাধারণ প্রম্পটের সীমাবদ্ধতা

শুধুমাত্র সাধারণ টেক্সট প্রম্পট বা জিরো টেম্পারেচার দিয়ে শতভাগ নির্ভুল ফলাফল পাওয়া সম্ভব নয়। মডেল প্রায়শই টাইপ মিসম্যাচ বা কাল্পনিক তথ্য প্রদান করতে পারে। তাই এন্টারপ্রাইজ আর্কিটেকচারে এআই মডেলের আউটপুটকে সর্বদা যাচাইযোগ্য ডেটা হিসেবে বিবেচনা করতে হয়।

### Pydantic স্কিমা দিয়ে টাইপ সেফটি

Pydantic মডেলের মাধ্যমে সুনির্দিষ্ট রেসপন্স ফরম্যাট বাধ্যতামূলক করে আমরা মডেল থেকে কাঠামোগত JSON গ্রহণ করি:

\`\`\`python
from pydantic import BaseModel, Field

class FreightManifest(BaseModel):
    tracking_id: str = Field(..., regex=r"^[A-Z]{3}-\\d{6}$")
    origin_port: str
    destination_port: str
    container_count: int = Field(gt=0)
    declared_value_usd: float = Field(ge=0.0)
\`\`\`

### সেলফ-কারেক্টিং রিট্রাই ব্যবস্থা

যদি কোনো ক্ষেত্রে ভ্যালিডেশন ব্যর্থ হয়, তবে সিস্টেম ক্র্যাশ না করে তাৎক্ষণিকভাবে নির্দিষ্ট ভুলের তথ্য পুনরায় মডেলকে প্রদান করে। ফলে মানুষের হস্তক্ষেপ ছাড়াই ৯৯.২% ক্ষেত্রে মডেল নিজেই ভুল সংশোধন করে নেয়।

### নিরীক্ষা ও অডিট ট্রেইল

প্রতিটি এআই কল, লেটেন্সি, টোকেন খরচ এবং এপিআই এক্সিকিউশন একটি অপরিবর্তনীয় অডিট টেবিলে সংরক্ষণ করা হয়, যা নিরাপত্তা ও প্রাতিষ্ঠানিক কমপ্লায়েন্স নিশ্চিত করে।`,
    tags: ["AI", "Python", "Pydantic", "Architecture"],
    status: "published",
    published_at: "2026-09-18T10:00:00Z",
    read_time_minutes: 6,
    author: {
      name: "Reverse Cloud Engineering",
      role_en: "AI Systems Architecture",
      role_bn: "এআই সিস্টেম আর্কিটেকচার",
    },
  },
  {
    slug: "scaling-nextjs-with-postgres-rls",
    title_en: "Zero-Trust Multi-Tenancy: Next.js App Router with Postgres RLS",
    title_bn: "জিরো-ট্রাস্ট মাল্টি-টেন্যান্সি: Next.js অ্যাপ রাউটার ও Postgres RLS",
    excerpt_en:
      "A deep dive into enforcing database kernel security where application bugs cannot leak customer data across workspace boundaries.",
    excerpt_bn:
      "ডেটাবেস কার্নেল লেভেলে রো লেভেল সিকিউরিটি (RLS) প্রয়োগের বাস্তব কৌশল, যা অ্যাপ্লিকেশন ত্রুটি সত্ত্বেও ডেটা লিক হতে দেয় না।",
    body_en: `In standard multi-tenant web applications, developers frequently rely on application-layer filtering: inserting \`WHERE organization_id = current_org\` across hundreds of queries. This approach is prone to severe security vulnerabilities; a single forgotten query in a minor dashboard update can inadvertently expose customer records across organizations.

### Why Postgres Row Level Security Wins

Row Level Security (RLS) shifts authorization checks from error-prone application code down to the Postgres kernel itself. Once enabled, the database engine guarantees that a query can only access rows matching the user's active tenant session context, regardless of how the SQL query was constructed in the frontend or backend.

### Setting Up Session Context in Next.js Server Components

With Supabase and Next.js App Router, every authenticated database client runs under the verified JWT of the authenticated user. We pass tenant context automatically through session claims:

\`\`\`sql
CREATE POLICY "tenant_isolation"
  ON public.documents
  FOR ALL
  TO authenticated
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);
\`\`\`

### Performance Optimization for High-Concurrency Queries

To prevent RLS evaluation from degrading query throughput:
1. Always add composite B-Tree indexes matching the policy's filter predicate (\`organization_id, id\`).
2. Wrap security helper functions in immutable or \`STABLE\` functions so Postgres query planners can cache execution trees.
3. Test with automated pgtap test harnesses running against anonymous, staff, and multi-tenant user personas.`,
    body_bn: `সাধারণ মাল্টি-টেন্যান্ট ওয়েব অ্যাপ্লিকেশনে ডেভেলপাররা প্রায়শই অ্যাপ্লিকেশন কোডের ওপর নির্ভর করে কোয়েরিতে \`WHERE organization_id = current_org\` ব্যবহার করেন। কিন্তু শত শত কোয়েরির মধ্যে একটিতেও ভুল হলে অন্য অর্গানাইজেশনের ডেটা ফাঁস হয়ে যাওয়ার মারাত্মক ঝুঁকি থাকে।

### Postgres Row Level Security (RLS)-এর সুবিধা

রো লেভেল সিকিউরিটি এই নিরাপত্তা যাচাইয়ের দায়িত্ব অ্যাপ্লিকেশন কোড থেকে সরাসরি ডেটাবেস ইঞ্জিনে স্থানান্তর করে। RLS সক্রিয় থাকলে ইউজার যে কোয়েরিই পাঠাক না কেন, ডেটাবেস শুধুমাত্র অনুমোদিত রেকর্ড প্রদর্শন করে।

### Next.js ও Supabase-এ সেশন হ্যান্ডলিং

Next.js অ্যাপ রাউটার ও Supabase-এ প্রতি রিকোয়েস্টে ইউজারের ভেরিফায়েড JWT ব্যবহৃত হয়:

\`\`\`sql
CREATE POLICY "tenant_isolation"
  ON public.documents
  FOR ALL
  TO authenticated
  USING (organization_id = (auth.jwt() ->> 'org_id')::uuid);
\`\`\`

### উচ্চ ট্রাফিকের জন্য পারফরম্যান্স অপটিমাইজেশন

RLS-এর গতি বৃদ্ধি করতে:
১. পলিসির ফিল্টারের সাথে মিল রেখে কম্পোজিট ইনডেক্স (\`organization_id, id\`) ব্যবহার করুন।
২. সিকিউরিটি হেল্পার ফাংশনগুলোকে \`STABLE\` হিসেবে ডিক্লেয়ার করুন যাতে ডেটাবেস এক্সিকিউশন প্ল্যান ক্যাশ করতে পারে।
৩. স্বয়ংক্রিয় টেস্ট স্যুটের মাধ্যমে প্রতিটি ইউজারের ডেটা আইসোলেশন পরীক্ষা করুন।`,
    tags: ["Next.js", "PostgreSQL", "Security", "Full-Stack"],
    status: "published",
    published_at: "2026-08-30T14:30:00Z",
    read_time_minutes: 5,
    author: {
      name: "Reverse Cloud Engineering",
      role_en: "Database & Cloud Infrastructure",
      role_bn: "ডেটাবেস ও ক্লাউড অবকাঠামো",
    },
  },
  {
    slug: "optimizing-core-web-vitals-with-monetization",
    title_en: "High-RPM Monetization Without Destroying Core Web Vitals",
    title_bn: "কোর ওয়েব ভাইটালস ঠিক রেখে সর্বোচ্চ বিজ্ঞাপন আয় নিশ্চিতকরণ",
    excerpt_en:
      "How to implement asynchronous ad loading, aspect-ratio reserving, and lazy slot rendering to keep Google Lighthouse scores at 95+ while maximizing revenue.",
    excerpt_bn:
      "লেআউট শিফট মুক্ত লেজি-লোডিং ও অ্যাসপেক্ট রেশিও সংরক্ষণের মাধ্যমে সাইটের গতি ৯৫+ বজায় রেখে বিজ্ঞাপন থেকে আয় বৃদ্ধির কৌশল।",
    body_en: `Digital publishers and SaaS content hubs frequently face a trade-off: maximizing ad viewability often cripples user experience, causing Cumulative Layout Shift (CLS) penalties and degrading search rankings.

### Eliminating Cumulative Layout Shift (CLS)

The primary cause of CLS on ad-supported websites is ad containers expanding after page load. To eliminate this issue:
- Reserve explicit container heights and aspect ratios using CSS before any ad scripts initialize.
- Enforce \`min-height\` properties matching the highest yield banner formats.

\`\`\`css
.ad-slot-leaderboard {
  min-height: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
  contain: layout-inline-size;
}
\`\`\`

### Intersection Observer Lazy Loading

Never load ad auction tags or Prebid scripts until an ad slot is within 200 pixels of the viewport. Loading all scripts during initial page parsing blocks the main JavaScript thread, drastically inflating Total Blocking Time (TBT).

### Continuous Benchmarking

We integrate automated synthetic Core Web Vitals checks into continuous integration pipelines, ensuring zero regressions to mobile First Contentful Paint (FCP) and Largest Contentful Paint (LCP).`,
    body_bn: `অনলাইন পাবলিশার এবং কনটেন্ট প্ল্যাটফর্মগুলো প্রায়ই একটি সমস্যায় পড়ে: বিজ্ঞাপনের সংখ্যা বাড়ালে পেজের গতি কমে যায় এবং লেআউট শিফট (CLS) বেড়ে গুগল সার্চ র‍্যাঙ্কিংয়ে নেতিবাচক প্রভাব পড়ে।

### কিউমুলেটিভ লেআউট শিফট (CLS) প্রতিরোধ

বিজ্ঞাপন লোড হওয়ার সময় পেজ হঠাৎ নিচে নেমে যাওয়া বা নড়ে ওঠাই CLS-এর প্রধান কারণ। এটি প্রতিরোধে:
- স্ক্রিপ্ট লোড হওয়ার আগেই CSS-এর মাধ্যমে বিজ্ঞাপনের স্থান ও সাইজ রিজার্ভ করে রাখুন।
- সর্বাধিক ব্যবহৃত ব্যানার সাইজের সাথে মিল রেখে \`min-height\` সেট করুন।

\`\`\`css
.ad-slot-leaderboard {
  min-height: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
  contain: layout-inline-size;
}
\`\`\`

### ইন্টারসেকশন অবজারভার দিয়ে লেজি-লোডিং

ব্যবহারকারী স্ক্রোল করে বিজ্ঞাপনের ২০০ পিক্সেল কাছাকাছি আসার আগে কোনো বিজ্ঞাপন স্ক্রিপ্ট লোড করবেন না। পেজ ওপেন হওয়ার সাথে সাথে সব স্ক্রিপ্ট লোড করলে মেইন থ্রেড ব্লক হয়ে সাইট ধীরগতির হয়ে পড়ে।

### নিয়মিত মনিটরিং ও টেস্ট

স্বয়ংক্রিয় সিআই পাইপলাইনে নিয়মিত পারফরম্যান্স অডিট চালিয়ে মোবাইল ফার্স্ট কনটেন্টফুল পেইন্ট (FCP) এবং লার্জেস্ট কনটেন্টফুল পেইন্ট (LCP) সর্বদা গ্রিন জোনে রাখুন।`,
    tags: ["AdSense", "Performance", "SEO", "Web Vitals"],
    status: "published",
    published_at: "2026-07-15T09:00:00Z",
    read_time_minutes: 4,
    author: {
      name: "Reverse Cloud Engineering",
      role_en: "Frontend Performance & AdTech",
      role_bn: "ফ্রন্টএন্ড পারফরম্যান্স ও অ্যাডটেক",
    },
  },
];

export async function getBlogPosts(): Promise<BlogPostItem[]> {
  const env = getPublicSupabaseEnv();
  if (env) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return (data as DbBlogRow[]).map((row) => {
          const fallback = BLOG_CATALOG.find((b) => b.slug === row.slug);
          return {
            id: row.id,
            slug: row.slug,
            title_en: row.title_en || fallback?.title_en || "Untitled Article",
            title_bn: row.title_bn || fallback?.title_bn || row.title_en || "নিবন্ধ",
            excerpt_en: row.excerpt_en || fallback?.excerpt_en || "",
            excerpt_bn: row.excerpt_bn || fallback?.excerpt_bn || row.excerpt_en || "",
            body_en: row.body_en || fallback?.body_en || "",
            body_bn: row.body_bn || fallback?.body_bn || row.body_en || "",
            cover_path: row.cover_path,
            tags: row.tags || fallback?.tags || ["Engineering"],
            status: row.status,
            published_at: row.published_at || row.created_at,
            read_time_minutes: fallback?.read_time_minutes || 5,
            author: fallback?.author || {
              name: "Reverse Cloud Team",
              role_en: "Engineering Staff",
              role_bn: "ইঞ্জিনিয়ারিং টিম",
            },
          };
        });
      }
    } catch {
      // Fallback to built-in catalog
    }
  }

  return BLOG_CATALOG;
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPostItem | null> {
  const env = getPublicSupabaseEnv();
  let dbRow: DbBlogRow | null = null;

  if (env) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (!error && data) {
        dbRow = data as DbBlogRow;
      }
    } catch {
      // Fallback
    }
  }

  const fallback = BLOG_CATALOG.find((b) => b.slug === slug);

  if (!dbRow && !fallback) {
    return null;
  }

  if (!dbRow) {
    return fallback!;
  }

  return {
    id: dbRow.id,
    slug: dbRow.slug,
    title_en: dbRow.title_en || fallback?.title_en || "Untitled",
    title_bn: dbRow.title_bn || fallback?.title_bn || dbRow.title_en || "",
    excerpt_en: dbRow.excerpt_en || fallback?.excerpt_en || "",
    excerpt_bn: dbRow.excerpt_bn || fallback?.excerpt_bn || dbRow.excerpt_en || "",
    body_en: dbRow.body_en || fallback?.body_en || "",
    body_bn: dbRow.body_bn || fallback?.body_bn || dbRow.body_en || "",
    cover_path: dbRow.cover_path,
    tags: dbRow.tags || fallback?.tags || ["Engineering"],
    status: dbRow.status,
    published_at: dbRow.published_at || dbRow.created_at,
    read_time_minutes: fallback?.read_time_minutes || 5,
    author: fallback?.author || {
      name: "Reverse Cloud Team",
      role_en: "Engineering Staff",
      role_bn: "ইঞ্জিনিয়ারিং টিম",
    },
  };
}

export function getAllBlogSlugs(): string[] {
  return BLOG_CATALOG.map((b) => b.slug);
}
