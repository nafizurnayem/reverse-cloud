import { escapeEmailHtml, safeEmailSubject, wrapEmailLayout } from "../layout";
import type { PaymentDueEmailContext, RenderedEmail } from "../types";
import { formatBdt, formatUsd } from "@/lib/money";

export function renderPaymentDueEmail(
  context: PaymentDueEmailContext,
): RenderedEmail {
  const locale = context.locale ?? "en";
  const isBn = locale === "bn";
  const formattedUsd = formatUsd(Number.isFinite(context.amountUsd) ? Math.max(0, context.amountUsd) : 0);
  const formattedBdt = formatBdt(Number.isFinite(context.amountBdt) ? Math.max(0, context.amountBdt) : 0);
  const recipientName = escapeEmailHtml(context.recipientName);
  const projectTitle = escapeEmailHtml(context.projectTitle);
  const milestoneTitle = escapeEmailHtml(context.milestoneTitle);
  const invoiceNumber = escapeEmailHtml(context.invoiceNumber);
  const dueDate = escapeEmailHtml(context.dueDate);

  const subject = isBn
    ? `ইনভয়েস প্রদেয়: ${context.invoiceNumber} (${context.projectTitle})`
    : `Invoice Due: ${context.invoiceNumber} for ${context.projectTitle}`;

  const heading = isBn ? "মাইলফলক ইনভয়েস প্রস্তুত" : "Milestone Payment Invoice Due";

  const preheader = isBn
    ? `${context.invoiceNumber} নম্বর ইনভয়েস পরিশোধের জন্য প্রস্তুত (${formattedUsd} / ${formattedBdt})।`
    : `Invoice ${context.invoiceNumber} is due for ${context.projectTitle} (${formattedUsd}).`;

  const invoiceBox = `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
      <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b;">${
        isBn ? "ইনভয়েস নম্বর" : "INVOICE NUMBER"
      }: <strong>#${invoiceNumber}</strong></span>
      <span style="font-size: 11px; color: #dc2626; font-weight: 700;">${
        isBn ? "শেষ সময়:" : "DUE:"
      } ${dueDate}</span>
    </div>
    <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #0f172a;">${
      milestoneTitle
    }</p>
    <div style="font-size: 18px; font-weight: 800; color: #0284c7; font-family: monospace;">
      ${formattedUsd} <span style="font-size: 12px; font-weight: 500; color: #64748b;">(≈ ${formattedBdt})</span>
    </div>
  </div>`;

  const bodyHtml = isBn
    ? `<p>প্রিয় <strong>${recipientName}</strong>,</p>
       <p>আপনার <strong>${projectTitle}</strong> প্রজেক্টের সংশ্লিষ্ট মাইলফলক অগ্রগতির ভিত্তিতে নতুন ইনভয়েস তৈরি করা হয়েছে:</p>
       ${invoiceBox}
       <p>ক্লায়েন্ট পোর্টালে ইনভয়েসটির অফিসিয়াল কপি ও বিস্তারিত ব্রেকডাউন ডাউনলোড করতে পারবেন। ব্যাংক ওয়্যার বা অনলাইন পেমেন্টের জন্য পোর্টালে ভিজিট করুন।</p>`
    : `<p>Hello <strong>${recipientName}</strong>,</p>
       <p>An invoice has been issued for milestone delivery on project <strong>${projectTitle}</strong>:</p>
       ${invoiceBox}
       <p>You can review and download the official invoice copy or proceed with wire transfer/online disbursement through your client portal.</p>`;

  const bodyText = isBn
    ? `প্রিয় ${context.recipientName},\n\nপ্রজেক্ট: ${context.projectTitle}\nমাইলফলক: ${context.milestoneTitle}\nইনভয়েস নম্বর: ${context.invoiceNumber}\nপ্রদেয় পরিমাণ: ${formattedUsd} (≈ ${formattedBdt})\nশেষ সময়: ${context.dueDate}\n\nইনভয়েস ডাউনলোড করতে পোর্টালে প্রবেশ করুন।`
    : `Hello ${context.recipientName},\n\nProject: ${context.projectTitle}\nMilestone: ${context.milestoneTitle}\nInvoice Number: ${context.invoiceNumber}\nAmount Due: ${formattedUsd} (≈ ${formattedBdt})\nDue Date: ${context.dueDate}\n\nAccess your portal to download the official invoice.`;

  const ctaText = isBn ? "ইনভয়েস দেখুন ও ডাউনলোড করুন" : "View & Download Invoice";

  const { html, text } = wrapEmailLayout({
    locale,
    preheader,
    heading,
    bodyHtml,
    bodyText,
    ctaText,
    ctaUrl: context.invoiceUrl,
  });

  return { subject: safeEmailSubject(subject), html, text };
}
