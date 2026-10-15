import type { EmailLocale } from "./types";

export function escapeEmailHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function safeEmailUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function safeEmailSubject(value: unknown): string {
  return String(value ?? "").replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 200);
}

export function toBanglaDigits(value: number | string): string {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value).replace(/\d/g, (d) => bnDigits[Number(d)]);
}

interface EmailLayoutOptions {
  locale: EmailLocale;
  preheader: string;
  heading: string;
  bodyHtml: string;
  bodyText: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function wrapEmailLayout({
  locale,
  preheader,
  heading,
  bodyHtml,
  bodyText,
  ctaText,
  ctaUrl,
}: EmailLayoutOptions): { html: string; text: string } {
  const isBn = locale === "bn";
  const escapedPreheader = escapeEmailHtml(preheader);
  const escapedHeading = escapeEmailHtml(heading);
  const escapedCtaText = ctaText ? escapeEmailHtml(ctaText) : undefined;
  const validCtaUrl = safeEmailUrl(ctaUrl);
  const escapedCtaUrl = validCtaUrl ? escapeEmailHtml(validCtaUrl) : undefined;

  const footerCompany = isBn
    ? "রিভার্স ক্লাউড ইঞ্জিনিয়ারিং • ঢাকা, বাংলাদেশ এবং ডেলাওয়্যার, যুক্তরাষ্ট্র"
    : "Reverse Cloud Inc. • Dhaka, Bangladesh & Delaware, USA";

  const footerSupport = isBn
    ? "যেকোনো প্রশ্নের জন্য আমাদের সাথে যোগাযোগ করুন: solutions@revcloud.dev"
    : "Questions? Contact our engineering team at solutions@revcloud.dev";

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedHeading}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    table { border-collapse: collapse; }
    .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 24px; margin-bottom: 24px; }
    .header { background-color: #020617; padding: 28px 32px; text-align: left; border-bottom: 2px solid #38bdf8; }
    .brand-title { color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .brand-subtitle { color: #94a3b8; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; margin-bottom: 0; }
    .content { padding: 36px 32px; font-size: 14px; line-height: 1.6; color: #334155; }
    .heading { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; letter-spacing: -0.3px; }
    .btn-container { margin-top: 28px; margin-bottom: 28px; text-align: left; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2); }
    .footer { background-color: #f8fafc; padding: 24px 32px; text-align: left; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5; }
    .preheader { display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; }
  </style>
</head>
<body style="background-color: #0f172a; padding: 12px;">
  <span class="preheader">${escapedPreheader}</span>
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table class="container" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td class="header">
              <h1 class="brand-title">Reverse Cloud</h1>
              <p class="brand-subtitle">Cloud Architecture & AI Systems</p>
            </td>
          </tr>
          <tr>
            <td class="content">
              <h2 class="heading">${escapedHeading}</h2>
              ${bodyHtml}
              ${
                escapedCtaText && escapedCtaUrl
                  ? `<div class="btn-container"><a href="${escapedCtaUrl}" class="btn" target="_blank" rel="noopener noreferrer">${escapedCtaText}</a></div>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">${footerCompany}</p>
              <p style="margin: 0;">${footerSupport}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `REVERSE CLOUD • Cloud Architecture & AI Systems`,
    `===============================================`,
    ``,
    heading,
    `-----------------------------------------------`,
    bodyText,
    ctaText && validCtaUrl ? `\n>> ${ctaText}: ${validCtaUrl}\n` : "",
    `-----------------------------------------------`,
    footerCompany,
    footerSupport,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}
