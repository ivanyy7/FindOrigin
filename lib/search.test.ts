import { findCandidateSourcesSimple } from "./search";

describe("findCandidateSourcesSimple (DuckDuckGo)", () => {
  it("возвращает хотя бы один результат при корректном HTML", async () => {
    const html = `
      <html>
        <body>
          <div class="result">
            <a class="result__a" href="https://example.com/article">Заголовок</a>
            <a class="result__url" href="https://example.com/article"></a>
            <div class="result__snippet">Краткое описание.</div>
          </div>
        </body>
      </html>
    `;

    // подменяем глобальный fetch, чтобы не ходить в реальный интернет
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => html,
    });

    const results = await findCandidateSourcesSimple("тестовый запрос", 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].url).toBe("https://example.com/article");
    expect(results[0].title).toContain("Заголовок");
  });

  it("возвращает пустой массив при пустом запросе", async () => {
    const results = await findCandidateSourcesSimple("   ");
    expect(results).toEqual([]);
  });
}

