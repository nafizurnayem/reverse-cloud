import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { ActionMessage, CheckboxField, ContentHeader, EditorPanel, Field, FormActions, SelectField, StatusBadge, TextareaField } from "@/components/admin-content";
import { deleteFaq, saveFaq } from "../actions";

type Search = { edit?: string; saved?: string; error?: string };

export default async function FaqsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase }, query, t] = await Promise.all([requirePermission(locale, "content.manage"), searchParams, getTranslations({ locale, namespace: "AdminContent" })]);
  const [faqsResult, servicesResult] = await Promise.all([
    supabase.from("faqs").select("*,services(name_en)").order("sort_order"),
    supabase.from("services").select("id,name_en").is("archived_at", null).order("sort_order"),
  ]);
  if (faqsResult.error || servicesResult.error) throw new Error("Unable to load FAQs");
  const items = faqsResult.data ?? []; const services = servicesResult.data ?? [];
  const selected = items.find((item) => item.id === query.edit);
  return (
    <main className="admin-page content-page">
      <ContentHeader eyebrow={t("eyebrow")} title={t("resources.faqs.title")} description={t("resources.faqs.description")} backLabel={t("back")} />
      <ActionMessage saved={query.saved ? t("saved") : null} error={query.error ? t(`errors.${query.error}`) : null} />
      <EditorPanel title={selected ? t("editItem") : t("newFaq")} defaultOpen={Boolean(selected)}>
        <form action={saveFaq} className="content-form"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={selected?.id ?? ""}/>
          <SelectField label={t("fields.service")} name="service_id" defaultValue={selected?.service_id ?? ""}><option value="">{t("generalFaq")}</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name_en}</option>)}</SelectField>
          <Field label={t("fields.sortOrder")} name="sort_order" type="number" defaultValue={selected?.sort_order ?? 0}/>
          <TextareaField label={t("fields.questionEn")} name="question_en" defaultValue={selected?.question_en} required />
          <TextareaField label={t("fields.questionBn")} name="question_bn" defaultValue={selected?.question_bn} />
          <TextareaField label={t("fields.answerEn")} name="answer_en" defaultValue={selected?.answer_en} required rows={6}/>
          <TextareaField label={t("fields.answerBn")} name="answer_bn" defaultValue={selected?.answer_bn} rows={6}/>
          <CheckboxField label={t("fields.published")} name="is_published" defaultChecked={selected?.is_published}/>
          <FormActions saveLabel={t("save")} cancelLabel={t("cancel")} cancelHref="/admin/content/faqs" />
        </form>
      </EditorPanel>
      <section className="content-list"><div className="content-list-heading"><h2>{t("allItems")}</h2><span>{items.length}</span></div><div className="content-table-wrap"><table className="content-table"><thead><tr><th>{t("fields.questionEn")}</th><th>{t("fields.service")}</th><th>{t("status")}</th><th>{t("actions")}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.question_en}</strong></td><td>{item.services?.name_en ?? t("generalFaq")}</td><td><StatusBadge active={item.is_published} activeLabel={t("published")} inactiveLabel={t("draft")}/></td><td><div className="content-row-actions"><Link href={`/admin/content/faqs?edit=${item.id}`}>{t("edit")}</Link><form action={deleteFaq}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={item.id}/><button className="danger" type="submit">{t("delete")}</button></form></div></td></tr>)}</tbody></table></div></section>
    </main>
  );
}
