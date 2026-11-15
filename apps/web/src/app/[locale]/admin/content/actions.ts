"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { requirePermission } from "@/lib/auth/guards";
import type { Locale } from "@/lib/auth/routes";
import { staffDashboardPath, type StaffAccess } from "@/lib/auth/permissions";
import {
  checkbox,
  contentErrorKey,
  decimal,
  integer,
  normalizeSlug,
  optionalText,
  parseJson,
  stringList,
  stringValues,
  text,
  type ContentErrorKey,
} from "@/lib/admin/content-values";

type Resource = "services" | "faqs" | "portfolio" | "blog" | "settings";

function localeFrom(formData: FormData): Locale {
  const value = text(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function resourcePath(access: StaffAccess, resource: Resource) {
  return staffDashboardPath(access, `/content/${resource}`);
}

function actionError(access: StaffAccess, resource: Resource, error: ContentErrorKey): never {
  redirect(`${resourcePath(access, resource)}?error=${error}`);
}

function actionSuccess(locale: Locale, access: StaffAccess, resource: Resource, slug?: string): never {
  revalidatePath(`/${locale}/admin/content/${resource}`);
  for (const loc of routing.locales) {
    revalidatePath(`/${loc}/${resource}`);
    revalidatePath(`/${loc}/pricing`);
    revalidatePath(`/${loc}`);
    if (slug) {
      revalidatePath(`/${loc}/${resource}/${slug}`);
    }
  }
  revalidatePath(`/${resource}`);
  revalidatePath("/pricing");
  revalidatePath("/");
  redirect(`${resourcePath(access, resource)}?saved=1`);
}

function validId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function saveService(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const id = text(formData, "id");
  if (id && !validId(id)) actionError(access, "services", "invalidInput");
  const nameEn = text(formData, "name_en");
  const slug = normalizeSlug(text(formData, "slug") || nameEn);
  if (!nameEn || !slug) actionError(access, "services", "invalidInput");
  const isPublished = checkbox(formData, "is_published");
  const rawSummaryEn = optionalText(formData, "summary_en");
  const rawBodyEn = optionalText(formData, "body_en");
  const summaryEn = rawSummaryEn || (isPublished ? nameEn : null);
  const bodyEn = rawBodyEn || (isPublished ? (rawSummaryEn || nameEn) : null);
  const payload = {
    slug,
    name_en: nameEn,
    name_bn: optionalText(formData, "name_bn"),
    summary_en: summaryEn,
    summary_bn: optionalText(formData, "summary_bn"),
    body_en: bodyEn,
    body_bn: optionalText(formData, "body_bn"),
    icon: optionalText(formData, "icon"),
    pricing_model: text(formData, "pricing_model") || "custom",
    starting_from_usd: decimal(formData, "starting_from_usd"),
    sort_order: integer(formData, "sort_order"),
    is_published: isPublished,
  };
  const result = id && validId(id)
    ? await supabase.from("services").update(payload).eq("id", id)
    : await supabase.from("services").insert(payload);
  if (result.error) actionError(access, "services", contentErrorKey(result.error));
  actionSuccess(locale, access, "services", slug);
}

export async function setServiceArchived(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const id = text(formData, "id");
  if (!validId(id)) actionError(access, "services", "invalidInput");
  const archived = checkbox(formData, "archived");
  const result = await supabase.from("services").update({
    archived_at: archived ? new Date().toISOString() : null,
    ...(archived ? { is_published: false } : {}),
  }).eq("id", id);
  if (result.error) actionError(access, "services", contentErrorKey(result.error));
  actionSuccess(locale, access, "services");
}

export async function saveFaq(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const id = text(formData, "id");
  if (id && !validId(id)) actionError(access, "faqs", "invalidInput");
  const questionEn = text(formData, "question_en");
  const answerEn = text(formData, "answer_en");
  if (!questionEn || !answerEn) actionError(access, "faqs", "invalidInput");
  const serviceId = text(formData, "service_id");
  const payload = {
    service_id: validId(serviceId) ? serviceId : null,
    question_en: questionEn, question_bn: optionalText(formData, "question_bn"),
    answer_en: answerEn, answer_bn: optionalText(formData, "answer_bn"),
    sort_order: integer(formData, "sort_order"), is_published: checkbox(formData, "is_published"),
  };
  const result = id && validId(id)
    ? await supabase.from("faqs").update(payload).eq("id", id)
    : await supabase.from("faqs").insert(payload);
  if (result.error) actionError(access, "faqs", contentErrorKey(result.error));
  actionSuccess(locale, access, "faqs");
}

export async function deleteFaq(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const id = text(formData, "id");
  if (!validId(id)) actionError(access, "faqs", "invalidInput");
  const result = await supabase.from("faqs").delete().eq("id", id);
  if (result.error) actionError(access, "faqs", contentErrorKey(result.error));
  actionSuccess(locale, access, "faqs");
}

export async function savePortfolio(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const id = text(formData, "id");
  if (id && !validId(id)) actionError(access, "portfolio", "invalidInput");
  const titleEn = text(formData, "title_en");
  const slug = normalizeSlug(text(formData, "slug") || titleEn);
  if (!titleEn || !slug) actionError(access, "portfolio", "invalidInput");
  const published = checkbox(formData, "is_published");
  const payload = {
    slug, title_en: titleEn, title_bn: optionalText(formData, "title_bn"),
    summary_en: optionalText(formData, "summary_en"), summary_bn: optionalText(formData, "summary_bn"),
    challenge_en: optionalText(formData, "challenge_en"), challenge_bn: optionalText(formData, "challenge_bn"),
    solution_en: optionalText(formData, "solution_en"), solution_bn: optionalText(formData, "solution_bn"),
    result_en: optionalText(formData, "result_en"), result_bn: optionalText(formData, "result_bn"),
    cover_path: optionalText(formData, "cover_path"), live_url: optionalText(formData, "live_url"),
    tech_stack: stringList(formData, "tech_stack"),
    public_client_name: optionalText(formData, "public_client_name"),
    client_consent: checkbox(formData, "client_consent"),
    completed_on: optionalText(formData, "completed_on"),
    is_featured: checkbox(formData, "is_featured"), is_published: published,
    published_at: published ? new Date().toISOString() : null,
  };
  const result = id
    ? await supabase.from("portfolio_items").update(payload).eq("id", id).select("id").single()
    : await supabase.from("portfolio_items").insert(payload).select("id").single();
  if (result.error) actionError(access, "portfolio", contentErrorKey(result.error));
  const portfolioId = result.data.id;
  const serviceIds = stringValues(formData, "service_ids").filter(validId);
  const removed = await supabase.from("portfolio_services").delete().eq("portfolio_item_id", portfolioId);
  if (removed.error) actionError(access, "portfolio", contentErrorKey(removed.error));
  if (serviceIds.length) {
    const linked = await supabase.from("portfolio_services").insert(
      serviceIds.map((serviceId) => ({ portfolio_item_id: portfolioId, service_id: serviceId })),
    );
    if (linked.error) actionError(access, "portfolio", contentErrorKey(linked.error));
  }
  actionSuccess(locale, access, "portfolio");
}

const mediaTypes = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/avif", "avif"],
]);

