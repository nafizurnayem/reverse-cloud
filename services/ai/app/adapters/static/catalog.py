"""Small offline service catalog fallback.

Supabase is authoritative. This fallback only keeps local development usable when
the database is unavailable or has no published services.
"""

from ...ports.catalog import ServiceCatalogItem


_SERVICES = (
    ("website-development", "Website Development", "ওয়েবসাইট ডেভেলপমেন্ট", "fixed", 1200, "Modern, fast web platforms.", "আধুনিক ও দ্রুত ওয়েব প্ল্যাটফর্ম।"),
    ("ai-automation", "AI Automation", "এআই অটোমেশন", "fixed", 1500, "Production workflow and document automation.", "প্রোডাকশন ওয়ার্কফ্লো ও ডকুমেন্ট অটোমেশন।"),
    ("ai-chatbots-agents", "AI Chatbots & Agents", "এআই চ্যাটবট ও এজেন্ট", "fixed", 1800, "Guardrailed agents with RAG and tool execution.", "RAG ও টুল এক্সিকিউশনসহ নিয়ন্ত্রিত এআই এজেন্ট।"),
    ("ui-ux-design", "UI/UX Design", "ইউআই/ইউএক্স ডিজাইন", "fixed", 900, "Accessible product design and prototypes.", "অ্যাক্সেসিবল প্রোডাক্ট ডিজাইন ও প্রোটোটাইপ।"),
    ("software-development", "Software Development", "সফটওয়্যার ডেভেলপমেন্ট", "fixed", 2500, "Reliable custom software and APIs.", "নির্ভরযোগ্য কাস্টম সফটওয়্যার ও এপিআই।"),
    ("system-management", "System Management", "সিস্টেম ম্যানেজমেন্ট", "retainer", 800, "Cloud operations, monitoring, and recovery.", "ক্লাউড অপারেশন, মনিটরিং ও রিকভারি।"),
    ("system-architecture-design", "System Architecture Design", "সিস্টেম আর্কিটেকচার ডিজাইন", "custom", 2000, "Scalable system and cloud architecture.", "স্কেলেবল সিস্টেম ও ক্লাউড আর্কিটেকচার।"),
    ("marketing", "Digital Marketing & Growth", "ডিজিটাল মার্কেটিং ও গ্রোথ", "retainer", 750, "SEO and performance growth campaigns.", "এসইও ও পারফরম্যান্স গ্রোথ ক্যাম্পেইন।"),
    ("crm-integration", "CRM Integration", "সিআরএম ইন্টিগ্রেশন", "fixed", 1100, "CRM and communication integrations.", "সিআরএম ও যোগাযোগ ইন্টিগ্রেশন।"),
    ("adsense-services", "AdSense Services", "অ্যাডসেন্স সেবা", "retainer", 600, "Monetization and policy-safe optimization.", "মনিটাইজেশন ও নীতিমালা-সম্মত অপটিমাইজেশন।"),
    ("saas-development", "SaaS Development", "স্যাস ডেভেলপমেন্ট", "custom", 3500, "Multi-tenant SaaS product development.", "মাল্টি-টেন্যান্ট SaaS প্রোডাক্ট ডেভেলপমেন্ট।"),
)


def static_services(locale: str) -> list[ServiceCatalogItem]:
    is_bn = locale == "bn"
    return [
            ServiceCatalogItem(
                slug=slug,
                name=name_bn if is_bn else name_en,
                pricing_model=pricing_model,
                starting_from_usd=float(starting_from_usd),
                summary=summary_bn if is_bn else summary_en,
            )
            for slug, name_en, name_bn, pricing_model, starting_from_usd, summary_en, summary_bn in _SERVICES
    ]


class StaticCatalogRepository:
    async def list_published_services(self, locale: str) -> list[ServiceCatalogItem]:
        return static_services(locale)
