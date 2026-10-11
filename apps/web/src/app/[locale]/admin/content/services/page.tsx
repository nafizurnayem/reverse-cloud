import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { ActionMessage, CheckboxField, ContentHeader, EditorPanel, Field, FormActions, SelectField, StatusBadge, TextareaField } from "@/components/admin-content";
import { saveService, setServiceArchived } from "../actions";

type Search = { edit?: string; saved?: string; error?: string };

export default async function ServicesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase }, query, t] = await Promise.all([requirePermission(locale, "content.manage"), searchParams, getTranslations({ locale, namespace: "AdminContent" })]);
  const { data, error } = await supabase.from("services").select("*").order("sort_order").order("name_en");
  if (error) throw new Error("Unable to load services");
  const items = data ?? [];
  const selected = items.find((item) => item.id === query.edit);
  const errorMessage = query.error ? t(`errors.${query.error}`) : null;
  return (
    <main className="admin-page content-page">
      <ContentHeader eyebrow={t("eyebrow")} title={t("resources.services.title")} description={t("resources.services.description")} backLabel={t("back")} />
      <ActionMessage saved={query.saved ? t("saved") : null} error={errorMessage} />
      <EditorPanel title={selected ? t("editItem") : t("newService")}>
        <form action={saveService} className="content-form">
          <input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={selected?.id ?? ""} />
          <Field label={t("fields.nameEn")} name="name_en" defaultValue={selected?.name_en} required />
          <Field label={t("fields.nameBn")} name="name_bn" defaultValue={selected?.name_bn} />
          <Field label={t("fields.slug")} name="slug" defaultValue={selected?.slug} placeholder="website-development" />
          <Field label={t("fields.icon")} name="icon" defaultValue={selected?.icon} />
          <TextareaField label={t("fields.summaryEn")} name="summary_en" defaultValue={selected?.summary_en} />
          <TextareaField label={t("fields.summaryBn")} name="summary_bn" defaultValue={selected?.summary_bn} />
          <TextareaField label={t("fields.bodyEn")} name="body_en" defaultValue={selected?.body_en} rows={8} />
          <TextareaField label={t("fields.bodyBn")} name="body_bn" defaultValue={selected?.body_bn} rows={8} />
          <SelectField label={t("fields.pricingModel")} name="pricing_model" defaultValue={selected?.pricing_model ?? "custom"}><option value="fixed">{t("options.fixed")}</option><option value="hourly">{t("options.hourly")}</option><option value="retainer">{t("options.retainer")}</option><option value="custom">{t("options.custom")}</option></SelectField>
          <Field label={t("fields.startingUsd")} name="starting_from_usd" type="number" min="0" step="0.01" defaultValue={selected?.starting_from_usd} />
          <Field label={t("fields.sortOrder")} name="sort_order" type="number" defaultValue={selected?.sort_order ?? 0} />
          <CheckboxField label={t("fields.published")} name="is_published" defaultChecked={selected?.is_published} hint={t("hints.servicePublish")} />
          <FormActions saveLabel={t("save")} cancelLabel={t("cancel")} cancelHref="/admin/content/services" />
        </form>
      </EditorPanel>
      <section className="content-list"><div className="content-list-heading"><h2>{t("allItems")}</h2><span>{items.length}</span></div>
        <div className="content-table-wrap"><table className="content-table"><thead><tr><th>{t("fields.nameEn")}</th><th>{t("fields.pricingModel")}</th><th>{t("status")}</th><th>{t("actions")}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name_en}</strong><small>{item.slug}</small></td><td>{t(`options.${item.pricing_model}`)}</td><td><StatusBadge active={Boolean(item.archived_at) || item.is_published} activeLabel={item.archived_at ? t("archived") : t("published")} inactiveLabel={t("draft")} warning={Boolean(item.archived_at)} /></td><td><div className="content-row-actions"><Link href={`/admin/content/services?edit=${item.id}`}>{t("edit")}</Link><form action={setServiceArchived}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="archived" value={item.archived_at ? "false" : "true"}/><button type="submit">{item.archived_at ? t("restore") : t("archive")}</button></form></div></td></tr>)}</tbody></table></div>
      </section>
    </main>
  );
}
