import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ScheduleMeetingType {
  key: string;
  name: string;
  description: string;
  durationMinutes: number;
}

export interface SchedulePrefill {
  isSignedIn: boolean;
  name: string;
  email: string;
  company: string;
  timezone: string;
}

export const FALLBACK_MEETING_TYPES: Record<"en" | "bn", ScheduleMeetingType[]> = {
  en: [
    {
      key: "discovery_call",
      name: "Discovery Call",
      description: "30-minute introductory discussion assessing your project scope, timeline, and deliverables.",
      durationMinutes: 30,
    },
    {
      key: "technical_consult",
      name: "Technical Consult",
      description: "45-minute deep architectural consultation on cloud infrastructure, AI models, and scalability.",
      durationMinutes: 45,
    },
  ],
  bn: [
    {
      key: "discovery_call",
      name: "ডিসকভারি কল",
      description: "আপনার প্রজেক্টের লক্ষ্য, সুযোগ এবং সময়সীমা নিয়ে ৩০ মিনিটের প্রাথমিক আলোচনা।",
      durationMinutes: 30,
    },
    {
      key: "technical_consult",
      name: "টেকনিক্যাল কনসাল্টেশন",
      description: "ক্লাউড আর্কিটেকচার, এআই মডেল এবং সিস্টেম স্কেলিং নিয়ে ৪৫ মিনিটের বিস্তারিত কারিগরি পরামর্শ।",
      durationMinutes: 45,
    },
  ],
};

export async function fetchMeetingTypes(locale: string = "en"): Promise<ScheduleMeetingType[]> {
  const isBn = locale === "bn";
  const fallbacks = FALLBACK_MEETING_TYPES[isBn ? "bn" : "en"];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("meeting_types")
      .select("key, name_en, name_bn, description_en, description_bn, duration_min")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((mt) => ({
        key: mt.key,
        name: (isBn ? mt.name_bn || mt.name_en : mt.name_en) || mt.key,
        description:
          (isBn ? mt.description_bn || mt.description_en : mt.description_en) ||
          fallbacks.find((f) => f.key === mt.key)?.description ||
          "",
        durationMinutes: mt.duration_min,
      }));
    }

    return fallbacks;
  } catch {
    return fallbacks;
  }
}

export async function fetchSignedInClientPrefill(): Promise<SchedulePrefill> {
  try {
    const supabase = await createClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      return {
        isSignedIn: false,
        name: "",
        email: "",
        company: "",
        timezone: "",
      };
    }

    const user = userRes.user;

    const { data: client } = await supabase
      .from("clients")
      .select("full_name, company, email, timezone")
      .eq("user_id", user.id)
      .maybeSingle();

    const name =
      client?.full_name ||
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
      "";

    const email = client?.email || user.email || "";
    const company = client?.company || "";
    const timezone = client?.timezone || "";

    return {
      isSignedIn: true,
      name,
      email,
      company,
      timezone,
    };
  } catch {
    return {
      isSignedIn: false,
      name: "",
      email: "",
      company: "",
      timezone: "",
    };
  }
}
