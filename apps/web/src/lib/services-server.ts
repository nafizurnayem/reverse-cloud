import "server-only";
import { getPublicSupabaseEnv } from "./supabase/env";
import { createClient } from "./supabase/server";
import {
  SERVICES_CATALOG,
  ServiceDetailItem,
  PricingModel,
} from "./services-catalog";

export interface ServiceGroupNavItem {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  services: Array<{ slug: string; name: string; icon: string | null }>;
}

export async function getPublishedServiceGroups(locale: string): Promise<ServiceGroupNavItem[]> {
  const isBn = locale === "bn";
  if (!getPublicSupabaseEnv()) return [];
  try {
    const supabase = await createClient();
    const { data: groups, error: ge } = await supabase
      .from("service_groups")
      .select("id, slug, name_en, name_bn, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    if (ge || !groups?.length) return [];

    const { data: members, error: me } = await supabase
      .from("service_group_members")
      .select("group_id, sort_order, services(slug, name_en, name_bn, icon)")
      .order("sort_order");
    if (me) {
      return groups.map((g) => ({
        id: g.id,
        slug: g.slug,
        name: (isBn ? (g as { name_bn?: string | null }).name_bn : null) || g.name_en,
        sort_order: g.sort_order,
        services: [],
      }));
    }

    type SvcItem = { slug: string; name_en: string; name_bn: string | null; icon: string | null };
    type MemberRow = {
      group_id: string;
      sort_order: number;
      services: SvcItem | SvcItem[] | null;
    };
    const memberRows = (members ?? []) as unknown as MemberRow[];

    return groups.map((g) => {
      const svcMembers = memberRows
        .filter((m) => m.group_id === g.id && m.services)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => {
          const s = Array.isArray(m.services) ? m.services[0] : m.services;
          if (!s) return null;
          return {
            slug: s.slug,
            name: (isBn ? s.name_bn : null) || s.name_en,
            icon: s.icon,
          };
        })
        .filter((s): s is NonNullable<typeof s> => Boolean(s));
      return {
        id: g.id,
        slug: g.slug,
        name: (isBn ? (g as { name_bn?: string | null }).name_bn : null) || g.name_en,
        sort_order: g.sort_order,
        services: svcMembers,
      };
    });
  } catch {
    return [];
  }
}

interface DbServiceRow {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string | null;
  summary_en: string | null;
  summary_bn: string | null;
  body_en: string | null;
  body_bn: string | null;
  icon: string | null;
  pricing_model: string;
  starting_from_usd: number | null;
  sort_order: number;
}

interface DbFaqRow {
  id: string;
  service_id: string | null;
  question_en: string;
  question_bn: string | null;
  answer_en: string;
  answer_bn: string | null;
}

export async function getPublishedServices(): Promise<ServiceDetailItem[]> {
  if (getPublicSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("services")
        .select("id,slug,name_en,name_bn,summary_en,summary_bn,body_en,body_bn,icon,pricing_model,starting_from_usd,sort_order")
        .eq("is_published", true)
        .is("archived_at", null)
        .order("sort_order");

      if (!error && data?.length) {
        return (data as DbServiceRow[]).map((row) => {
          const fallback = SERVICES_CATALOG.find((item) => item.slug === row.slug);
          return {
            ...fallback,
            id: row.id,
            slug: row.slug,
            name_en: row.name_en,
            name_bn: row.name_bn || fallback?.name_bn || row.name_en,
            summary_en: row.summary_en || fallback?.summary_en || "",
            summary_bn: row.summary_bn || fallback?.summary_bn || row.summary_en || "",
            body_en: row.body_en || fallback?.body_en || "",
            body_bn: row.body_bn || fallback?.body_bn || row.body_en || "",
            pricing_model: row.pricing_model as PricingModel,
            starting_from_usd: row.starting_from_usd === null ? null : Number(row.starting_from_usd),
            sort_order: row.sort_order,
            icon: row.icon || fallback?.icon || "Globe",
            deliverables_en: fallback?.deliverables_en || [],
            deliverables_bn: fallback?.deliverables_bn || [],
            process_en: fallback?.process_en || [],
            process_bn: fallback?.process_bn || [],
            tech_stack: fallback?.tech_stack || [],
            faqs_en: fallback?.faqs_en || [],
            faqs_bn: fallback?.faqs_bn || [],
          };
        });
      }
    } catch {
      // Supabase unavailable; use the built-in catalog.
    }
  }

  return SERVICES_CATALOG;
}

export async function getServiceBySlug(slug: string): Promise<ServiceDetailItem | null> {
  // 1. Try fetching from Supabase if configured and published
  const env = getPublicSupabaseEnv();
  let dbService: DbServiceRow | null = null;
  let dbFaqs: DbFaqRow[] = [];

  if (env) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .is("archived_at", null)
        .maybeSingle();

      if (!error && data) {
        dbService = data as DbServiceRow;

        // Fetch service-specific published FAQs
        const { data: faqsData } = await supabase
          .from("faqs")
          .select("*")
          .eq("service_id", data.id)
          .eq("is_published", true)
          .order("sort_order");

        if (faqsData) {
          dbFaqs = faqsData as DbFaqRow[];
        }
      }
    } catch {
      // Supabase unavailable or table empty; fall through to catalog fallback
    }
  }

  // 2. Find in local catalog
  const catalogItem = SERVICES_CATALOG.find((item) => item.slug === slug);

  if (!dbService && !catalogItem) {
    return null;
  }

  // If we only have catalog item (database not seeded or service not published yet):
  if (!dbService) {
    return catalogItem!;
  }

  // If we have database record, merge it over catalog item for real-time editorial updates
  const base = catalogItem || {
    slug: dbService.slug,
    name_en: dbService.name_en,
    name_bn: dbService.name_bn || dbService.name_en,
    pricing_model: dbService.pricing_model || "custom",
    starting_from_usd: dbService.starting_from_usd ? Number(dbService.starting_from_usd) : null,
    sort_order: dbService.sort_order || 0,
    icon: dbService.icon || "Globe",
    summary_en: dbService.summary_en || "",
    summary_bn: dbService.summary_bn || dbService.summary_en || "",
    body_en: dbService.body_en || "",
    body_bn: dbService.body_bn || dbService.body_en || "",
    deliverables_en: [],
    deliverables_bn: [],
    process_en: [],
    process_bn: [],
    tech_stack: [],
    faqs_en: [],
    faqs_bn: [],
  };

  const mergedFaqsEn = dbFaqs.length > 0
    ? dbFaqs.map((f) => ({ question: f.question_en, answer: f.answer_en }))
    : base.faqs_en;

  const mergedFaqsBn = dbFaqs.length > 0
    ? dbFaqs.map((f) => ({
        question: f.question_bn || f.question_en,
        answer: f.answer_bn || f.answer_en,
      }))
    : base.faqs_bn;

  return {
    ...base,
    id: dbService.id,
    name_en: dbService.name_en || base.name_en,
    name_bn: dbService.name_bn || base.name_bn,
    summary_en: dbService.summary_en || base.summary_en,
    summary_bn: dbService.summary_bn || base.summary_bn,
    body_en: dbService.body_en || base.body_en,
    body_bn: dbService.body_bn || base.body_bn,
    pricing_model: (dbService.pricing_model as PricingModel) || base.pricing_model,
    starting_from_usd: dbService.starting_from_usd !== null ? Number(dbService.starting_from_usd) : base.starting_from_usd,
    icon: dbService.icon || base.icon,
    faqs_en: mergedFaqsEn,
    faqs_bn: mergedFaqsBn,
  };
}
