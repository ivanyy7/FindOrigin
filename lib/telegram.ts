/**
 * Отправка сообщения пользователю через Telegram Bot API.
 */

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string
): Promise<boolean> {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text.slice(0, 4096),
    parse_mode: undefined as string | undefined,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[telegram] sendMessage error:", res.status, err);
    return false;
  }
  return true;
}
