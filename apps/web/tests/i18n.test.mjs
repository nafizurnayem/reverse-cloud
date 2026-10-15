import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const baseURL = process.env.I18N_TEST_BASE_URL ?? "http://127.0.0.1:3000";
const messages = Object.fromEntries(
  await Promise.all(
    ["en", "bn"].map(async (locale) => [
      locale,
      JSON.parse(
        await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"),
      ),
    ]),
  ),
);

function keys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "object" ? keys(child, path) : [path];
  }).sort();
}

test("English and Bangla have matching translation keys", () => {
  assert.deepEqual(keys(messages.en), keys(messages.bn));
});

for (const locale of ["en", "bn"]) {
  test(`${locale} renders translated content and language links`, async () => {
    const response = await fetch(`${baseURL}/${locale}`, {
      // A preference for the other locale must not override an explicit URL.
      headers: { "Accept-Language": locale === "en" ? "bn" : "en" },
      redirect: "manual",
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(`<html lang="${locale}">`));
    assert.ok(html.includes(`<h1>${messages[locale].Home.heading}</h1>`));
    assert.ok(html.includes(`<title>${messages[locale].Metadata.title}</title>`));
    assert.ok(html.includes('href="/en"'));
    assert.ok(html.includes('href="/bn"'));
    assert.ok(html.includes(`aria-label="${messages[locale].LanguageSwitcher.label}"`));
  });
}

test("root falls back to English and preserves the query string", async () => {
  const response = await fetch(`${baseURL}/?source=test`, {
    headers: { "Accept-Language": "fr" },
    redirect: "manual",
  });
  assert.equal(response.status, 307);
  const destination = new URL(response.headers.get("location"), baseURL);
  assert.equal(destination.pathname, "/en");
  assert.equal(destination.search, "?source=test");
});

test("root respects Bangla browser preference and the saved locale", async () => {
  for (const headers of [
    { "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8" },
    { "Accept-Language": "en", Cookie: "NEXT_LOCALE=bn" },
  ]) {
    const response = await fetch(baseURL, { headers, redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location"), baseURL).pathname, "/bn");
  }
});

test("unsupported locales and missing pages end in a 404", async () => {
  for (const path of ["/fr", "/en/not-a-page", "/bn/not-a-page"]) {
    const response = await fetch(`${baseURL}${path}`, {
      headers: { "Accept-Language": "en" },
    });
    assert.equal(response.status, 404, path);
  }
});

test("API endpoints bypass localization", async () => {
  for (const [path, method] of [
    ["/api/chat", "POST"],
    ["/api/chat/confirm-booking", "POST"],
    ["/api/estimate", "POST"],
    ["/api/leads", "POST"],
    ["/api/schedule/slots", "GET"],
    ["/v1/schedule/slots", "GET"],
    ["/api/webhooks/calcom", "POST"],
  ]) {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers: { "Accept-Language": "bn" },
      redirect: "manual",
    });
    assert.notEqual(response.status, 307, path);
    assert.equal(response.headers.get("location"), null);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/, path);
  }
});

test("static assets bypass localization", async () => {
  const html = await (await fetch(`${baseURL}/en`)).text();
  const asset = html.match(/(?:src|href)="(\/_next\/static\/[^\"]+)"/);
  assert.ok(asset, "Expected a Next.js asset in the rendered page");
  const response = await fetch(new URL(asset[1].replaceAll("&amp;", "&"), baseURL), {
    headers: { "Accept-Language": "bn" },
    redirect: "manual",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);

  const missingFile = await fetch(`${baseURL}/missing-file.txt`, { redirect: "manual" });
  assert.equal(missingFile.status, 404);
  assert.equal(missingFile.headers.get("location"), null);
});
