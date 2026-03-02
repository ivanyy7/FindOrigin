"use client";

import { useState, useCallback, useEffect } from "react";

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

export default function TmaPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TmaResult | null>(null);

  // Интеграция с Telegram WebApp: тема и готовность
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = (window as unknown as { Telegram?: { WebApp?: { ready: () => void; expand: () => void; setHeaderColor?: (c: string) => void; setBackgroundColor?: (c: string) => void } }).Telegram?.WebApp;
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
      } catch {
        setError("Ошибка сети или сервера");
      } finally {
        setLoading(false);
      }
    },
    [text]
  );

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
      <h1
        style={{
          fontSize: "1.35rem",
          marginBottom: "0.5rem",
          fontWeight: 600,
        }}
      >
        FindOrigin
      </h1>
      <p
        style={{
          fontSize: "0.9rem",
          opacity: 0.85,
          marginBottom: "1.25rem",
        }}
      >
        Введите текст новости или ссылку на пост t.me/… — подберём возможные источники.
      </p>

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
            border: "1px solid rgba(255,255,255,0.2)",
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
            padding: "0.65rem 1.25rem",
            fontSize: "1rem",
            fontWeight: 600,
            borderRadius: "10px",
            border: "none",
            background: "var(--tg-theme-button-color, #0f3460)",
            color: "var(--tg-theme-button-text-color, #fff)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
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
            padding: "1rem",
            borderRadius: "10px",
            background: "var(--tg-theme-secondary-bg-color, rgba(255,255,255,0.06))",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem", fontWeight: 600 }}>
            Результат
          </h2>
          <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
            Уверенность: <strong>{result.confidence}%</strong>
          </p>
          {result.sources.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {result.sources.map((s, i) => (
                <li key={i} style={{ marginBottom: "0.5rem" }}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--tg-theme-link-color, #7eb8da)",
                      wordBreak: "break-all",
                    }}
                  >
                    {s.url}
                  </a>
                  {s.reason && (
                    <div style={{ fontSize: "0.85rem", opacity: 0.9, marginTop: "0.25rem" }}>
                      {s.reason}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : result.explanation ? (
            <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.95rem" }}>
              {result.explanation}
            </p>
          ) : (
            <p style={{ margin: 0 }}>Подходящих источников не найдено.</p>
          )}
        </section>
      )}
    </main>
  );
}
