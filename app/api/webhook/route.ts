import { NextRequest, NextResponse } from "next/server";
import type { TelegramUpdate } from "@/types";
import { sendMessage } from "@/lib/telegram";
import { getInputText } from "@/lib/input";
import { findCandidateSources } from "@/lib/search";
import { rankSourcesByMeaning } from "@/lib/ai";

const MAX_TEXT_LENGTH = 10000;

function getChatIdAndText(body: unknown): { chatId: number; text: string } | null {
  const update = body as TelegramUpdate;
  const chatId = update?.message?.chat?.id;
  const rawText = update?.message?.text?.trim();
  if (typeof chatId !== "number" || !rawText) return null;
  return { chatId, text: rawText.slice(0, MAX_TEXT_LENGTH) };
}

function formatResult(sources: { url: string; reason?: string }[], confidence: number): string {
  if (sources.length === 0) {
    return `Подходящих источников не найдено. Уверенность: ${confidence}%.`;
  }
  const lines = sources.map(
    (s) => (s.reason ? `• ${s.url}\n  ${s.reason}` : `• ${s.url}`)
  );
  return [`Найденные источники (уверенность: ${confidence}%):`, "", ...lines].join("\n");
}

async function processUpdate(chatId: number, rawInput: string): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const googleApiKey = process.env.GOOGLE_CSE_API_KEY;
  const googleCx = process.env.GOOGLE_CSE_CX;

  if (!token) {
    console.error("[webhook] BOT_TOKEN не задан");
    return;
  }
  if (!openRouterKey) {
    await sendMessage(token, chatId, "Ошибка: OPENROUTER_API_KEY не задан.");
    return;
  }
  if (!googleApiKey || !googleCx) {
    await sendMessage(token, chatId, "Ошибка: GOOGLE_CSE_API_KEY или GOOGLE_CSE_CX не заданы.");
    return;
  }

  try {
    const inputText = await getInputText(rawInput);
    if (!inputText) {
      await sendMessage(token, chatId, "Не удалось получить текст. Пришлите текст сообщения или ссылку на пост t.me/…");
      return;
    }

    const candidates = await findCandidateSources(inputText, {
      apiKey: googleApiKey,
      cx: googleCx,
      num: 10,
    });

    if (candidates.length === 0) {
      await sendMessage(token, chatId, "Поиск не вернул результатов. Попробуйте другой запрос.");
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
    console.error("[webhook] processUpdate error:", err);
    const msg = err instanceof Error ? err.message : "Произошла ошибка.";
    await sendMessage(token, chatId, `Ошибка: ${msg}`);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = getChatIdAndText(body);
  if (!parsed) {
    return NextResponse.json({ error: "No message or text" }, { status: 400 });
  }

  const { chatId, text } = parsed;
  const token = process.env.BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "BOT_TOKEN not set" }, { status: 500 });
  }

  processUpdate(chatId, text).catch(async (err) => {
    console.error("[webhook] background process error:", err);
    try {
      await sendMessage(token, chatId, "Произошла ошибка при обработке. Попробуйте позже.");
    } catch {
      // игнорируем, если не удалось отправить сообщение об ошибке
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}

export function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
