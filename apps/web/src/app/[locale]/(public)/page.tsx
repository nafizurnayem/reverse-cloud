import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <main className="landing">
      <p className="eyebrow">{t("brand")}</p>
      <h1>{t("heading")}</h1>
      <p className="description">{t("description")}</p>
      <p className="status">{t("status")}</p>
    </main>
  );
}
