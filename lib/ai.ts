/**
 * Ранжирование источников по смыслу через OpenRouter.
 * По умолчанию — бесплатная модель openai/gpt-oss-120b:free; можно задать OPENROUTER_MODEL в .env.
 */

import type { SearchCandidate, RankedSource } from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b:free";

const SYSTEM_PROMPT = `Ты помощник, который сравнивает смысл текста пользователя с кандидатами-источниками и выбирает 1–3 наиболее релевантных.
Ответь строго в формате JSON без лишнего текста:
{
  "sources": [
    { "url": "URL источника", "reason": "краткое обоснование релевантности" }
  ],
  "confidence": число от 0 до 100 (общая уверенность в совпадении смысла)
}
Выбирай только те источники, которые по смыслу соответствуют утверждениям пользователя. Если подходящих нет — верни пустой массив sources и низкую confidence.`;

function buildUserMessage(userText: string, candidates: SearchCandidate[]): string {
  const list = candidates
    .map(
      (c, i) =>
        `[${i + 1}] ${c.title}\nURL: ${c.url}\nФрагмент: ${c.snippet}`
    )
    .join("\n\n");
  return `Текст пользователя:\n${userText}\n\nКандидаты-источники:\n${list}\n\nВыбери 1–3 наиболее релевантных источника и верни JSON.`;
}

/**
 * Ранжирует кандидатов по смыслу относительно текста пользователя.
 * Возвращает до 3 источников с обоснованием и общей уверенностью (0–100).
 */
export async function rankSourcesByMeaning(
  userText: string,
  candidates: SearchCandidate[],
  apiKey: string
): Promise<{ sources: RankedSource[]; confidence: number }> {
  if (candidates.length === 0) {
    return { sources: [], confidence: 0 };
  }

  const body = {
    model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: buildUserMessage(userText.slice(0, 4000), candidates.slice(0, 10)),
      },
    ],
    temperature: 0.2,
    max_tokens: 800,
  };

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Пустой ответ OpenRouter");

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;
  let parsed: { sources?: Array<{ url?: string; reason?: string }>; confidence?: number };
  try {
    parsed = JSON.parse(jsonStr) as typeof parsed;
  } catch {
    throw new Error("Не удалось распарсить JSON ответа AI");
  }

  const sources: RankedSource[] = (parsed.sources ?? [])
    .filter((s) => s.url)
    .slice(0, 3)
    .map((s) => ({
      url: s.url ?? "",
      reason: s.reason,
      confidence: parsed.confidence,
    }));

  const confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 0));

  return { sources, confidence };
}
