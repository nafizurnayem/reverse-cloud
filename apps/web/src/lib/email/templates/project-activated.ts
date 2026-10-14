import { escapeEmailHtml, safeEmailSubject, wrapEmailLayout } from "../layout";
import type { ProjectActivatedEmailContext, RenderedEmail } from "../types";

export function renderProjectActivatedEmail(
  context: ProjectActivatedEmailContext,
): RenderedEmail {
  const locale = context.locale ?? "en";
  const isBn = locale === "bn";
  const recipientName = escapeEmailHtml(context.recipientName);
  const projectTitle = escapeEmailHtml(context.projectTitle);
  const leadArchitect = context.leadArchitect ? escapeEmailHtml(context.leadArchitect) : "";

  const subject = isBn
    ? `প্রজেক্ট সক্রিয় হয়েছে: ${context.projectTitle}`
    : `Project Activated: ${context.projectTitle}`;

  const heading = isBn ? "প্রজেক্ট উন্নয়ন পর্ব শুরু হয়েছে" : "Your Project is Now Active";

  const preheader = isBn
    ? `${context.projectTitle} প্রজেক্টের ইঞ্জিনিয়ারিং কাজ আনুষ্ঠানিকভাবে শুরু হয়েছে।`
    : `Engineering kick-off for ${context.projectTitle} has commenced.`;

  const leadInfo = leadArchitect
    ? isBn
      ? `<p style="margin: 12px 0;"><strong>দায়িত্বপ্রাপ্ত লিড আর্কিটেক্ট:</strong> ${leadArchitect}</p>`
      : `<p style="margin: 12px 0;"><strong>Lead Architect Assigned:</strong> ${leadArchitect}</p>`
    : "";

  const leadText = context.leadArchitect
    ? isBn
      ? `\nদায়িত্বপ্রাপ্ত লিড আর্কিটেক্ট: ${context.leadArchitect}`
      : `\nLead Architect Assigned: ${context.leadArchitect}`
    : "";

  const bodyHtml = isBn
    ? `<p>প্রিয় <strong>${recipientName}</strong>,</p>
       <p>আমরা আনন্দের সাথে জানাচ্ছি যে <strong>${projectTitle}</strong> প্রজেক্টটি আমাদের ইঞ্জিনিয়ারিং পাইপলাইনে আনুষ্ঠানিকভাবে সক্রিয় করা হয়েছে।</p>
       ${leadInfo}
       <p>আমাদের ক্লাউড এবং সফটওয়্যার টিম প্রাথমিক আর্কিটেকচার সেটআপ, রিপোজিটরি কনফিগারেশন এবং সিআই/সিডি অটোমেশন শুরু করেছে। আপনার ক্লায়েন্ট পোর্টালে প্রতিটি মাইলফলকের অগ্রগতি নিয়মিত আপডেট করা হবে।</p>`
    : `<p>Hello <strong>${recipientName}</strong>,</p>
       <p>We are excited to confirm that <strong>${projectTitle}</strong> has officially been activated in our engineering pipeline.</p>
       ${leadInfo}
       <p>Our team has commenced repository initialization, architecture blueprints, and CI/CD automation. You can track all progress live on your client portal.</p>`;

  const bodyText = isBn
    ? `প্রিয় ${context.recipientName},\n\nআপনার প্রজেক্ট "${context.projectTitle}" আনুষ্ঠানিকভাবে সক্রিয় হয়েছে।${leadText}\n\nক্লাউড সেটআপ ও ইঞ্জিনিয়ারিং কাজ শুরু হয়েছে। লাইভ অগ্রগতি দেখতে নিচের পোর্টালে প্রবেশ করুন।`
    : `Hello ${context.recipientName},\n\nYour project "${context.projectTitle}" has officially been activated.${leadText}\n\nEngineering execution is underway. You can track all progress live on your portal.`;

  const ctaText = isBn ? "প্রজেক্ট ড্যাশবোর্ড দেখুন" : "View Project Dashboard";

  const { html, text } = wrapEmailLayout({
    locale,
    preheader,
    heading,
    bodyHtml,
    bodyText,
    ctaText,
    ctaUrl: context.portalUrl,
  });

  return { subject: safeEmailSubject(subject), html, text };
}
