import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  calculateTopServices,
  FALLBACK_WIZARD_QUESTIONS,
} from "../src/lib/wizard-engine";
import { getWizardQuestions } from "../src/lib/wizard-server";


describe("Wizard Engine", () => {
  it("verifies fallback questions have valid keys, options, and service weights", () => {
    expect(FALLBACK_WIZARD_QUESTIONS.length).toBeGreaterThanOrEqual(4);

    for (const q of FALLBACK_WIZARD_QUESTIONS) {
      expect(q.key.trim().length).toBeGreaterThan(0);
      expect(q.text_en.trim().length).toBeGreaterThan(0);
      expect(q.text_bn.trim().length).toBeGreaterThan(0);
      expect(["single", "multi"]).toContain(q.kind);
      expect(q.options.length).toBeGreaterThanOrEqual(2);

      for (const opt of q.options) {
        expect(opt.id.trim().length).toBeGreaterThan(0);
        expect(opt.label_en.trim().length).toBeGreaterThan(0);
        expect(opt.label_bn.trim().length).toBeGreaterThan(0);
        expect(Object.keys(opt.scores).length).toBeGreaterThan(0);
      }
    }
  });

  it("calculates top 3 services correctly for web development preferences", () => {
    const answers = {
      primary_goal: ["opt-1-1"], // Web development
      core_priority: ["opt-2-1"], // UI/UX design
      integrations: ["opt-3-1"], // Localization
      delivery_model: ["opt-4-1"], // Fixed scope
    };

    const results = calculateTopServices(answers);
    expect(results).toHaveLength(3);

    const topSlugs = results.map((r) => r.service.slug);
    expect(topSlugs).toContain("website-development");
    expect(topSlugs).toContain("ui-ux-design");
    expect(results[0].matchPercentage).toBe(100);
  });

  it("calculates top 3 services correctly for AI chatbot and automation goals", () => {
    const answers = {
      primary_goal: ["opt-1-2"], // AI chatbots
      core_priority: ["opt-2-2"], // CRM integration
      integrations: ["opt-3-2"], // Postgres RLS
      delivery_model: ["opt-4-1"], // Fixed scope
    };

    const results = calculateTopServices(answers);
    expect(results).toHaveLength(3);

    const topSlugs = results.map((r) => r.service.slug);
    expect(topSlugs).toContain("ai-chatbots-agents");
    expect(results[0].service.slug).toBe("ai-chatbots-agents");
  });

  it("retrieves questions via fallback when Supabase is unconfigured", async () => {
    const questions = await getWizardQuestions();
    expect(questions.length).toBeGreaterThanOrEqual(4);
    expect(questions[0].key).toBe("primary_goal");
  });
});
