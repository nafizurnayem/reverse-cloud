"""Services catalog tool for Reverse Cloud AI agent.

Provides structured information on Reverse Cloud's 11 service offerings,
mirroring apps/web/src/lib/services-catalog.ts.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic_ai import RunContext

from ..agents.deps import AgentDeps

SERVICES_DATA: list[dict[str, Any]] = [
    {
        "slug": "website-development",
        "name_en": "Website Development",
        "name_bn": "ওয়েবসাইট ডেভেলপমেন্ট",
        "pricing_model": "fixed",
        "starting_from_usd": 1200,
        "summary_en": "Modern, high-converting, and blazing-fast web platforms engineered with Next.js App Router, React 19, TypeScript, and clean responsive CSS.",
        "summary_bn": "Next.js অ্যাপ রাউটার, React 19, TypeScript ও পরিচ্ছন্ন রেসপনসিভ CSS দিয়ে তৈরি আধুনিক, দ্রুতগতির এবং উচ্চ রূপান্তরক্ষম ওয়েব প্ল্যাটফর্ম।",
    },
    {
        "slug": "ai-automation",
        "name_en": "AI Automation",
        "name_bn": "এআই অটোমেশন",
        "pricing_model": "fixed",
        "starting_from_usd": 1500,
        "summary_en": "Streamline operations by automating repetitive workflows, unstructured data ingestion, and document processing with production AI agents.",
        "summary_bn": "প্রোডাকশন এআই এজেন্টের সাহায্যে পুনরাবৃত্তিমূলক কাজ, জটিল ডেটা নিষ্কাশন এবং ডকুমেন্ট প্রসেসিং সম্পূর্ণ স্বয়ংক্রিয় করুন।",
    },
    {
        "slug": "ai-chatbots-agents",
        "name_en": "AI Chatbots & Agents",
        "name_bn": "এআই চ্যাটবট ও এজেন্ট",
        "pricing_model": "fixed",
        "starting_from_usd": 1800,
        "summary_en": "Enterprise conversational agents equipped with domain retrieval (RAG), multi-step tool execution, and guardrailed contextual memory.",
        "summary_bn": "ডোমেন রিট্রিভাল (RAG), মাল্টি-স্টেপ টুল এক্সিকিউশন এবং নিয়ন্ত্রিত মেমরি সম্পন্ন বুদ্ধিমান এন্টারপ্রাইজ চ্যাটবট ও এজেন্ট।",
    },
    {
        "slug": "ui-ux-design",
        "name_en": "UI/UX Design",
        "name_bn": "ইউআই/ইউএক্স ডিজাইন",
        "pricing_model": "fixed",
        "starting_from_usd": 900,
        "summary_en": "Intuitive, accessible, and polished digital experiences with custom design systems, atomic components, and interactive prototypes.",
        "summary_bn": "সহজবোধ্য ও দৃষ্টিনন্দন ডিজিটাল অভিজ্ঞতা, পরিচ্ছন্ন ডিজাইন সিস্টেম এবং ইন্টারঅ্যাক্টিভ প্রোটোটাইপ।",
    },
    {
        "slug": "software-development",
        "name_en": "Software Development",
        "name_bn": "সফটওয়্যার ডেভেলপমেন্ট",
        "pricing_model": "fixed",
        "starting_from_usd": 2500,
        "summary_en": "Bespoke backend architectures, microservices, high-throughput APIs, and custom software designed for reliability and scalability.",
        "summary_bn": "কাস্টম ব্যাকএন্ড আর্কিটেকচার, মাইক্রোসার্ভিসেস, উচ্চগতির এপিআই এবং দীর্ঘমেয়াদী স্কেলেবল সফটওয়্যার সমাধান।",
    },
    {
        "slug": "system-management",
        "name_en": "System Management",
        "name_bn": "সিস্টেম ম্যানেজমেন্ট",
        "pricing_model": "retainer",
        "starting_from_usd": 800,
        "summary_en": "Reliable 24/7 cloud server administration, uptime monitoring, container maintenance, security hardening, and disaster recovery.",
        "summary_bn": "২৪/৭ নির্ভরযোগ্য ক্লাউড সার্ভার অ্যাডমিনিস্ট্রেশন, আপটাইম মনিটরিং, সিকিউরিটি প্যাচিং এবং ব্যাকআপ ব্যবস্থাপনা।",
    },
    {
        "slug": "system-architecture-design",
        "name_en": "System Architecture Design",
        "name_bn": "সিস্টেম আর্কিটেকচার ডিজাইন",
        "pricing_model": "custom",
        "starting_from_usd": 2000,
        "summary_en": "Enterprise technical roadmaps, high-availability multi-region design, data modeling, and cost-efficient cloud topology.",
        "summary_bn": "উচ্চ ট্র্যাফিক ও স্কেলেবিলিটির জন্য এন্টারপ্রাইজ সিস্টেম আর্কিটেকচার, ক্লাউড টপোলজি এবং ডেটাবেস মডেলিং।",
    },
    {
        "slug": "digital-marketing-growth",
        "name_en": "Digital Marketing & Growth",
        "name_bn": "ডিজিটাল মার্কেটিং ও গ্রোথ",
        "pricing_model": "retainer",
        "starting_from_usd": 750,
        "summary_en": "Data-driven performance marketing, technical SEO enhancements, conversion rate optimization, and localized search presence.",
        "summary_bn": "ডেটা-চালিত পারফরম্যান্স মার্কেটিং, টেকনিক্যাল এসইও, কনভার্সন অপটিমাইজেশন এবং সুনির্দিষ্ট গ্রোথ ক্যাম্পেইন।",
    },
    {
        "slug": "crm-integration",
        "name_en": "CRM Integration",
        "name_bn": "সিআরএম ইন্টিগ্রেশন",
        "pricing_model": "fixed",
        "starting_from_usd": 1100,
        "summary_en": "Connect your lead forms, customer portals, and communication channels directly with HubSpot, Salesforce, or custom Postgres CRMs.",
        "summary_bn": "আপনার লিড ফর্ম, কাস্টমার পোর্টাল এবং কমিউনিকেশন চ্যানেলগুলোকে HubSpot, Salesforce বা নিজস্ব CRM-এর সাথে স্বয়ংক্রিয়ভাবে যুক্ত করুন।",
    },
    {
        "slug": "adsense-monetization",
        "name_en": "AdSense Monetization & Optimization",
        "name_bn": "অ্যাডসেন্স মনিটাইজেশন ও অপটিমাইজেশন",
        "pricing_model": "custom",
        "starting_from_usd": 600,
        "summary_en": "Maximize digital ad yield while safeguarding Core Web Vitals, user engagement metrics, and Google policy compliance.",
        "summary_bn": "কোর ওয়েব ভাইটালস ও ইউজার এনগেজমেন্ট বজায় রেখে অ্যাডসেন্স ও ডিসপ্লে বিজ্ঞাপন থেকে সর্বোচ্চ আয় নিশ্চিতকরণ।",
    },
    {
        "slug": "saas-development",
        "name_en": "SaaS Development",
        "name_bn": "স্যাস ডেভেলপমেন্ট",
        "pricing_model": "custom",
        "starting_from_usd": 3500,
        "summary_en": "Full-cycle Software-as-a-Service architecture: multi-tenancy, subscription billing, RBAC permissions, and high-converting onboarding.",
        "summary_bn": "পূর্ণাঙ্গ সফটওয়্যার-অ্যাজ-আ-সার্ভিস (SaaS) প্ল্যাটফর্ম: মাল্টি-টেন্যান্সি, বিলিং, সাবস্ক্রিপশন ও রোল-ভিত্তিক পারমিশন।",
    },
]


def get_services_catalog(locale: str = "en") -> list[dict[str, Any]]:
    """Return catalog formatted for the specified locale ('en' or 'bn')."""
    is_bn = locale == "bn"
    catalog = []
    for s in SERVICES_DATA:
        catalog.append(
            {
                "slug": s["slug"],
                "name": s["name_bn"] if is_bn else s["name_en"],
                "pricing_model": s["pricing_model"],
                "starting_from_usd": s["starting_from_usd"],
                "summary": s["summary_bn"] if is_bn else s["summary_en"],
            }
        )
    return catalog


async def list_services(
    ctx: RunContext[AgentDeps],
    locale: Literal["en", "bn"] | None = None,
) -> list[dict[str, Any]]:
    """List Reverse Cloud's 11 service offerings with starting prices and summaries.

    Args:
        ctx: Agent run context containing locale and runtime dependencies.
        locale: Optional override for language ('en' or 'bn').

    Returns:
        List of services with slug, localized name, pricing model, starting price, and summary.
    """
    effective_locale = locale or ctx.deps.locale
    return get_services_catalog(effective_locale)
