import "server-only";
import { getPublicSupabaseEnv } from "./supabase/env";
import { createClient } from "./supabase/server";
import { FALLBACK_WIZARD_QUESTIONS, WizardQuestion } from "./wizard-engine";

export async function getWizardQuestions(): Promise<WizardQuestion[]> {
  const env = getPublicSupabaseEnv();

  if (env) {
    try {
      const supabase = await createClient();

      const { data: questionsData, error: qError } = await supabase
        .from("wizard_questions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (!qError && questionsData && questionsData.length > 0) {
        const questionIds = questionsData.map((q) => q.id);

        const { data: optionsData, error: oError } = await supabase
          .from("wizard_options")
          .select("*,wizard_option_scores(*)")
          .in("question_id", questionIds)
          .order("sort_order");

        if (!oError && optionsData && optionsData.length > 0) {
          // Fetch services map for ID -> slug resolution
          const { data: servicesData } = await supabase
            .from("services")
            .select("id,slug");

          const serviceMap = new Map<string, string>();
          (servicesData || []).forEach((s) => serviceMap.set(s.id, s.slug));

          return questionsData.map((q) => {
            const qOptions = optionsData
              .filter((o) => o.question_id === q.id)
              .map((o) => {
                const scoreMap: Record<string, number> = {};
                (o.wizard_option_scores || []).forEach((w: { service_id: string; weight: number }) => {
                  const slug = serviceMap.get(w.service_id);
                  if (slug) {
                    scoreMap[slug] = w.weight;
                  }
                });

                return {
                  id: o.id,
                  label_en: o.label_en,
                  label_bn: o.label_bn || o.label_en,
                  scores: scoreMap,
                };
              });

            return {
              id: q.id,
              key: q.key,
              text_en: q.text_en,
              text_bn: q.text_bn || q.text_en,
              kind: q.kind as "single" | "multi",
              options: qOptions,
            };
          });
        }
      }
    } catch {
      // Fallback
    }
  }

  return FALLBACK_WIZARD_QUESTIONS;
}
