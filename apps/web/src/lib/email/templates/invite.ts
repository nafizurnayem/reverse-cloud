import { safeEmailSubject, toBanglaDigits, wrapEmailLayout } from "../layout";
import type { InviteEmailContext, RenderedEmail } from "../types";

export function renderInviteEmail(context: InviteEmailContext): RenderedEmail {
  const locale = context.locale ?? "en";
  const isBn = locale === "bn";
  const hours = Number.isFinite(context.expiresInHours)
    ? Math.min(24 * 14, Math.max(1, Math.round(context.expiresInHours as number)))
    : 24 * 14;
  const displayHours = isBn ? toBanglaDigits(hours) : String(hours);

  const subject = isBn
    ? "রিভার্স ক্লাউড ক্লায়েন্ট পোর্টালে আপনার আমন্ত্রণ"
    : `Invitation: Access your Reverse Cloud Client Portal`;

  const heading = isBn
    ? `স্বাগতম, ${context.recipientName}!`
    : `Welcome to Reverse Cloud, ${context.recipientName}!`;

  const preheader = isBn
    ? "আপনার ক্লায়েন্ট পোর্টাল অ্যাকাউন্টে প্রবেশ করে প্রজেক্টের অগ্রগতি ও মাইলফলক দেখুন।"
    : "Activate your client portal account to monitor milestone progress and live previews.";

  const bodyHtml = isBn
    ? `<p>আমাদের ইঞ্জিনিয়ারিং দল আপনার প্রজেক্টের জন্য ক্লায়েন্ট পোর্টাল প্রস্তুত করেছে। এই পোর্টালের মাধ্যমে আপনি সম্পূর্ণ রিড-অনলি মোডে সরাসরি দেখতে পারবেন:</p>
       <ul style="padding-left: 20px; margin: 16px 0; color: #475569;">
         <li>রিয়েল-টাইম মাইলফলক এবং ডেলিভারি অগ্রগতি</li>
         <li>লাইভ স্টেজিং প্রিভিউ পরিবেশ এবং টেস্ট লিংক</li>
         <li>পেমেন্ট শিডিউল এবং অফিশিয়াল ইনভয়েস ডাউনলোড</li>
       </ul>
       <p style="margin-top: 16px;">নিরাপত্তার স্বার্থে এই আমন্ত্রণ লিঙ্কটি <strong>${displayHours} ঘণ্টার</strong> মধ্যে ব্যবহার করতে হবে।</p>`
    : `<p>Our engineering team has provisioned your dedicated client portal. Through this portal, you have real-time read-only access to:</p>
       <ul style="padding-left: 20px; margin: 16px 0; color: #475569;">
         <li>Real-time milestone timelines and delivery weights</li>
         <li>Isolated live staging preview deployments</li>
         <li>Milestone payment disbursements and official invoices</li>
       </ul>
       <p style="margin-top: 16px;">For your security, this invitation link remains valid for <strong>${displayHours} hours</strong>.</p>`;

  const bodyText = isBn
    ? `প্রিয় ${context.recipientName},\n\nআমাদের ইঞ্জিনিয়ারিং দল আপনার প্রজেক্টের জন্য ক্লায়েন্ট পোর্টাল প্রস্তুত করেছে। এই পোর্টালের মাধ্যমে আপনি রিয়েল-টাইমে দেখতে পারবেন:\n- মাইলফলক অগ্রগতি ও টাইমলাইন\n- লাইভ স্টেজিং প্রিভিউ লিংক\n- পেমেন্ট শিডিউল ও ইনভয়েস\n\nআমন্ত্রণ লিঙ্কটি ${displayHours} ঘণ্টা সক্রিয় থাকবে।`
    : `Hello ${context.recipientName},\n\nOur engineering team has provisioned your dedicated client portal. You can now access:\n- Real-time milestone progress and timeline\n- Live staging preview links\n- Payment disbursements and downloadable invoices\n\nThis invitation link is valid for ${displayHours} hours.`;

  const ctaText = isBn ? "পোর্টালে প্রবেশ করুন" : "Access Client Portal";

  const { html, text } = wrapEmailLayout({
    locale,
    preheader,
    heading,
    bodyHtml,
    bodyText,
    ctaText,
    ctaUrl: context.inviteUrl,
  });

  return { subject: safeEmailSubject(subject), html, text };
}
