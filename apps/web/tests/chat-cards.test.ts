import { describe, expect, it } from "vitest";
import { formatBdt, formatPriceRange, formatUsd } from "../src/lib/money";
import {
  sampleEstimate,
  sampleHumanHandoff,
  sampleLeadSaved,
} from "../src/lib/chat/mock-stream";

describe("Chat Cards & Money Formatter", () => {
  it("formats USD and BDT correctly", () => {
    const usd = formatUsd(5000);
    expect(usd).toContain("5,000");
    expect(usd).toContain("$");

    const bdt = formatBdt(500000);
    expect(bdt).toBeDefined();

    const range = formatPriceRange(1000, 2000, 100000, 200000);
    expect(range.usd).toContain("1,000");
    expect(range.usd).toContain("2,000");
  });

  it("validates mock card payload structures", () => {
    expect(sampleEstimate.serviceTitle).toBe("Cloud Architecture & Modernization");
    expect(sampleEstimate.deliverables.length).toBeGreaterThan(0);
    expect(sampleEstimate.timelineWeeksMin).toBe(3);

    expect(sampleLeadSaved.email).toContain("@");
    expect(sampleLeadSaved.name).toBe("Rahim Chowdhury");

    expect(sampleHumanHandoff.status).toBe("available");
    expect(sampleHumanHandoff.suggestedAction).toBe("contact_form");
  });
});
