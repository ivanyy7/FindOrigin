import { NextRequest, NextResponse } from "next/server";
import type { TelegramUpdate } from "@/types";
import { sendMessage } from "@/lib/telegram";
import { getInputText } from "@/lib/input";
import { extractEntities, buildSearchQuery } from "@/lib/entities";

const MAX_TEXT_LENGTH = 10000;

function getChatIdAndText(body: unknown): { chatId: number; text: string } | null {
  const update = body as TelegramUpdate;
  const chatId = update?.message?.chat?.id;
  const rawText = update?.message?.text?.trim();
  if (typeof chatId !== "number" || !rawText) return null;
  return { chatId, text: rawText.slice(0, MAX_TEXT_LENGTH) };
}

async function processUpdate(chatId: number, rawInput: string): Promise<void> {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error("[webhook] BOT_TOKEN не задан");
    return;
  }

  try {
    const inputText = await getInputText(rawInput);
    if (!inputText) {
      await sendMessage(token, chatId, "Не удалось получить текст. Пришлите текст сообщения или ссылку на пост t.me/…");
      return;
    }

    const entities = extractEntities(inputText);
    const query = buildSearchQuery(inputText, entities);

    const summary = [
      "Текст получен, сущности извлечены.",
      `Даты: ${query.entities.dates.length}; числа: ${query.entities.numbers.length}; имена: ${query.entities.names.length}; ссылки: ${query.entities.links.length}; утверждения: ${query.entities.claims.length}.`,
      "Этап поиска источников пока не реализован.",
    ].join("\n");

    await sendMessage(token, chatId, summary);
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

  processUpdate(chatId, text).catch((err) =>
    console.error("[webhook] background process error:", err)
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}

export function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
