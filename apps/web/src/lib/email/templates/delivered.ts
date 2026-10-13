import { toBanglaDigits, wrapEmailLayout } from "../layout";
import type { DeliveredEmailContext, RenderedEmail } from "../types";

export function renderDeliveredEmail(
  context: DeliveredEmailContext,
): RenderedEmail {
  const locale = context.locale ?? "en";
  const isBn = locale === "bn";
  const warranty = context.warrantyDays ?? 60;
  const displayWarranty = isBn ? toBanglaDigits(warranty) : String(warranty);

  const subject = isBn
    ? `প্রজেক্ট সফলভাবে সমাপ্ত ও হস্তান্তরিত: ${context.projectTitle}`
    : `Project Delivered & Handed Over: ${context.projectTitle}`;

  const heading = isBn
    ? "প্রজেক্ট ডেলিভারি ও সফল প্রোডাকশন লঞ্চ"
    : "Project Successfully Delivered!";

  const preheader = isBn
    ? `${context.projectTitle} সফলভাবে প্রোডাকশনে লাইভ হয়েছে এবং ওয়ারেন্টি সাপোর্ট সক্রিয় রয়েছে।`
    : `${context.projectTitle} has been launched to production with ${warranty} days engineering warranty.`;

  const warrantyBox = `<div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; font-size: 13px; font-weight: 700; color: #065f46;">
      🛡️ ${isBn ? "ওয়ারেন্টি ও সাপোর্ট কভারেজ:" : "Engineering Warranty & SLA Active"}
    </p>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #047857;">
      ${
        isBn
          ? `আপনার প্রজেক্টে আগামী ${displayWarranty} দিন সার্বক্ষণিক বাগ ফিক্স এবং প্রোডাকশন স্ট্যাবিলিটি সাপোর্ট অন্তর্ভুক্ত রয়েছে।`
          : `Your project includes ${warranty} days of zero-cost production bug fixes, monitoring, and stability support.`
      }
    </p>
  </div>`;

  const bodyHtml = isBn
    ? `<p>প্রিয় <strong>${context.recipientName}</strong>,</p>
       <p>আমরা গর্বের সাথে জানাচ্ছি যে <strong>${context.projectTitle}</strong> প্রজেক্টের সমস্ত ফাইনাল মাইলফলক সফলভাবে সম্পন্ন হয়েছে এবং সম্পূর্ণ সিস্টেম প্রোডাকশনে সফলভাবে হস্তান্তরিত হয়েছে।</p>
       ${warrantyBox}
       <p>ক্লাউড আর্কিটেকচার ব্লুপ্রিন্ট, সিআই/সিডি অটোমেশন, সিকিউরিটি ক্রেডেনশিয়াল এবং বিস্তারিত ডকুমেন্টেশন আপনার ক্লায়েন্ট পোর্টালে যুক্ত করা হয়েছে।</p>
       <p>রিভার্স ক্লাউডকে বেছে নেওয়ার জন্য আন্তরিক ধন্যবাদ। ভবিষ্যতে আপনার যেকোনো প্রযুক্তিগত সম্প্রসারণে আমরা পাশে থাকতে প্রস্তুত।</p>`
    : `<p>Hello <strong>${context.recipientName}</strong>,</p>
       <p>We are thrilled to announce that all milestones for <strong>${context.projectTitle}</strong> have been completed, verified, and successfully transitioned to live production.</p>
       ${warrantyBox}
       <p>All IaC repositories, production telemetry dashboards, and developer handoff documentation are accessible in your portal.</p>
       <p>Thank you for partnering with Reverse Cloud. We look forward to powering your next engineering phase.</p>`;

  const bodyText = isBn
    ? `প্রিয় ${context.recipientName},\n\nআপনার প্রজেক্ট "${context.projectTitle}" সফলভাবে প্রোডাকশনে হস্তান্তরিত হয়েছে!\n\nওয়ারেন্টি: আগামী ${displayWarranty} দিন আমাদের সার্বক্ষণিক সাপোর্ট সক্রিয় থাকবে।\n\nসম্পূর্ণ ডকুমেন্টেশন ও আর্কিটেকচার অ্যাসেট দেখতে পোর্টালে প্রবেশ করুন।`
    : `Hello ${context.recipientName},\n\nYour project "${context.projectTitle}" has been successfully delivered and transitioned to production!\n\nWarranty: ${warranty} days of production support is active.\n\nAccess your portal to review handoff documentation and assets.`;

  const ctaText = isBn ? "সম্পূর্ণ প্রজেক্ট পোর্টাল দেখুন" : "View Final Project Portal";

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
