import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ActionMessage, ContentHeader, StatusBadge } from "@/components/admin-content";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { setStaffRoleStatus } from "./actions";

type Search = { saved?: string; error?: string };
type Role = { id: string; key: string; name: string; description: string | null };
type Assignment = { user_id: string; role_id: string; is_active: boolean };
type DirectoryUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

const savedKeys = new Set(["activated", "deactivated"]);
const errorKeys = new Set(["invalidInput", "lastActiveAdmin", "saveFailed"]);

function userName(user: DirectoryUser, fallback: string) {
  if (user.full_name?.trim()) return user.full_name.trim();
  return user.email ?? fallback;
}

export default async function StaffPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const [{ supabase, user: currentUser }, search, t, common] = await Promise.all([
    requirePermission(locale, "staff.manage"),
    searchParams,
    getTranslations({ locale, namespace: "AdminStaff" }),
    getTranslations({ locale, namespace: "AdminContent" }),
  ]);
  const [usersResult, rolesResult, assignmentsResult] = await Promise.all([
    supabase.rpc("list_staff_directory"),
    supabase.from("roles").select("id,key,name,description").order("name"),
    supabase.from("staff_roles").select("user_id,role_id,is_active"),
  ]);
  if (usersResult.error || rolesResult.error || assignmentsResult.error) {
    throw new Error("Unable to load staff access");
  }

  const users = ((usersResult.data ?? []) as DirectoryUser[]).sort((left, right) =>
    userName(left, left.user_id).localeCompare(userName(right, right.user_id), locale),
  );
  const roles = (rolesResult.data ?? []) as Role[];
  const assignments = (assignmentsResult.data ?? []) as Assignment[];
  const assignmentMap = new Map(assignments.map((item) => [`${item.user_id}:${item.role_id}`, item]));
  const activeStaff = new Set(assignments.filter((item) => item.is_active).map((item) => item.user_id));
  const saved = typeof search.saved === "string" && savedKeys.has(search.saved)
    ? t(`saved.${search.saved}`)
    : null;
  const error = typeof search.error === "string" && errorKeys.has(search.error)
    ? t(`errors.${search.error}`)
    : null;
  const joined = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <main className="admin-page content-page staff-page">
      <ContentHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        backLabel={common("backDashboard")}
        backHref="/admin"
      />
      <ActionMessage saved={saved} error={error} />

      <section className="content-editor staff-role-summary">
        <h2>{t("rolesTitle")}</h2>
        <div className="staff-role-grid">
          {roles.map((role) => (
            <article key={role.id}>
              <strong>{role.name}</strong>
              <code>{role.key}</code>
              <p>{role.description ?? t("noDescription")}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-list">
        <div className="content-list-heading">
          <h2>{t("peopleTitle")}</h2>
          <span>{users.length}</span>
        </div>
        <p className="staff-help">{t("peopleDescription")}</p>
        <div className="content-table-wrap">
          <table className="content-table staff-table">
            <thead>
              <tr>
                <th>{t("columns.person")}</th>
                <th>{t("columns.status")}</th>
                {roles.map((role) => <th key={role.id}>{role.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.user_id}>
                  <td className="staff-user-identity">
                    <strong>{userName(user, t("unknownUser"))}</strong>
                    <small>{user.email ?? t("unknownEmail")}</small>
                    <small>{t("joined", { date: joined.format(new Date(user.created_at)) })}</small>
                    {user.user_id === currentUser.id ? <em>{t("you")}</em> : null}
                  </td>
                  <td>
                    <StatusBadge
                      active={activeStaff.has(user.user_id)}
                      activeLabel={t("activeStaff")}
                      inactiveLabel={t("notStaff")}
                    />
                  </td>
                  {roles.map((role) => {
                    const assignment = assignmentMap.get(`${user.user_id}:${role.id}`);
                    const active = assignment?.is_active === true;
                    return (
                      <td key={role.id}>
                        <form action={setStaffRoleStatus} className="staff-role-action">
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="user_id" value={user.user_id} />
                          <input type="hidden" name="role_id" value={role.id} />
                          <input type="hidden" name="is_active" value={active ? "false" : "true"} />
                          <StatusBadge
                            active={active}
                            activeLabel={t("assigned")}
                            inactiveLabel={t("unassigned")}
                          />
                          <button
                            className={`content-secondary-button${active ? " danger" : ""}`}
                            type="submit"
                          >
                            {active ? t("deactivate") : assignment ? t("reactivate") : t("assign")}
                          </button>
                        </form>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
