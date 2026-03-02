/**
 * Общая логика обработки сообщения пользователя: приветствия, поиск источников, ответ.
 * Используется и в webhook (route.ts), и в локальном long-polling боте (local-bot.ts).
 */

import { sendMessage } from "./telegram";
import { getInputText } from "./input";
import { findCandidateSourcesSimple } from "./search";
import { rankSourcesByMeaning, explainWithoutSources } from "./ai";

export function formatResult(
  sources: { url: string; reason?: string }[],
  confidence: number
): string {
  if (sources.length === 0) {
    return `Подходящих источников не найдено. Уверенность: ${confidence}%.`;
  }
  const lines = sources.map(
    (s) => (s.reason ? `• ${s.url}\n  ${s.reason}` : `• ${s.url}`)
  );
  return [`Найденные источники (уверенность: ${confidence}%):`, "", ...lines].join("\n");
}

export async function processUpdate(chatId: number, rawInput: string): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!token) {
    console.error("[processUpdate] BOT_TOKEN не задан");
    return;
  }
  if (!openRouterKey) {
    await sendMessage(token, chatId, "Ошибка: OPENROUTER_API_KEY не задан.");
    return;
  }

  try {
    const trimmed = rawInput.trim();
    if (trimmed === "/start" || trimmed.toLowerCase() === "/start") {
      await sendMessage(
        token,
        chatId,
        "Привет! Пришлите текст новости или утверждения — найду возможные источники. Можно также прислать ссылку на пост t.me/…"
      );
      return;
    }

    const greeting = /^(привет|здравствуй|хай|hello|hi|здарова|как дела|что делаешь)(\s+бот)?[\.\!\)]*$/i;
    if (greeting.test(trimmed)) {
      await sendMessage(
        token,
        chatId,
        "Привет! Напишите текст или утверждение для проверки — подберу источники. Либо ссылку на пост t.me/…"
      );
      return;
    }

    const inputText = await getInputText(rawInput);
    if (!inputText) {
      await sendMessage(
        token,
        chatId,
        "Не удалось получить текст. Пришлите текст сообщения или ссылку на пост t.me/…"
      );
      return;
    }

    const candidates = await findCandidateSourcesSimple(inputText, 10);

    if (candidates.length === 0) {
      // Если внешний поиск ничего не нашёл, всё равно даём пользователю полезный ответ через AI.
      const explanation = await explainWithoutSources(inputText, openRouterKey);
      await sendMessage(
        token,
        chatId,
        `Поиск не нашёл конкретных ссылок, но вот разбор новости:\n\n${explanation}`
      );
      return;
    }

    const { sources, confidence } = await rankSourcesByMeaning(
      inputText,
      candidates,
      openRouterKey
    );

    const message = formatResult(sources, confidence);
    await sendMessage(token, chatId, message);
  } catch (err) {
    console.error("[processUpdate] error:", err);
    const msg = err instanceof Error ? err.message : "Произошла ошибка.";
    await sendMessage(token, chatId, `Ошибка: ${msg}`);
  }
}
