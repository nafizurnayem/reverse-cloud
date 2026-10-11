import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { ActionMessage, CheckboxField, ContentHeader, EditorPanel, Field, FormActions, SelectField, StatusBadge, TextareaField } from "@/components/admin-content";
import { saveReview } from "./actions";

type Search = { edit?: string; saved?: string; error?: string };

export default async function ReviewsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase }, query, t, tc] = await Promise.all([requirePermission(locale, "reviews.moderate"), searchParams, getTranslations({ locale, namespace: "AdminReviews" }), getTranslations({ locale, namespace: "AdminContent" })]);
  const { data, error } = await supabase.from("reviews").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load reviews");
  const items = data ?? []; const selected = items.find((item) => item.id === query.edit);
  return (
    <main className="admin-page content-page">
      <ContentHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} backLabel={tc("backDashboard")} backHref="/admin" />
      <ActionMessage saved={query.saved ? tc("saved") : null} error={query.error ? tc(`errors.${query.error}`) : null}/>
      <EditorPanel title={selected ? tc("editItem") : t("newReview")}>
        <form action={saveReview} className="content-form"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={selected?.id ?? ""}/>
          <Field label={t("fields.name")} name="reviewer_name" defaultValue={selected?.reviewer_name} required/><Field label={t("fields.title")} name="reviewer_title" defaultValue={selected?.reviewer_title}/>
          <Field label={t("fields.rating")} name="rating" type="number" min="1" step="1" defaultValue={selected?.rating ?? 5} required/>
          <SelectField label={t("fields.locale")} name="review_locale" defaultValue={selected?.locale ?? "en"}><option value="en">English</option><option value="bn">বাংলা</option></SelectField>
          <SelectField label={t("fields.source")} name="source" defaultValue={selected?.source ?? "manual"}><option value="manual">{t("options.manual")}</option><option value="fiverr">Fiverr</option><option value="other">{t("options.other")}</option><option value="portal">{t("options.portal")}</option></SelectField>
          <SelectField label={tc("status")} name="status" defaultValue={selected?.status ?? "pending"}><option value="pending">{t("options.pending")}</option><option value="approved">{t("options.approved")}</option><option value="rejected">{t("options.rejected")}</option></SelectField>
          <Field label={t("fields.sourceUrl")} name="source_url" type="url" defaultValue={selected?.source_url}/><TextareaField label={t("fields.body")} name="body" defaultValue={selected?.body} required rows={6}/>
          <CheckboxField label={t("fields.featured")} name="is_featured" defaultChecked={selected?.is_featured}/><FormActions saveLabel={tc("save")} cancelLabel={tc("cancel")} cancelHref="/admin/reviews" />
        </form>
      </EditorPanel>
      <section className="content-list"><div className="content-list-heading"><h2>{tc("allItems")}</h2><span>{items.length}</span></div><div className="content-table-wrap"><table className="content-table"><thead><tr><th>{t("fields.name")}</th><th>{t("fields.rating")}</th><th>{tc("status")}</th><th>{tc("actions")}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.reviewer_name}</strong><small>{item.body}</small></td><td>{"★".repeat(item.rating)}</td><td><StatusBadge active={item.status !== "pending"} activeLabel={item.status === "approved" ? t("options.approved") : t("options.rejected")} inactiveLabel={t("options.pending")} warning={item.status === "rejected"}/></td><td><div className="content-row-actions"><Link href={`/admin/reviews?edit=${item.id}`}>{tc("edit")}</Link></div></td></tr>)}</tbody></table></div></section>
    </main>
  );
}
