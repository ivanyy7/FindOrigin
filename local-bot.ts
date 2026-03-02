/**
 * Локальный бот FindOrigin: long polling.
 * Запуск: npm run bot (из корня проекта).
 * Перед запуском: вебхук должен быть отключён (deleteWebhook).
 * Переменные окружения берутся из .env (через dotenv при npm run bot).
 */

import "dotenv/config";
import { sendMessage } from "./lib/telegram";
import { processUpdate } from "./lib/processUpdate";

const TELEGRAM_API = "https://api.telegram.org/bot";
const POLL_TIMEOUT_SEC = 30;

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    text?: string;
  };
}

async function getUpdates(token: string, offset?: number): Promise<TelegramUpdate[]> {
  const url = new URL(`${TELEGRAM_API}${token}/getUpdates`);
  url.searchParams.set("timeout", String(POLL_TIMEOUT_SEC));
  if (offset !== undefined) url.searchParams.set("offset", String(offset));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout((POLL_TIMEOUT_SEC + 5) * 1000) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getUpdates failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { ok: boolean; result?: TelegramUpdate[] };
  if (!data.ok || !Array.isArray(data.result)) return [];
  return data.result;
}

async function run(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("Ошибка: в .env не задан BOT_TOKEN.");
    process.exit(1);
  }
  console.log("FindOrigin локальный бот запущен (long polling). Остановка: Ctrl+C.");
  let offset: number | undefined;
  for (;;) {
    try {
      const updates = await getUpdates(token, offset);
      for (const u of updates) {
        offset = u.update_id + 1;
        const chatId = u.message?.chat?.id;
        const text = u.message?.text?.trim();
        if (typeof chatId !== "number" || !text) continue;
        const isQuickReply =
          text === "/start" ||
          /^(привет|здравствуй|хай|hello|hi|здарова|как дела|что делаешь)(\s+бот)?[\.\!\)]*$/i.test(text);
        if (!isQuickReply) {
          await sendMessage(token, chatId, "Получил сообщение, ищу источники…").catch(() => {});
        }
        await processUpdate(chatId, text);
      }
    } catch (err) {
      console.error("[local-bot] getUpdates/process error:", err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

run();
