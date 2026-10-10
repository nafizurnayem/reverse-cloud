export type PortalEmailValues = {
  clientName: string
  projectName: string
  projectCode: string
  milestoneSummary?: string
  updateSummary?: string
  amount?: string
  currency?: string
  dueDate?: string
  portalLink: string
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character)
}

function layout(title: string, body: string, values: PortalEmailValues) {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;"><tr><td style="padding:28px;"><p style="margin:0 0 24px;font-weight:700;">reverse<span style="color:#0e9fa8;">.</span>cloud</p><h1 style="font-size:24px;margin:0 0 20px;">${title}</h1>${body}<p style="margin:28px 0 0;"><a href="${escapeHtml(values.portalLink)}" style="display:inline-block;background:#0e9fa8;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:999px;">Open portal</a></p></td></tr></table></td></tr></table></body></html>`
}

export function clientInvitationEmail(locale: 'en' | 'bn', values: PortalEmailValues) {
  const name = escapeHtml(values.clientName)
  const project = escapeHtml(values.projectName)
  const code = escapeHtml(values.projectCode)
  return locale === 'bn'
    ? layout('ক্লায়েন্ট পোর্টালে আমন্ত্রণ', `<p>হ্যালো ${name},</p><p>আপনাকে ${project} (${code}) প্রকল্পের পোর্টালে আমন্ত্রণ জানানো হয়েছে।</p>`, values)
    : layout('You are invited to the client portal', `<p>Hello ${name},</p><p>You have been invited to the portal for ${project} (${code}).</p>`, values)
}

export function projectUpdateEmail(locale: 'en' | 'bn', values: PortalEmailValues) {
  const name = escapeHtml(values.clientName)
  const project = escapeHtml(values.projectName)
  const summary = escapeHtml(values.updateSummary ?? values.milestoneSummary ?? '')
  return locale === 'bn'
    ? layout('প্রকল্পের নতুন আপডেট', `<p>হ্যালো ${name},</p><p>${project} প্রকল্পে একটি নতুন ক্লায়েন্ট-দৃশ্যমান আপডেট রয়েছে:</p><p style="padding:16px;background:#f1f5f9;">${summary}</p>`, values)
    : layout('Project update', `<p>Hello ${name},</p><p>There is a new client-visible update for ${project}:</p><p style="padding:16px;background:#f1f5f9;">${summary}</p>`, values)
}

export function paymentReminderEmail(locale: 'en' | 'bn', values: PortalEmailValues) {
  const name = escapeHtml(values.clientName)
  const project = escapeHtml(values.projectName)
  const amount = escapeHtml(`${values.currency ?? ''} ${values.amount ?? ''}`.trim())
  const dueDate = escapeHtml(values.dueDate ?? '')
  return locale === 'bn'
    ? layout('পেমেন্টের অনুস্মারক', `<p>হ্যালো ${name},</p><p>${project} প্রকল্পের একটি নির্ধারিত পেমেন্টের তথ্য:</p><p style="padding:16px;background:#f1f5f9;">পরিমাণ: ${amount}<br>শেষ তারিখ: ${dueDate}</p><p>এই বার্তাটি তথ্যের জন্য। পেমেন্ট সম্পন্ন করতে পোর্টালের নির্দেশনা অনুসরণ করুন।</p>`, values)
    : layout('Payment reminder', `<p>Hello ${name},</p><p>Here is a reminder about a scheduled payment for ${project}:</p><p style="padding:16px;background:#f1f5f9;">Amount: ${amount}<br>Due date: ${dueDate}</p><p>This message is informational. Follow the portal instructions for next steps.</p>`, values)
}
