import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import {
  ActionMessage,
  CheckboxField,
  ContentHeader,
  EditorPanel,
  Field,
  FormActions,
} from "@/components/admin-content";
import { ServiceIcon } from "@/components/service-icon";
import {
  saveServiceGroup,
  setServiceGroupActive,
  updateServiceGroupMembers,
  deleteServiceGroup,
} from "../actions";

type Search = {
  edit?: string;
  saved?: string;
  error?: string;
  manage?: string; // group id whose members are being managed
};

export default async function ServiceGroupsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [{ supabase }, query, t] = await Promise.all([
    requirePermission(locale, "content.manage"),
    searchParams,
    getTranslations({ locale, namespace: "AdminContent" }),
  ]);

  const isBn = locale === "bn";

  // Load all service groups
  const { data: groups, error: ge } = await supabase
    .from("service_groups")
    .select("id, slug, name_en, name_bn, sort_order, is_active, created_at")
    .order("sort_order")
    .order("name_en");

  // Load all published services (for member assignment)
  const { data: allServices } = await supabase
    .from("services")
    .select("id, slug, name_en, name_bn, icon")
    .eq("is_published", true)
    .is("archived_at", null)
    .order("sort_order")
    .order("name_en");

  // Load existing group members
  const { data: allMembers } = await supabase
    .from("service_group_members")
    .select("group_id, service_id, sort_order");

  const memberMap = new Map<string, { service_id: string; sort_order: number }[]>();
  for (const m of allMembers ?? []) {
    if (!memberMap.has(m.group_id)) memberMap.set(m.group_id, []);
    memberMap.get(m.group_id)!.push({ service_id: m.service_id, sort_order: m.sort_order });
  }

  const assignedServiceIds = new Set((allMembers ?? []).map((m) => m.service_id));

  const selectedGroup = (groups ?? []).find((g) => g.id === query.edit);
  const managingGroup = (groups ?? []).find((g) => g.id === query.manage);
  const errorMessage = query.error ? t(`errors.${query.error}`) : null;

  return (
    <main className="admin-page content-page">
      <ContentHeader
        eyebrow={t("eyebrow")}
        title={isBn ? "সার্ভিস গ্রুপ" : "Service Groups"}
        description={
          isBn
            ? "নেভিগেশন মেগামেনুতে সার্ভিসগুলো গ্রুপ করুন। প্রতিটি গ্রুপ হোভার মেনুতে একটি কলাম হিসেবে দেখাবে।"
            : "Group services into named categories that appear in the navigation mega-menu. Each active group shows as a column on hover."
        }
        backLabel={t("back")}
      />
      <ActionMessage saved={query.saved ? t("saved") : null} error={errorMessage} />
      {ge ? (
        <div style={{ padding: "1rem", borderRadius: "0.75rem", background: "rgba(234, 88, 12, 0.1)", border: "1px solid rgba(234, 88, 12, 0.3)", marginBottom: "1.5rem" }}>
          <strong style={{ display: "block", color: "rgb(234, 88, 12)", marginBottom: "0.25rem" }}>
            {isBn ? "ডাটাবেজ টেবিল তৈরি করা হয়নি" : "Database table not found"}
          </strong>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--foreground)" }}>
            {isBn
              ? "অনুগ্রহ করে Supabase SQL Editor-এ 'supabase/migrations/0037_service_groups.sql' ফাইলের কোড চালান।"
              : "Please run the migration SQL file (supabase/migrations/0037_service_groups.sql) in your Supabase SQL Editor to create the service_groups tables."}
          </p>
        </div>
      ) : null}

      {/* ── Create / Edit Group Form ── */}
      <EditorPanel
        title={selectedGroup ? t("editItem") : (isBn ? "নতুন গ্রুপ তৈরি করুন" : "Create a new group")}
        defaultOpen={Boolean(selectedGroup)}
      >
        <form action={saveServiceGroup} className="content-form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={selectedGroup?.id ?? ""} />
          <Field
            label={isBn ? "ইংরেজি নাম" : "English name"}
            name="name_en"
            defaultValue={selectedGroup?.name_en}
            required
          />
          <Field
            label={isBn ? "বাংলা নাম" : "Bangla name"}
            name="name_bn"
            defaultValue={selectedGroup?.name_bn ?? ""}
          />
          <Field
            label={isBn ? "স্লাগ" : "Slug"}
            name="slug"
            defaultValue={selectedGroup?.slug}
            placeholder="app-development"
          />
          <Field
            label={isBn ? "সর্ট অর্ডার" : "Sort order"}
            name="sort_order"
            type="number"
            defaultValue={selectedGroup?.sort_order ?? 0}
          />
          <CheckboxField
            label={isBn ? "মেনুতে সক্রিয়" : "Active in mega-menu"}
            name="is_active"
            defaultChecked={selectedGroup ? selectedGroup.is_active : true}
            hint={isBn ? "নিষ্ক্রিয় গ্রুপ নেভিগেশনে দেখাবে না।" : "Inactive groups are hidden from the navigation."}
          />
          <FormActions
            saveLabel={t("save")}
            cancelLabel={t("cancel")}
            cancelHref="/admin/content/service-groups"
          />
        </form>
      </EditorPanel>

      {/* ── Manage group members panel ── */}
      {managingGroup && (
        <section className="content-editor-section mt-6">
          <div className="content-editor-header flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {isBn ? "সার্ভিস নির্বাচন করুন" : "Assign services to group"}{" "}
                <span className="text-primary">&quot;{managingGroup.name_en}&quot;</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isBn
                  ? "নির্বাচিত সার্ভিসগুলো এই গ্রুপে থাকবে। অন্য গ্রুপে যুক্ত সার্ভিসগুলো দেখানো হচ্ছে না।"
                  : "Selected services will appear under this group. Services already in another group are not listed."}
              </p>
            </div>
            <Link
              href="/admin/content/service-groups"
              className="rounded-lg border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              {t("cancel")}
            </Link>
          </div>

          <form action={updateServiceGroupMembers} className="mt-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="group_id" value={managingGroup.id} />

            {/* Available services */}
            {(() => {
              const currentMembers = memberMap.get(managingGroup.id) ?? [];
              const currentMemberIds = new Set(currentMembers.map((m) => m.service_id));
              // Show: services assigned to THIS group, or unassigned
              const eligible = (allServices ?? []).filter(
                (s) => currentMemberIds.has(s.id) || !assignedServiceIds.has(s.id)
              );

              if (!eligible.length) {
                return (
                  <p className="p-4 text-sm text-muted-foreground">
                    {isBn ? "কোনো উপলব্ধ সার্ভিস নেই।" : "No available services to assign."}
                  </p>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {eligible.map((svc) => (
                    <label
                      key={svc.id}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        name="service_ids"
                        value={svc.id}
                        defaultChecked={currentMemberIds.has(svc.id)}
                        className="h-4 w-4 rounded accent-primary"
                      />
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary overflow-hidden">
                        <ServiceIcon icon={svc.icon} className="h-4 w-4" imgClassName="h-full w-full object-contain" />
                      </span>
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-foreground">
                          {svc.name_en}
                        </span>
                        {svc.name_bn && (
                          <span className="block truncate text-[10px] text-muted-foreground">{svc.name_bn}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              );
            })()}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {isBn ? "সংরক্ষণ করুন" : t("save")}
              </button>
              <Link
                href="/admin/content/service-groups"
                className="rounded-xl border px-5 py-2 text-xs font-medium hover:bg-muted transition-colors"
              >
                {t("cancel")}
              </Link>
            </div>
          </form>
        </section>
      )}

      {/* ── All Groups Table ── */}
      <section className="content-list">
        <div className="content-list-heading">
          <h2>{isBn ? "সব গ্রুপ" : "All Groups"}</h2>
          <span>{(groups ?? []).length}</span>
        </div>

        {(groups ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {isBn ? "কোনো গ্রুপ তৈরি হয়নি।" : "No groups created yet. Add one above."}
          </p>
        ) : (
          <div className="content-table-wrap">
            <table className="content-table">
              <thead>
                <tr>
                  <th>{isBn ? "নাম" : "Name"}</th>
                  <th>{isBn ? "সার্ভিস" : "Services"}</th>
                  <th>{isBn ? "অবস্থা" : "Status"}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {(groups ?? []).map((group) => {
                  const members = memberMap.get(group.id) ?? [];
                  const memberServices = members
                    .map((m) => (allServices ?? []).find((s) => s.id === m.service_id))
                    .filter((s): s is NonNullable<typeof s> => Boolean(s));

                  return (
                    <tr key={group.id}>
                      <td>
                        <div>
                          <strong>{group.name_en}</strong>
                          {group.name_bn && <small className="block text-muted-foreground">{group.name_bn}</small>}
                          <small className="text-muted-foreground">{group.slug}</small>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {memberServices.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">
                              {isBn ? "কোনো সার্ভিস নেই" : "No services"}
                            </span>
                          ) : (
                            memberServices.map((svc) => svc && (
                              <span
                                key={svc.id}
                                className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium"
                              >
                                <span className="grid h-3.5 w-3.5 place-items-center overflow-hidden">
                                  <ServiceIcon icon={svc.icon} className="h-2.5 w-2.5" imgClassName="h-full w-full object-contain" />
                                </span>
                                {svc.name_en}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            group.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {group.is_active ? (isBn ? "সক্রিয়" : "Active") : (isBn ? "নিষ্ক্রিয়" : "Inactive")}
                        </span>
                      </td>
                      <td>
                        <div className="content-row-actions">
                          <Link href={`/admin/content/service-groups?edit=${group.id}`}>
                            {t("edit")}
                          </Link>
                          <Link href={`/admin/content/service-groups?manage=${group.id}`} className="font-medium text-primary">
                            {isBn ? "সার্ভিস যোগ করুন" : "Manage Services"}
                          </Link>
                          <form action={setServiceGroupActive}>
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="id" value={group.id} />
                            <input type="hidden" name="active" value={group.is_active ? "false" : "true"} />
                            <button type="submit">
                              {group.is_active ? (isBn ? "নিষ্ক্রিয় করুন" : "Deactivate") : (isBn ? "সক্রিয় করুন" : "Activate")}
                            </button>
                          </form>
                          <form action={deleteServiceGroup}>
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="id" value={group.id} />
                            <button type="submit" style={{ color: "var(--destructive, #ef4444)" }}>
                              {t("delete")}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
