/**
 * Получение текста для анализа: либо прямой текст, либо контент по ссылке на Telegram-пост.
 */

const TELEGRAM_LINK =
  /https?:\/\/(t\.me|telegram\.me|telegram\.dog)\/([a-zA-Z0-9_]+)\/(\d+)/i;
const TELEGRAM_LINK_CHANNEL = /https?:\/\/(t\.me|telegram\.me|telegram\.dog)\/([a-zA-Z0-9_]+)/i;

/** Проверка: строка — одна ссылка на t.me/telegram пост или канал. */
export function isTelegramPostLink(text: string): boolean {
  const t = text.trim();
  return TELEGRAM_LINK.test(t) || (TELEGRAM_LINK_CHANNEL.test(t) && t.startsWith("http"));
}

/**
 * Извлечение контента поста по ссылке t.me/… .
 * Страница t.me отдаёт HTML с meta и контентом — парсим og:description или тело.
 */
export async function getPostContent(link: string): Promise<string | null> {
  const url = link.trim();
  if (!isTelegramPostLink(url)) return null;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FindOriginBot/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const { load } = await import("cheerio");
    const $ = load(html);

    const ogDesc = $('meta[property="og:description"]').attr("content");
    if (ogDesc && ogDesc.length > 0) return ogDesc.trim();

    const tgDesc = $('meta[name="description"]').attr("content");
    if (tgDesc && tgDesc.length > 0) return tgDesc.trim();

    const body = $(".tgme_widget_message_text").first().text().trim();
    if (body) return body;

    return null;
  } catch {
    return null;
  }
}

/** Санитизация пользовательского текста (обрезка длины, базовая защита). */
function sanitize(text: string): string {
  return text
    .slice(0, 15_000)
    .replace(/\u0000/g, "")
    .trim();
}

/**
 * Итоговый вход для этапов обработки: одна строка текста.
 * Если прислали ссылку на пост — извлекаем контент; иначе — сам текст.
 */
export async function getInputText(rawInput: string): Promise<string | null> {
  const input = sanitize(rawInput);
  if (!input) return null;

  if (isTelegramPostLink(input)) {
    const content = await getPostContent(input);
    return content ?? null;
  }

  return input;
}
