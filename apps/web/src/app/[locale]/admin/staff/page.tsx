import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ActionMessage, ContentHeader, StatusBadge } from "@/components/admin-content";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import { addStaffMember, setStaffRoleStatus } from "./actions";

type Search = { saved?: string; error?: string };
type Role = { id: string; key: string; name: string; description: string | null };
type Assignment = { user_id: string; role_id: string; is_active: boolean };
type DirectoryUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

const savedKeys = new Set(["activated", "deactivated", "added"]);
const errorKeys = new Set(["invalidInput", "lastActiveAdmin", "saveFailed", "userNotFound"]);

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
  const local = locale === "bn" ? {
    addTitle: "স্টাফ সদস্য যোগ করুন",
    addDescription: "আগে সাইন ইন করা অ্যাকাউন্টের সঠিক ইমেইল লিখে প্রথম রোলটি নির্বাচন করুন।",
    emailLabel: "অ্যাকাউন্ট ইমেইল",
    roleLabel: "প্রাথমিক রোল",
    rolePlaceholder: "একটি রোল বেছে নিন",
    addSubmit: "স্টাফ সদস্য যোগ করুন",
    added: "স্টাফ সদস্য যোগ হয়েছে এবং নির্বাচিত রোলটি সক্রিয় আছে।",
    userNotFound: "এই ইমেইলের কোনো সাইন-ইন করা অ্যাকাউন্ট পাওয়া যায়নি। ব্যক্তিটিকে একবার সাইন ইন করতে বলুন, তারপর আবার চেষ্টা করুন।",
    staffOnlyDescription: "শুধু স্টাফ-রোল অ্যাসাইনমেন্ট থাকা অ্যাকাউন্ট এখানে দেখা যাবে। নিষ্ক্রিয় করলে অ্যাসাইনমেন্ট ও অডিট ইতিহাস সংরক্ষিত থাকে।",
  } : {
    addTitle: "Add staff member",
    addDescription: "Enter the exact email of an existing signed-in account and choose its first role.",
    emailLabel: "Account email",
    roleLabel: "Initial role",
    rolePlaceholder: "Choose a role",
    addSubmit: "Add staff member",
    added: "The staff member was added and the selected role is active.",
    userNotFound: "No signed-in account matches that email. Ask the person to sign in once, then try again.",
    staffOnlyDescription: "Only accounts with a staff-role assignment appear here. Deactivation preserves the assignment and its audit history.",
  };
  const saved = typeof search.saved === "string" && savedKeys.has(search.saved)
    ? search.saved === "added" ? local.added : t(`saved.${search.saved}`)
    : null;
  const error = typeof search.error === "string" && errorKeys.has(search.error)
    ? search.error === "userNotFound" ? local.userNotFound : t(`errors.${search.error}`)
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

      <section className="content-editor">
        <h2>{local.addTitle}</h2>
        <p className="staff-help">{local.addDescription}</p>
        <form action={addStaffMember} className="content-form">
          <input type="hidden" name="locale" value={locale} />
          <label className="content-field">
            <span>{local.emailLabel}</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="staff@example.com"
              required
            />
          </label>
          <label className="content-field">
            <span>{local.roleLabel}</span>
            <select name="role_id" required defaultValue="">
              <option value="" disabled>{local.rolePlaceholder}</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>
          <button className="content-primary-button" type="submit">{local.addSubmit}</button>
        </form>
      </section>

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
        <p className="staff-help">{local.staffOnlyDescription}</p>
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
