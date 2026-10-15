import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalProjects } from "@/lib/portal/portal-catalog";
import { formatBdt, formatUsd } from "@/lib/money";

export const runtime = "nodejs";

interface PaymentItemDbRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  amount_due: number | string;
  currency: string;
  status: string;
  due_on: string | null;
  paid_at: string | null;
  projects?: {
    id: string;
    client_id: string;
    title: string;
    clients?: {
      id: string;
      full_name: string;
      company: string | null;
      email: string;
    } | null;
  } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is staff with payments permission
  const { data: staffRoles } = await supabase
    .from("staff_roles")
    .select("role_id, roles(role_permissions(permission_key))")
    .eq("user_id", user.id);

  const staffPermissions = (staffRoles ?? []).flatMap(
    (sr: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sr as any)?.roles?.role_permissions?.map((rp: any) => rp.permission_key) ?? [],
  );
  const isStaffWithAccess =
    staffPermissions.includes("payments.read") ||
    staffPermissions.includes("payments.manage");

  // Determine current user's client_id if client
  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, full_name, company")
    .eq("user_id", user.id)
    .maybeSingle();

  const userClientId = clientRow?.id;

  // 1. Query real DB payment_items table
  const { data: dbItem } = await supabase
    .from("payment_items")
    .select(`
      id,
      project_id,
      title,
      description,
      amount_due,
      currency,
      status,
      due_on,
      paid_at,
      projects:project_id(
        id,
        client_id,
        title,
        clients:client_id(id, full_name, company, email)
      )
    `)
    .eq("id", id)
    .maybeSingle();

  const item = dbItem as unknown as PaymentItemDbRow | null;

  if (item) {
    const projectClientId = item.projects?.client_id;
    const isOwner = Boolean(userClientId && projectClientId && userClientId === projectClientId);

    if (!isStaffWithAccess && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Try finding pre-generated PDF in private 'invoices' bucket
    const candidatePaths = [
      `${item.project_id}/${id}.pdf`,
      `${item.project_id}/INV-${id.slice(0, 8).toUpperCase()}.pdf`,
      `${projectClientId}/${id}.pdf`,
      `${id}.pdf`,
    ];

    for (const path of candidatePaths) {
      const { data: signed } = await supabase.storage
        .from("invoices")
        .createSignedUrl(path, 60 * 15, {
          download: `INV-${id.slice(0, 8).toUpperCase()}.pdf`,
        });

      if (signed?.signedUrl) {
        return NextResponse.redirect(signed.signedUrl, 307);
      }
    }

    // Fallback: render official clean printable HTML invoice with proper headers
    const amountNum = Number(item.amount_due);
    const isBdt = item.currency === "BDT";
    const amountUsd = isBdt ? Math.round(amountNum / 120) : amountNum;
    const amountBdt = isBdt ? amountNum : Math.round(amountNum * 120);
    const invoiceNumber = `INV-${id.slice(0, 8).toUpperCase()}`;

    const html = generateInvoiceHtml({
      invoiceNumber,
      clientName: item.projects?.clients?.full_name ?? "Client",
      companyName: item.projects?.clients?.company ?? "Client Organization",
      projectTitle: item.projects?.title ?? "Reverse Cloud Project",
      itemTitle: item.title,
      description: item.description ?? "Milestone installment delivery",
      amountUsd,
      amountBdt,
      status: item.status,
      dueDate: item.due_on ?? "On Receipt",
      paidAt: item.paid_at,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-cache",
      },
    });
  }

  // 2. Catalog fallback for demo / test IDs
  const allProjects = getPortalProjects();
  for (const proj of allProjects) {
    const pay = proj.payments.find((p) => p.id === id || p.invoiceNumber === id);
    if (pay) {
      const html = generateInvoiceHtml({
        invoiceNumber: pay.invoiceNumber,
        clientName: proj.clientName,
        companyName: proj.companyName,
        projectTitle: proj.title,
        itemTitle: pay.title,
        description: `Milestone payment for ${proj.title}`,
        amountUsd: pay.amountUsd,
        amountBdt: pay.amountBdt,
        status: pay.status,
        dueDate: pay.dueDate,
        paidAt: pay.paidAt,
      });

      return new NextResponse(html, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "private, no-cache",
        },
      });
    }
  }

  return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
}

