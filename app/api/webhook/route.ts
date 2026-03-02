import { NextRequest, NextResponse } from "next/server";
import type { TelegramUpdate } from "@/types";
import { sendMessage } from "@/lib/telegram";
import { processUpdate } from "@/lib/processUpdate";

const MAX_TEXT_LENGTH = 10000;

function getChatIdAndText(body: unknown): { chatId: number; text: string } | null {
  const update = body as TelegramUpdate;
  const chatId = update?.message?.chat?.id;
  const rawText = update?.message?.text?.trim();
  if (typeof chatId !== "number" || !rawText) return null;
  return { chatId, text: rawText.slice(0, MAX_TEXT_LENGTH) };
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

  const t = text.trim();
  const isQuickReply =
    t === "/start" ||
    /^(привет|здравствуй|хай|hello|hi|здарова|как дела|что делаешь)(\s+бот)?[\.\!\)]*$/i.test(t);
  if (!isQuickReply) {
    await sendMessage(token, chatId, "Получил сообщение, ищу источники…").catch(() => {});
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
