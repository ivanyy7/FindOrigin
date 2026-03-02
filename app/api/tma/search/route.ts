import { NextRequest, NextResponse } from "next/server";
import { getInputText } from "@/lib/input";
import { findCandidateSourcesSimple } from "@/lib/search";
import { rankSourcesByMeaning, explainWithoutSources } from "@/lib/ai";

type TmaSearchSuccess = {
  ok: true;
  sources: { url: string; reason?: string }[];
  confidence: number;
  explanation?: string;
};

type TmaSearchError = {
  ok: false;
  error: string;
};

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    const res: TmaSearchError = { ok: false, error: "Invalid JSON" };
    return NextResponse.json(res, { status: 400 });
  }

  const text = (body as { text?: string })?.text?.trim();
  if (!text) {
    const res: TmaSearchError = { ok: false, error: "Text is required" };
    return NextResponse.json(res, { status: 400 });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    const res: TmaSearchError = { ok: false, error: "OPENROUTER_API_KEY is not set" };
    return NextResponse.json(res, { status: 500 });
  }

  try {
    const inputText = await getInputText(text);
    if (!inputText) {
      const res: TmaSearchError = {
        ok: false,
        error: "Не удалось получить текст для анализа",
      };
      return NextResponse.json(res, { status: 400 });
    }

    const candidates = await findCandidateSourcesSimple(inputText, 10);

    // Если внешний поиск ничего не нашёл, используем fallback-объяснение.
    if (candidates.length === 0) {
      const explanation = await explainWithoutSources(inputText, openRouterKey);
      const res: TmaSearchSuccess = {
        ok: true,
        sources: [],
        confidence: 0,
        explanation,
      };
      return NextResponse.json(res, { status: 200 });
    }

    const { sources, confidence } = await rankSourcesByMeaning(
      inputText,
      candidates,
      openRouterKey
    );

    const res: TmaSearchSuccess = {
      ok: true,
      sources,
      confidence,
    };
    return NextResponse.json(res, { status: 200 });
  } catch (err) {
    console.error("[tma/search] error:", err);
    const res: TmaSearchError = {
      ok: false,
      error: "Произошла ошибка при обработке запроса",
    };
    return NextResponse.json(res, { status: 500 });
  }
}