function generateInvoiceHtml(data: {
  invoiceNumber: string;
  clientName: string;
  companyName: string;
  projectTitle: string;
  itemTitle: string;
  description: string;
  amountUsd: number;
  amountBdt: number;
  status: string;
  dueDate: string;
  paidAt?: string | null;
}): string {
  const isPaid = data.status === "paid";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${data.invoiceNumber} — Reverse Cloud</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media print {
      body { background: #fff !important; color: #000 !important; }
      .no-print { display: none !important; }
      .container { box-shadow: none !important; border: none !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 32px 16px; line-height: 1.5; }
    .container { max-width: 760px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #1e293b; padding-bottom: 24px; margin-bottom: 32px; }
    .brand { font-size: 20px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; }
    .brand-sub { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .inv-meta { text-align: right; }
    .inv-num { font-family: monospace; font-size: 18px; font-weight: 700; color: #f8fafc; }
    .badge { display: inline-block; padding: 4px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; border-radius: 9999px; margin-top: 6px; letter-spacing: 0.5px; }
    .badge-paid { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-due { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; font-size: 13px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px; }
    .party-name { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
    .party-sub { color: #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 13px; }
    th { text-align: left; padding: 12px; background: rgba(255,255,255,0.03); color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #1e293b; }
    td { padding: 16px 12px; border-bottom: 1px solid #1e293b; }
    .total-card { background: rgba(255,255,255,0.02); border: 1px solid #1e293b; border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
    .total-val { font-size: 24px; font-weight: 800; font-family: monospace; color: #38bdf8; text-align: right; }
    .total-bdt { font-size: 12px; color: #94a3b8; font-family: monospace; margin-top: 4px; }
    .footer { font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #1e293b; padding-top: 24px; }
    .actions { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid #334155; background: #1e293b; color: #f8fafc; }
    .btn:hover { background: #334155; }
    .btn-primary { background: #0284c7; border-color: #0284c7; color: #fff; }
    .btn-primary:hover { background: #0369a1; }
  </style>
</head>
<body>
  <div class="actions no-print">
    <button class="btn" onclick="window.print()">Print Invoice</button>
  </div>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand">REVERSE CLOUD</div>
        <div class="brand-sub">Enterprise Engineering & Cloud Operations</div>
      </div>
      <div class="inv-meta">
        <div class="inv-num">${data.invoiceNumber}</div>
        <span class="badge ${isPaid ? "badge-paid" : "badge-due"}">${data.status}</span>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">Due: ${data.dueDate}</div>
      </div>
    </div>

    <div class="parties">
      <div>
        <div class="section-title">Billed To</div>
        <div class="party-name">${data.clientName}</div>
        <div class="party-sub">${data.companyName}</div>
        <div class="party-sub" style="margin-top: 4px;">Project: ${data.projectTitle}</div>
      </div>
      <div style="text-align: right;">
        <div class="section-title">Payable To</div>
        <div class="party-name">Reverse Cloud Inc.</div>
        <div class="party-sub">billing@revcloud.dev</div>
        <div class="party-sub">Dhaka, Bangladesh / Delaware, USA</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Amount (USD)</th>
          <th style="text-align: right;">Amount (BDT)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong style="color: #f8fafc; display: block; margin-bottom: 4px;">${data.itemTitle}</strong>
            <span style="color: #94a3b8; font-size: 12px;">${data.description}</span>
          </td>
          <td style="text-align: right; font-family: monospace; font-weight: 600;">${formatUsd(data.amountUsd)}</td>
          <td style="text-align: right; font-family: monospace; color: #94a3b8;">${formatBdt(data.amountBdt)}</td>
        </tr>
      </tbody>
    </table>

    <div class="total-card">
      <div>
        <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #94a3b8;">Total Amount Due</span>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Official VAT-inclusive milestone invoice</div>
      </div>
      <div>
        <div class="total-val">${formatUsd(data.amountUsd)}</div>
        <div class="total-bdt">≈ ${formatBdt(data.amountBdt)}</div>
      </div>
    </div>

    <div class="footer">
      This is an official computer-generated billing document. For questions, contact billing@revcloud.dev.
    </div>
  </div>
</body>
</html>`;
}