export async function uploadPortfolioMedia(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const portfolioId = text(formData, "portfolio_item_id");
  const file = formData.get("file");
  if (!validId(portfolioId) || !(file instanceof File) || !file.size || file.size > 5_242_880 || !mediaTypes.has(file.type)) {
    actionError(access, "portfolio", "invalidFile");
  }
  const path = `portfolio/${portfolioId}/${crypto.randomUUID()}.${mediaTypes.get(file.type)}`;
  const uploaded = await supabase.storage.from("public-media").upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) actionError(access, "portfolio", "saveFailed");
  const inserted = await supabase.from("portfolio_media").insert({
    portfolio_item_id: portfolioId,
    storage_path: path,
    alt_en: optionalText(formData, "alt_en"),
    alt_bn: optionalText(formData, "alt_bn"),
    sort_order: integer(formData, "sort_order"),
  }).select("id").single();
  if (inserted.error) {
    await supabase.storage.from("public-media").remove([path]);
    actionError(access, "portfolio", contentErrorKey(inserted.error));
  }
  if (checkbox(formData, "use_as_cover")) {
    const covered = await supabase.from("portfolio_items").update({ cover_path: path }).eq("id", portfolioId);
    if (covered.error) actionError(access, "portfolio", contentErrorKey(covered.error));
  }
  revalidatePath(`/${locale}/admin/content/portfolio`);
  redirect(`${resourcePath(access, "portfolio")}?edit=${portfolioId}&saved=1`);
}

