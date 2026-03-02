/**
 * Извлечение сущностей из текста: даты, числа, имена, ссылки, ключевые утверждения.
 */

import type { ExtractedEntities, SearchQuery } from "../types";

/** Нормализация текста: пробелы, переносы, лишние символы. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

/** Даты: DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD, месяц словом и т.п. */
const DATE_PATTERNS = [
  /\d{1,2}\.\d{1,2}\.\d{2,4}/g,
  /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
  /\d{4}-\d{2}-\d{2}/g,
  /\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{2,4}/gi,
];

/** Числа: целые, с точкой/запятой, проценты. */
const NUMBER_PATTERN = /(\d[\d\s.,]*\d|\d+)(?:\s*%)?/g;

/** URL. */
const LINK_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

function extractDates(text: string): string[] {
  const set = new Set<string>();
  for (const re of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) m.forEach((s) => set.add(s.trim()));
  }
  return Array.from(set);
}

function extractNumbers(text: string): string[] {
  const m = text.match(NUMBER_PATTERN);
  if (!m) return [];
  return Array.from(new Set(m.map((s) => s.trim()).filter((s) => s.length <= 30)));
}

function extractLinks(text: string): string[] {
  const m = text.match(LINK_PATTERN);
  if (!m) return [];
  return Array.from(new Set(m.map((s) => s.trim())));
}

/** Простая эвристика имён: слова с заглавной буквы (2+ буквы), не в начале предложения опционально. */
function extractNames(text: string): string[] {
  const words = text.split(/\s+/);
  const names: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const clean = w.replace(/[^\p{L}\p{N}-]/gu, "");
    if (clean.length >= 2 && clean[0] === clean[0].toUpperCase() && /[\p{L}]/u.test(clean)) {
      if (!seen.has(clean)) {
        seen.add(clean);
        names.push(clean);
      }
    }
  }
  return names.slice(0, 50);
}

/** Утверждения: фразы в кавычках и короткие предложения (до ~120 символов). */
function extractClaims(text: string): string[] {
  const claims: string[] = [];
  let match: RegExpExecArray | null;
  const re = /["«»]([^"«»]+)["«»]|"([^"]+)"|'([^']+)'/g;
  while ((match = re.exec(text)) !== null) {
    const phrase = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (phrase.length >= 3 && phrase.length <= 500) claims.push(phrase);
  }
  const sentences = text.split(/[.!?]\s+/).map((s) => s.trim());
  for (const s of sentences) {
    if (s.length >= 10 && s.length <= 120 && !claims.includes(s)) claims.push(s);
  }
  return Array.from(new Set(claims)).slice(0, 20);
}

/**
 * Извлечь сущности из текста.
 */
export function extractEntities(text: string): ExtractedEntities {
  const normalized = normalizeText(text);
  return {
    dates: extractDates(normalized),
    numbers: extractNumbers(normalized),
    names: extractNames(normalized),
    links: extractLinks(normalized),
    claims: extractClaims(normalized),
  };
}

/**
 * Структурированный запрос для этапа поиска: ключевые фразы + сущности.
 * При пустых утверждениях используем весь текст как один запрос.
 */
export function buildSearchQuery(
  rawText: string,
  entities: ExtractedEntities
): SearchQuery {
  const normalized = normalizeText(rawText);
  const keyPhrases =
    entities.claims.length > 0
      ? entities.claims
      : (normalized.length <= 500 ? [normalized] : [normalized.slice(0, 500)]);

  return {
    keyPhrases,
    entities,
    rawText: normalized,
  };
}
