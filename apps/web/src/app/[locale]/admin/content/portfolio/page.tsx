import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { ActionMessage, CheckboxField, ContentHeader, EditorPanel, Field, FormActions, StatusBadge, TextareaField } from "@/components/admin-content";
import { deletePortfolio, deletePortfolioMedia, savePortfolio, uploadPortfolioMedia } from "../actions";

type Search = { edit?: string; saved?: string; error?: string };

export default async function PortfolioPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase }, query, t] = await Promise.all([requirePermission(locale, "content.manage"), searchParams, getTranslations({ locale, namespace: "AdminContent" })]);
  const [portfolioResult, servicesResult] = await Promise.all([
    supabase.from("portfolio_items").select("*,portfolio_services(service_id),portfolio_media(*)").order("created_at", { ascending: false }),
    supabase.from("services").select("id,name_en").is("archived_at", null).order("sort_order"),
  ]);
  const { data, error } = portfolioResult;
  if (error || servicesResult.error) throw new Error("Unable to load portfolio");
  const items = data ?? []; const selected = items.find((item) => item.id === query.edit);
  const linkedServices = new Set<string>(
    (selected?.portfolio_services ?? []).map((link: { service_id: string }) => link.service_id),
  );
  return (
    <main className="admin-page content-page">
      <ContentHeader eyebrow={t("eyebrow")} title={t("resources.portfolio.title")} description={t("resources.portfolio.description")} backLabel={t("back")} />
      <ActionMessage saved={query.saved ? t("saved") : null} error={query.error ? t(`errors.${query.error}`) : null} />
      <EditorPanel title={selected ? t("editItem") : t("newPortfolio")} defaultOpen={Boolean(selected)}>
        <form action={savePortfolio} className="content-form"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={selected?.id ?? ""}/>
          <Field label={t("fields.titleEn")} name="title_en" defaultValue={selected?.title_en} required/><Field label={t("fields.titleBn")} name="title_bn" defaultValue={selected?.title_bn}/>
          <Field label={t("fields.slug")} name="slug" defaultValue={selected?.slug}/><Field label={t("fields.clientName")} name="public_client_name" defaultValue={selected?.public_client_name}/>
          <TextareaField label={t("fields.summaryEn")} name="summary_en" defaultValue={selected?.summary_en}/><TextareaField label={t("fields.summaryBn")} name="summary_bn" defaultValue={selected?.summary_bn}/>
          <TextareaField label={t("fields.challengeEn")} name="challenge_en" defaultValue={selected?.challenge_en}/><TextareaField label={t("fields.challengeBn")} name="challenge_bn" defaultValue={selected?.challenge_bn}/>
          <TextareaField label={t("fields.solutionEn")} name="solution_en" defaultValue={selected?.solution_en}/><TextareaField label={t("fields.solutionBn")} name="solution_bn" defaultValue={selected?.solution_bn}/>
          <TextareaField label={t("fields.resultEn")} name="result_en" defaultValue={selected?.result_en}/><TextareaField label={t("fields.resultBn")} name="result_bn" defaultValue={selected?.result_bn}/>
          <Field label={t("fields.coverPath")} name="cover_path" defaultValue={selected?.cover_path}/><Field label={t("fields.liveUrl")} name="live_url" type="url" defaultValue={selected?.live_url}/>
          <Field label={t("fields.techStack")} name="tech_stack" defaultValue={selected?.tech_stack?.join(", ")}/><Field label={t("fields.completedOn")} name="completed_on" type="date" defaultValue={selected?.completed_on}/>
          <label className="content-field content-field-wide"><span>{t("fields.services")}</span><select name="service_ids" multiple defaultValue={[...linkedServices]}>{(servicesResult.data ?? []).map((service) => <option value={service.id} key={service.id}>{service.name_en}</option>)}</select><small>{t("hints.multiSelect")}</small></label>
          <CheckboxField label={t("fields.clientConsent")} name="client_consent" defaultChecked={selected?.client_consent} hint={t("hints.consent")}/><CheckboxField label={t("fields.featured")} name="is_featured" defaultChecked={selected?.is_featured}/><CheckboxField label={t("fields.published")} name="is_published" defaultChecked={selected?.is_published} hint={t("hints.portfolioPublish")}/>
          <FormActions saveLabel={t("save")} cancelLabel={t("cancel")} cancelHref="/admin/content/portfolio" />
        </form>
      </EditorPanel>
      {selected ? <EditorPanel title={t("media.title")} defaultOpen={false}>
        <form action={uploadPortfolioMedia} className="content-form"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="portfolio_item_id" value={selected.id}/>
          <Field label={t("media.file")} name="file" type="file" required/><Field label={t("fields.sortOrder")} name="sort_order" type="number" defaultValue={selected.portfolio_media?.length ?? 0}/>
          <Field label={t("media.altEn")} name="alt_en"/><Field label={t("media.altBn")} name="alt_bn"/>
          <CheckboxField label={t("media.useAsCover")} name="use_as_cover"/><div className="content-form-actions"><button className="content-primary-button" type="submit">{t("media.upload")}</button></div>
        </form>
        {selected.portfolio_media?.length ? <div className="content-media-list">{[...selected.portfolio_media].sort((a, b) => a.sort_order - b.sort_order).map((media) => <div key={media.id}><code>{media.storage_path}</code><span>{media.alt_en || "—"}</span><form action={deletePortfolioMedia}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="portfolio_item_id" value={selected.id}/><input type="hidden" name="media_id" value={media.id}/><button className="danger" type="submit">{t("delete")}</button></form></div>)}</div> : <p className="admin-empty">{t("media.empty")}</p>}
      </EditorPanel> : null}
      <section className="content-list"><div className="content-list-heading"><h2>{t("allItems")}</h2><span>{items.length}</span></div><div className="content-table-wrap"><table className="content-table"><thead><tr><th>{t("fields.titleEn")}</th><th>{t("fields.clientConsent")}</th><th>{t("status")}</th><th>{t("actions")}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.title_en}</strong><small>{item.slug}</small></td><td>{item.client_consent ? t("yes") : t("no")}</td><td><StatusBadge active={item.is_published} activeLabel={t("published")} inactiveLabel={t("draft")}/></td><td><div className="content-row-actions"><Link href={`/admin/content/portfolio?edit=${item.id}`}>{t("edit")}</Link><form action={deletePortfolio}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={item.id}/><button className="danger" type="submit">{t("delete")}</button></form></div></td></tr>)}</tbody></table></div></section>
    </main>
  );
}
