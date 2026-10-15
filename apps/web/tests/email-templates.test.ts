import { describe, expect, it } from "vitest";
import {
  renderDeliveredEmail,
  renderEmail,
  renderInviteEmail,
  renderMilestoneUpdatedEmail,
  renderPaymentDueEmail,
  renderProjectActivatedEmail,
} from "../src/lib/email";

describe("Transactional Email Templates (Wave 3 / Task 3.7)", () => {
  describe("English Templates", () => {
    it("renders invite template in English", () => {
      const email = renderInviteEmail({
        recipientName: "Rahim Chowdhury",
        inviteUrl: "https://revcloud.dev/en/portal/invite?token=xyz",
        expiresInHours: 48,
        locale: "en",
      });

      expect(email.subject).toContain("Invitation: Access your Reverse Cloud Client Portal");
      expect(email.html).toContain("Rahim Chowdhury");
      expect(email.html).toContain("https://revcloud.dev/en/portal/invite?token=xyz");
      expect(email.text).toContain("48 hours");
      expect(email.html).not.toContain("undefined");
    });

    it("renders project activated template in English", () => {
      const email = renderProjectActivatedEmail({
        recipientName: "Rahim Chowdhury",
        projectTitle: "Fintech Cloud Migration",
        portalUrl: "https://revcloud.dev/en/portal/projects/proj-1",
        leadArchitect: "Miraj Hossain",
        locale: "en",
      });

      expect(email.subject).toContain("Project Activated: Fintech Cloud Migration");
      expect(email.html).toContain("Miraj Hossain");
      expect(email.text).toContain("Fintech Cloud Migration");
      expect(email.html).not.toContain("undefined");
    });

    it("renders milestone updated template in English", () => {
      const email = renderMilestoneUpdatedEmail({
        recipientName: "Rahim Chowdhury",
        projectTitle: "Fintech Cloud Migration",
        milestoneTitle: "Database CDC Migration",
        progressPercent: 75,
        status: "in_progress",
        portalUrl: "https://revcloud.dev/en/portal/projects/proj-1",
        locale: "en",
      });

      expect(email.subject).toContain("Database CDC Migration (75%)");
      expect(email.html).toContain("75%");
      expect(email.html).not.toContain("undefined");
    });

    it("renders payment due template in English with USD/BDT amounts", () => {
      const email = renderPaymentDueEmail({
        recipientName: "Rahim Chowdhury",
        projectTitle: "Fintech Cloud Migration",
        milestoneTitle: "Milestone 2: Database Migration",
        amountUsd: 5075,
        amountBdt: 609000,
        dueDate: "2026-10-31",
        invoiceNumber: "INV-2026-1031",
        invoiceUrl: "https://revcloud.dev/en/portal/projects/proj-1",
        locale: "en",
      });

      expect(email.subject).toContain("INV-2026-1031");
      expect(email.html).toContain("$5,075");
      expect(email.html).toContain("৬,০৯,০০০");
      expect(email.html).not.toContain("undefined");
    });

    it("renders delivered template in English with warranty", () => {
      const email = renderDeliveredEmail({
        recipientName: "Rahim Chowdhury",
        projectTitle: "Fintech Cloud Migration",
        portalUrl: "https://revcloud.dev/en/portal/projects/proj-1",
        warrantyDays: 60,
        locale: "en",
      });

      expect(email.subject).toContain("Project Delivered & Handed Over");
      expect(email.html).toContain("60 days");
      expect(email.html).not.toContain("undefined");
    });
  });

  describe("Bangla Templates & Quality Review", () => {
    it("renders invite template in Bangla", () => {
      const email = renderInviteEmail({
        recipientName: "রহিম চৌধুরী",
        inviteUrl: "https://revcloud.dev/bn/portal/invite?token=xyz",
        expiresInHours: 48,
        locale: "bn",
      });

      expect(email.subject).toContain("ক্লায়েন্ট পোর্টালে আপনার আমন্ত্রণ");
      expect(email.html).toContain("রহিম চৌধুরী");
      expect(email.html).toContain("৪৮ ঘণ্টার");
      expect(email.text).toContain("মাইলফলক অগ্রগতি");
      expect(email.html).not.toContain("undefined");
    });

    it("renders project activated template in Bangla", () => {
      const email = renderProjectActivatedEmail({
        recipientName: "রহিম চৌধুরী",
        projectTitle: "ফিনটেক ক্লাউড মাইগ্রেশন",
        portalUrl: "https://revcloud.dev/bn/portal/projects/proj-1",
        leadArchitect: "মিরাজ হোসেন",
        locale: "bn",
      });

      expect(email.subject).toContain("প্রজেক্ট সক্রিয় হয়েছে");
      expect(email.html).toContain("মিরাজ হোসেন");
      expect(email.html).toContain("ফিনটেক ক্লাউড মাইগ্রেশন");
      expect(email.html).not.toContain("undefined");
    });

    it("renders milestone updated template in Bangla", () => {
      const email = renderMilestoneUpdatedEmail({
        recipientName: "রহিম চৌধুরী",
        projectTitle: "ফিনটেক ক্লাউড মাইগ্রেশন",
        milestoneTitle: "ডাটাবেস মাইগ্রেশন",
        progressPercent: 100,
        status: "completed",
        portalUrl: "https://revcloud.dev/bn/portal/projects/proj-1",
        locale: "bn",
      });

      expect(email.subject).toContain("মাইলফলক সম্পন্ন হয়েছে");
      expect(email.html).toContain("ডাটাবেস মাইগ্রেশন");
      expect(email.html).not.toContain("undefined");
    });

    it("renders payment due template in Bangla with BDT amounts", () => {
      const email = renderPaymentDueEmail({
        recipientName: "রহিম চৌধুরী",
        projectTitle: "ফিনটেক ক্লাউড মাইগ্রেশন",
        milestoneTitle: "মাইলফলক ২: ডাটাবেস মাইগ্রেশন",
        amountUsd: 5075,
        amountBdt: 609000,
        dueDate: "২০২৬-১০-৩১",
        invoiceNumber: "INV-2026-1031",
        invoiceUrl: "https://revcloud.dev/bn/portal/projects/proj-1",
        locale: "bn",
      });

      expect(email.subject).toContain("ইনভয়েস প্রদেয়");
      expect(email.html).toContain("INV-2026-1031");
      expect(email.html).toContain("$5,075");
      expect(email.html).not.toContain("undefined");
    });

    it("renders delivered template in Bangla with warranty", () => {
      const email = renderDeliveredEmail({
        recipientName: "রহিম চৌধুরী",
        projectTitle: "ফিনটেক ক্লাউড মাইগ্রেশন",
        portalUrl: "https://revcloud.dev/bn/portal/projects/proj-1",
        warrantyDays: 60,
        locale: "bn",
      });

      expect(email.subject).toContain("প্রজেক্ট সফলভাবে সমাপ্ত ও হস্তান্তরিত");
      expect(email.html).toContain("৬০ দিন");
      expect(email.html).not.toContain("undefined");
    });

    it("works through the universal renderEmail dispatcher", () => {
      const email = renderEmail("invite", {
        recipientName: "Test User",
        inviteUrl: "https://revcloud.dev/invite",
        locale: "en",
      });
      expect(email.subject).toBeDefined();
      expect(email.html.length).toBeGreaterThan(100);
      expect(email.text.length).toBeGreaterThan(50);
    });

    it("escapes dynamic HTML and rejects unsafe CTA URLs", () => {
      const email = renderInviteEmail({
        recipientName: '<img src=x onerror="alert(1)">',
        inviteUrl: "javascript:alert(1)",
        locale: "en",
      });

      expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
      expect(email.html).not.toContain("<img src=x");
      expect(email.html).not.toContain("javascript:");
      expect(email.text).not.toContain("javascript:");
      expect(email.text).toContain("336 hours");
    });

    it("sanitizes subject control characters and clamps percentages", () => {
      const email = renderMilestoneUpdatedEmail({
        recipientName: "Client",
        projectTitle: "Project",
        milestoneTitle: "Build\r\nBcc: attacker@example.com",
        progressPercent: 900,
        status: "in_progress",
        portalUrl: "https://revcloud.dev/en/portal",
        locale: "en",
      });

      expect(email.subject).not.toMatch(/[\r\n]/);
      expect(email.html).toContain("100%");
    });
  });
});
