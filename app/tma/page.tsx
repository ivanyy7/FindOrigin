"use client";

import { useState, useCallback, useEffect } from "react";

const HISTORY_KEY = "findorigin_tma_history";
const HISTORY_MAX = 30;

type TmaResult = {
  ok: true;
  sources: { url: string; reason?: string }[];
  confidence: number;
  explanation?: string;
};

type TmaError = {
  ok: false;
  error: string;
};

type HistoryItem = {
  query: string;
  result: TmaResult;
  timestamp: number;
};

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40) + (url.length > 40 ? "…" : "");
  }
}

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch {
    // ignore
  }
}

export default function TmaPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TmaResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const addToHistory = useCallback((query: string, res: TmaResult) => {
    const item: HistoryItem = { query, result: res, timestamp: Date.now() };
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, HISTORY_MAX);
      saveHistory(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
    const tg = win.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.("#1a1a2e");
      tg.setBackgroundColor?.("#16213e");
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed) {
        setError("Введите текст или ссылку на пост");
        return;
      }
      setError(null);
      setResult(null);
      setLoading(true);
      try {
        const res = await fetch("/api/tma/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
        const data = (await res.json()) as TmaResult | TmaError;
        if (!data.ok) {
          setError(data.error ?? "Произошла ошибка");
          return;
        }
        setResult(data);
        addToHistory(trimmed, data);
      } catch {
        setError("Ошибка сети или сервера");
      } finally {
        setLoading(false);
      }
    },
    [text, addToHistory]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    setShowHistory(false);
    setExpandedId(null);
  }, []);

  const cardBg = "var(--tg-theme-secondary-bg-color, rgba(255,255,255,0.08))";
  const summaryBg = "rgba(100, 160, 220, 0.2)";
  const borderColor = "rgba(255,255,255,0.12)";

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "1rem 1rem 2rem",
        fontFamily: "system-ui, sans-serif",
        background: "var(--tg-theme-bg-color, #16213e)",
        color: "var(--tg-theme-text-color, #eee)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <h1 style={{ fontSize: "1.35rem", margin: 0, fontWeight: 600 }}>FindOrigin</h1>
        <button
          type="button"
          onClick={() => { setShowHistory((v) => !v); setExpandedId(null); }}
          style={{
            padding: "0.4rem 0.75rem",
            fontSize: "0.9rem",
            borderRadius: "8px",
            border: `1px solid ${borderColor}`,
            background: cardBg,
            color: "var(--tg-theme-text-color, #eee)",
            cursor: "pointer",
          }}
        >
          {showHistory ? "Скрыть историю" : "История"}
          {history.length > 0 && ` (${history.length})`}
        </button>
      </div>
      <p style={{ fontSize: "0.9rem", opacity: 0.85, marginBottom: "1.25rem" }}>
        Введите текст новости или ссылку на пост t.me/… — подберём возможные источники.
      </p>

      {showHistory && (
        <section
          style={{
            marginBottom: "1.25rem",
            padding: "1rem",
            borderRadius: "12px",
            background: cardBg,
            border: `1px solid ${borderColor}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <strong style={{ fontSize: "1rem" }}>История запросов</strong>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                style={{
                  fontSize: "0.8rem",
                  padding: "0.25rem 0.5rem",
                  border: "none",
                  background: "transparent",
                  color: "var(--tg-theme-link-color, #7eb8da)",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Очистить
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.8 }}>Пока пусто. Сделайте первый запрос.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {history.map((item, i) => (
                <li key={item.timestamp} style={{ marginBottom: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === i ? null : i)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      color: "var(--tg-theme-link-color, #7eb8da)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "0.9rem",
                      textDecoration: "underline",
                    }}
                  >
                    {item.query.slice(0, 60)}{item.query.length > 60 ? "…" : ""}
                  </button>
                  {expandedId === i && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        padding: "0.75rem",
                        borderRadius: "8px",
                        background: "var(--tg-theme-bg-color, #1a1a2e)",
                        border: `1px solid ${borderColor}`,
                        fontSize: "0.85rem",
                      }}
                    >
                      <p style={{ margin: "0 0 0.5rem 0" }}>Уверенность: <strong>{item.result.confidence}%</strong></p>
                      {item.result.sources.length > 0 ? (
                        item.result.sources.map((s, j) => (
                          <div key={j} style={{ marginBottom: "0.5rem" }}>
                            <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--tg-theme-link-color)", wordBreak: "break-all" }}>{s.url}</a>
                            {s.reason && <div style={{ marginTop: "0.25rem", opacity: 0.9 }}>{s.reason}</div>}
                          </div>
                        ))
                      ) : item.result.explanation ? (
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{item.result.explanation}</p>
                      ) : (
                        <p style={{ margin: 0 }}>Подходящих источников не найдено.</p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: "1.5rem" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Текст или ссылка..."
          disabled={loading}
          rows={4}
          style={{
            width: "100%",
            maxWidth: "100%",
            padding: "0.75rem",
            borderRadius: "10px",
            border: `1px solid ${borderColor}`,
            background: "var(--tg-theme-secondary-bg-color, #1a1a2e)",
            color: "var(--tg-theme-text-color, #eee)",
            fontSize: "1rem",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            fontWeight: 600,
            borderRadius: "10px",
            border: "none",
            background: "var(--tg-theme-button-color, #0f3460)",
            color: "var(--tg-theme-button-text-color, #fff)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            width: "100%",
            maxWidth: "320px",
          }}
        >
          {loading ? "Ищем…" : "Найти источники"}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          style={{
            padding: "0.75rem",
            borderRadius: "10px",
            background: "rgba(200, 80, 80, 0.2)",
            border: "1px solid rgba(200, 80, 80, 0.5)",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <section
          style={{
            borderRadius: "12px",
            overflow: "hidden",
            border: `1px solid ${borderColor}`,
          }}
        >
          <h2
            style={{
              fontSize: "1.1rem",
              margin: 0,
              padding: "1rem 1rem 0.5rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1.25rem" }} role="img" aria-hidden>📋</span>
            Результаты анализа
          </h2>

          {(result.explanation || result.sources.length > 0) && (
            <div
              style={{
                margin: "0 1rem 1rem",
                padding: "1rem",
                borderRadius: "10px",
                background: summaryBg,
                border: `1px solid ${borderColor}`,
              }}
            >
              {result.explanation ? (
                <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                  {result.explanation}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: "0.95rem" }}>
                  {result.sources.length > 0
                    ? `Найдено источников: ${result.sources.length}. Общая уверенность: ${result.confidence}%.`
                    : `Уверенность: ${result.confidence}%.`}
                </p>
              )}
              {result.sources.length > 0 && (
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", opacity: 0.9 }}>
                  Уверенность: <strong>{result.confidence}%</strong>
                </p>
              )}
            </div>
          )}

          {result.sources.length > 0 &&
            result.sources.map((s, i) => (
              <div
                key={i}
                style={{
                  margin: "0 1rem 1rem",
                  padding: "1rem",
                  borderRadius: "10px",
                  background: cardBg,
                  border: `1px solid ${borderColor}`,
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "var(--tg-theme-hint-color, #999)", marginBottom: "0.35rem" }}>
                  Источник {i + 1}
                </div>
                {s.reason && (
                  <p style={{ margin: "0 0 0.5rem", fontWeight: 600, fontSize: "0.95rem", lineHeight: 1.35 }}>
                    {s.reason}
                  </p>
                )}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--tg-theme-link-color, #7eb8da)",
                    wordBreak: "break-all",
                    fontSize: "0.9rem",
                  }}
                >
                  {getDomain(s.url)} — {s.url}
                </a>
              </div>
            ))}
        </section>
      )}
    </main>
  );
}
