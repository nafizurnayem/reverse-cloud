import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { ActionMessage, CheckboxField, ContentHeader, EditorPanel, Field, FormActions, StatusBadge, TextareaField } from "@/components/admin-content";
import { deleteSetting, saveSetting } from "../actions";

type Search = { edit?: string; saved?: string; error?: string };

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [{ supabase }, query, t] = await Promise.all([requirePermission(locale, "content.manage"), searchParams, getTranslations({ locale, namespace: "AdminContent" })]);
  const { data, error } = await supabase.from("site_settings").select("*").order("key");
  if (error) throw new Error("Unable to load settings");
  const items = data ?? []; const selected = items.find((item) => item.key === query.edit);
  return (
    <main className="admin-page content-page">
      <ContentHeader eyebrow={t("eyebrow")} title={t("resources.settings.title")} description={t("resources.settings.description")} backLabel={t("back")} />
      <ActionMessage saved={query.saved ? t("saved") : null} error={query.error ? t(`errors.${query.error}`) : null} />
      <EditorPanel title={selected ? t("editItem") : t("newSetting")} defaultOpen={Boolean(selected)}>
        <form action={saveSetting} className="content-form"><input type="hidden" name="locale" value={locale}/>
          <Field label={t("fields.settingKey")} name="key" defaultValue={selected?.key} required readOnly={Boolean(selected)}/>
          <TextareaField label={t("fields.jsonValue")} name="value" defaultValue={selected ? JSON.stringify(selected.value, null, 2) : ""} required rows={7} placeholder='"value"'/>
          <CheckboxField label={t("fields.publicSetting")} name="is_public" defaultChecked={selected?.is_public} hint={t("hints.publicSetting")}/>
          <FormActions saveLabel={t("save")} cancelLabel={t("cancel")} cancelHref="/admin/content/settings" />
        </form>
      </EditorPanel>
      <section className="content-list"><div className="content-list-heading"><h2>{t("allItems")}</h2><span>{items.length}</span></div><div className="content-table-wrap"><table className="content-table"><thead><tr><th>{t("fields.settingKey")}</th><th>{t("fields.jsonValue")}</th><th>{t("visibility")}</th><th>{t("actions")}</th></tr></thead><tbody>{items.map((item) => <tr key={item.key}><td><strong>{item.key}</strong></td><td><code>{JSON.stringify(item.value)}</code></td><td><StatusBadge active={item.is_public} activeLabel={t("public")} inactiveLabel={t("private")}/></td><td><div className="content-row-actions"><Link href={`/admin/content/settings?edit=${encodeURIComponent(item.key)}`}>{t("edit")}</Link><form action={deleteSetting}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="key" value={item.key}/><button className="danger" type="submit">{t("delete")}</button></form></div></td></tr>)}</tbody></table></div></section>
    </main>
  );
}
