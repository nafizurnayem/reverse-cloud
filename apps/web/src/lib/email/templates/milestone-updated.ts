import { wrapEmailLayout } from "../layout";
import type { MilestoneUpdatedEmailContext, RenderedEmail } from "../types";

export function renderMilestoneUpdatedEmail(
  context: MilestoneUpdatedEmailContext,
): RenderedEmail {
  const locale = context.locale ?? "en";
  const isBn = locale === "bn";
  const isCompleted = context.status === "completed" || context.progressPercent === 100;

  const subject = isBn
    ? isCompleted
      ? `মাইলফলক সম্পন্ন হয়েছে: ${context.milestoneTitle}`
      : `মাইলফলক আপডেট: ${context.milestoneTitle} (${context.progressPercent}%)`
    : isCompleted
    ? `Milestone Completed: ${context.milestoneTitle}`
    : `Milestone Progress Update: ${context.milestoneTitle} (${context.progressPercent}%)`;

  const heading = isBn
    ? isCompleted
      ? "একটি মাইলফলক সফলভাবে সম্পন্ন হয়েছে!"
      : "আপনার প্রজেক্টের নতুন অগ্রগতি আপডেট"
    : isCompleted
    ? "Milestone Delivery Completed!"
    : "Project Milestone Progress Update";

  const preheader = isBn
    ? `${context.projectTitle} - ${context.milestoneTitle} এখন ${context.progressPercent}% সম্পন্ন।`
    : `${context.projectTitle} - ${context.milestoneTitle} is now at ${context.progressPercent}%.`;

  const statusBadge = isCompleted
    ? `<div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
         <span style="color: #059669; font-weight: 700; font-size: 13px;">✓ ${isBn ? "সম্পন্ন মাইলফলক" : "COMPLETED MILESTONE"}</span>
         <p style="margin: 4px 0 0 0; color: #065f46; font-size: 13px;">${context.milestoneTitle} (100%)</p>
       </div>`
    : `<div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
         <span style="color: #0284c7; font-weight: 700; font-size: 13px;">● ${isBn ? "চলমান পর্যায়" : "PROGRESS UPDATE"}</span>
         <p style="margin: 4px 0 0 0; color: #0369a1; font-size: 13px;">${context.milestoneTitle} — <strong>${context.progressPercent}%</strong></p>
       </div>`;

  const bodyHtml = isBn
    ? `<p>প্রিয় <strong>${context.recipientName}</strong>,</p>
       <p>আপনার <strong>${context.projectTitle}</strong> প্রজেক্টে একটি নতুন মাইলফলক আপডেট রেকর্ড করা হয়েছে:</p>
       ${statusBadge}
       <p>আপনি ক্লায়েন্ট পোর্টালে লগইন করে বিস্তারিত কোড ডেলিভারি, স্টেজিং প্রিভিউ এবং কাজের অগ্রগতি সরাসরি যাচাই করতে পারেন।</p>`
    : `<p>Hello <strong>${context.recipientName}</strong>,</p>
       <p>A milestone update has been recorded for your project <strong>${context.projectTitle}</strong>:</p>
       ${statusBadge}
       <p>You can review staging sandbox previews and updated timelines directly in your client portal.</p>`;

  const bodyText = isBn
    ? `প্রিয় ${context.recipientName},\n\nপ্রজেক্ট: ${context.projectTitle}\nমাইলফলক: ${context.milestoneTitle}\nঅগ্রগতি: ${context.progressPercent}%\nস্ট্যাটাস: ${isCompleted ? "সম্পন্ন" : "চলমান"}\n\nবিস্তারিত দেখতে পোর্টালে প্রবেশ করুন।`
    : `Hello ${context.recipientName},\n\nProject: ${context.projectTitle}\nMilestone: ${context.milestoneTitle}\nProgress: ${context.progressPercent}%\nStatus: ${isCompleted ? "Completed" : "In Progress"}\n\nReview updates directly in your portal.`;

  const ctaText = isBn ? "মাইলফলক টাইমলাইন দেখুন" : "View Milestone Timeline";

  const { html, text } = wrapEmailLayout({
    locale,
    preheader,
    heading,
    bodyHtml,
    bodyText,
    ctaText,
    ctaUrl: context.portalUrl,
  });

  return { subject, html, text };
}
