/**
 * Поиск кандидатов-источников: сначала Google Custom Search, при ошибке — запасной поиск через DuckDuckGo (без ключа).
 */

import type { SearchCandidate } from "../types";

const GOOGLE_CSE_URL = "https://customsearch.googleapis.com/customsearch/v1";
const MAX_RESULTS = 10;

export interface SearchOptions {
  apiKey: string;
  cx: string;
  num?: number;
}

/** Извлечь реальный URL из редиректа DuckDuckGo (uddg). */
function resolveDuckDuckGoLink(href: string): string {
  let link = href.trim();
  if (link.startsWith("//")) link = "https:" + link;
  try {
    const u = new URL(link);
    if (u.searchParams.has("uddg")) {
      const decoded = decodeURIComponent(u.searchParams.get("uddg") ?? "");
      if (decoded.startsWith("http")) return decoded;
    }
    if (link.startsWith("http") && !u.hostname.includes("duckduckgo.com")) return link;
  } catch {
    // ignore
  }
  return link.startsWith("http") ? link : "";
}

/** Запасной поиск через DuckDuckGo HTML (без API-ключа). */
async function searchDuckDuckGo(query: string): Promise<SearchCandidate[]> {
  const trimmed = query.trim().slice(0, 300);
  if (!trimmed) return [];
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const { load } = await import("cheerio");
    const $ = load(html);
    const results: SearchCandidate[] = [];
    const seen = new Set<string>();

    // Вариант 1: классические классы .result
    $(".result").each((_, el) => {
      const $el = $(el);
      const a = $el.find("a.result__a").first();
      let link = $el.find(".result__url").attr("href") || a.attr("href") || "";
      link = resolveDuckDuckGoLink(link);
      const title = $el.find(".result__title").text().trim() || a.text().trim();
      const snippet = $el.find(".result__snippet").text().trim();
      if (link && !seen.has(link)) {
        seen.add(link);
        results.push({ url: link, title: title || link, snippet: snippet || "" });
      }
    });

    // Вариант 2: если ничего не нашли — любые ссылки из основного контента (не на duckduckgo)
    if (results.length === 0) {
      $(".results_links .result__a, .result a[href^='http'], a[href*='uddg=']").each((_, el) => {
        const $a = $(el);
        let link = $a.attr("href") || "";
        link = resolveDuckDuckGoLink(link);
        if (link && !link.includes("duckduckgo.com") && !seen.has(link)) {
          seen.add(link);
          results.push({ url: link, title: $a.text().trim() || link, snippet: "" });
        }
      });
    }

    return results.slice(0, 10);
  } catch {
    return [];
  }
}

/**
 * Поиск по запросу: сначала Google, при ошибке (например 403) — DuckDuckGo.
 */
export async function findCandidateSources(
  query: string,
  options: SearchOptions
): Promise<SearchCandidate[]> {
  const trimmed = query.trim().slice(0, 500);
  if (!trimmed) return [];

  try {
    const num = Math.min(options.num ?? MAX_RESULTS, 10);
    const params = new URLSearchParams({
      key: options.apiKey,
      cx: options.cx,
      q: trimmed,
      num: String(num),
    });
    const url = `${GOOGLE_CSE_URL}?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Google Search API error: ${res.status} ${err}`);
    }
    const data = (await res.json()) as {
      items?: Array<{ link?: string; title?: string; snippet?: string }>;
    };
    if (!data.items || !Array.isArray(data.items)) return [];
    return data.items
      .filter((item) => item.link)
      .map((item) => ({
        url: item.link ?? "",
        title: item.title ?? "",
        snippet: item.snippet ?? "",
      }));
  } catch {
    console.log("[search] Google недоступен, используется запасной поиск DuckDuckGo…");
    const fallback = await searchDuckDuckGo(trimmed);
    if (fallback.length > 0) {
      console.log("[search] DuckDuckGo вернул", fallback.length, "результатов.");
      return fallback;
    }
    console.log("[search] DuckDuckGo не дал результатов.");
    throw new Error(
      "Поиск недоступен: у проекта нет доступа к Google Custom Search API (403). Запасной поиск не дал результатов. Проверьте настройки в Google Cloud и Programmable Search Engine или попробуйте позже."
    );
  }
}
