import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { ActionMessage, ContentHeader, EditorPanel, Field, FormActions, SelectField, StatusBadge, TextareaField } from "@/components/admin-content";
import { deleteBlogPost, saveBlogPost } from "../actions";

type Search = { edit?: string; saved?: string; error?: string };

export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase }, query, t] = await Promise.all([requirePermission(locale, "content.manage"), searchParams, getTranslations({ locale, namespace: "AdminContent" })]);
  const { data, error } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load blog posts");
  const items = data ?? []; const selected = items.find((item) => item.id === query.edit);
  const seo = selected?.seo && typeof selected.seo === "object" ? selected.seo as { title?: string; description?: string } : {};
  return (
    <main className="admin-page content-page">
      <ContentHeader eyebrow={t("eyebrow")} title={t("resources.blog.title")} description={t("resources.blog.description")} backLabel={t("back")} />
      <ActionMessage saved={query.saved ? t("saved") : null} error={query.error ? t(`errors.${query.error}`) : null} />
      <EditorPanel title={selected ? t("editItem") : t("newBlog")} defaultOpen={Boolean(selected)}>
        <form action={saveBlogPost} className="content-form"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={selected?.id ?? ""}/>
          <Field label={t("fields.titleEn")} name="title_en" defaultValue={selected?.title_en}/><Field label={t("fields.titleBn")} name="title_bn" defaultValue={selected?.title_bn}/>
          <Field label={t("fields.slug")} name="slug" defaultValue={selected?.slug}/><SelectField label={t("status")} name="status" defaultValue={selected?.status ?? "draft"}><option value="draft">{t("draft")}</option><option value="published">{t("published")}</option><option value="archived">{t("archived")}</option></SelectField>
          <TextareaField label={t("fields.excerptEn")} name="excerpt_en" defaultValue={selected?.excerpt_en}/><TextareaField label={t("fields.excerptBn")} name="excerpt_bn" defaultValue={selected?.excerpt_bn}/>
          <TextareaField label={t("fields.bodyEn")} name="body_en" defaultValue={selected?.body_en} rows={10}/><TextareaField label={t("fields.bodyBn")} name="body_bn" defaultValue={selected?.body_bn} rows={10}/>
          <Field label={t("fields.coverPath")} name="cover_path" defaultValue={selected?.cover_path}/><Field label={t("fields.tags")} name="tags" defaultValue={selected?.tags?.join(", ")}/>
          <Field label={t("fields.seoTitle")} name="seo_title" defaultValue={seo.title}/><TextareaField label={t("fields.seoDescription")} name="seo_description" defaultValue={seo.description}/>
          <FormActions saveLabel={t("save")} cancelLabel={t("cancel")} cancelHref="/admin/content/blog" />
        </form>
      </EditorPanel>
      <section className="content-list"><div className="content-list-heading"><h2>{t("allItems")}</h2><span>{items.length}</span></div><div className="content-table-wrap"><table className="content-table"><thead><tr><th>{t("fields.titleEn")}</th><th>{t("status")}</th><th>{t("fields.tags")}</th><th>{t("actions")}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.title_en || t("untitled")}</strong><small>{item.slug}</small></td><td><StatusBadge active={item.status !== "draft"} activeLabel={item.status === "published" ? t("published") : t("archived")} inactiveLabel={t("draft")} warning={item.status === "archived"}/></td><td>{item.tags?.join(", ") || "—"}</td><td><div className="content-row-actions"><Link href={`/admin/content/blog?edit=${item.id}`}>{t("edit")}</Link><form action={deleteBlogPost}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="id" value={item.id}/><button className="danger" type="submit">{t("delete")}</button></form></div></td></tr>)}</tbody></table></div></section>
    </main>
  );
}
