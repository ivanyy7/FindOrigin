/**
 * Поиск кандидатов-источников через Google Custom Search JSON API.
 */

import type { SearchCandidate } from "@/types";

const GOOGLE_CSE_URL = "https://customsearch.googleapis.com/customsearch/v1";
const MAX_RESULTS = 10;

export interface SearchOptions {
  apiKey: string;
  cx: string;
  num?: number;
}

/**
 * Поиск по запросу: возвращает список кандидатов (URL, заголовок, сниппет).
 */
export async function findCandidateSources(
  query: string,
  options: SearchOptions
): Promise<SearchCandidate[]> {
  const trimmed = query.trim().slice(0, 500);
  if (!trimmed) return [];

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
    items?: Array<{
      link?: string;
      title?: string;
      snippet?: string;
    }>;
  };

  if (!data.items || !Array.isArray(data.items)) return [];

  return data.items
    .filter((item) => item.link)
    .map((item) => ({
      url: item.link ?? "",
      title: item.title ?? "",
      snippet: item.snippet ?? "",
    }));
}