export async function deletePortfolioMedia(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const portfolioId = text(formData, "portfolio_item_id");
  const mediaId = text(formData, "media_id");
  if (!validId(portfolioId) || !validId(mediaId)) actionError(access, "portfolio", "invalidInput");
  const removed = await supabase.from("portfolio_media").delete().eq("id", mediaId).eq("portfolio_item_id", portfolioId).select("storage_path").single();
  if (removed.error) actionError(access, "portfolio", contentErrorKey(removed.error));
  await supabase.from("portfolio_items").update({ cover_path: null })
    .eq("id", portfolioId)
    .eq("cover_path", removed.data.storage_path);
  await supabase.storage.from("public-media").remove([removed.data.storage_path]);
  revalidatePath(`/${locale}/admin/content/portfolio`);
  redirect(`${resourcePath(access, "portfolio")}?edit=${portfolioId}&saved=1`);
}

export async function deletePortfolio(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const id = text(formData, "id");
  if (!validId(id)) actionError(access, "portfolio", "invalidInput");
  const media = await supabase.from("portfolio_media").select("storage_path").eq("portfolio_item_id", id);
  const result = await supabase.from("portfolio_items").delete().eq("id", id);
  if (result.error) actionError(access, "portfolio", contentErrorKey(result.error));
  const paths = (media.data ?? []).map((item) => item.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from("public-media").remove(paths);
  actionSuccess(locale, access, "portfolio");
}

export async function saveBlogPost(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, user, access } = await requirePermission(locale, "content.manage");
  const id = text(formData, "id");
  if (id && !validId(id)) actionError(access, "blog", "invalidInput");
  const titleEn = text(formData, "title_en");
  const slug = normalizeSlug(text(formData, "slug") || titleEn);
  if (!slug) actionError(access, "blog", "invalidInput");
  const status = text(formData, "status") || "draft";
  const payload = {
    slug, title_en: optionalText(formData, "title_en"), title_bn: optionalText(formData, "title_bn"),
    excerpt_en: optionalText(formData, "excerpt_en"), excerpt_bn: optionalText(formData, "excerpt_bn"),
    body_en: optionalText(formData, "body_en"), body_bn: optionalText(formData, "body_bn"),
    cover_path: optionalText(formData, "cover_path"), tags: stringList(formData, "tags"), status,
    published_at: status === "published" ? new Date().toISOString() : null,
    seo: { title: optionalText(formData, "seo_title"), description: optionalText(formData, "seo_description") },
  };
  const result = id && validId(id)
    ? await supabase.from("blog_posts").update(payload).eq("id", id)
    : await supabase.from("blog_posts").insert({ ...payload, author_id: user.id });
  if (result.error) actionError(access, "blog", contentErrorKey(result.error));
  actionSuccess(locale, access, "blog");
}

export async function deleteBlogPost(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const id = text(formData, "id");
  if (!validId(id)) actionError(access, "blog", "invalidInput");
  const current = await supabase.from("blog_posts").select("cover_path").eq("id", id).maybeSingle();
  const result = await supabase.from("blog_posts").delete().eq("id", id);
  if (result.error) actionError(access, "blog", contentErrorKey(result.error));
  const coverPath = current.data?.cover_path;
  if (typeof coverPath === "string" && coverPath && !coverPath.includes("://")) {
    await supabase.storage.from("public-media").remove([coverPath]);
  }
  actionSuccess(locale, access, "blog");
}

export async function saveSetting(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, user, access } = await requirePermission(locale, "content.manage");
  const key = text(formData, "key");
  if (!/^[a-z0-9_]+$/.test(key)) actionError(access, "settings", "invalidInput");
  let value: unknown;
  try { value = parseJson(text(formData, "value")); }
  catch { actionError(access, "settings", "invalidJson"); }
  const result = await supabase.from("site_settings").upsert({
    key, value: value!, is_public: checkbox(formData, "is_public"), updated_by: user.id,
  });
  if (result.error) actionError(access, "settings", contentErrorKey(result.error));
  actionSuccess(locale, access, "settings");
}

export async function deleteSetting(formData: FormData) {
  const locale = localeFrom(formData);
  const { supabase, access } = await requirePermission(locale, "content.manage");
  const key = text(formData, "key");
  if (!key) actionError(access, "settings", "invalidInput");
  const result = await supabase.from("site_settings").delete().eq("key", key);
  if (result.error) actionError(access, "settings", contentErrorKey(result.error));
  actionSuccess(locale, access, "settings");
}
