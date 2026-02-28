import { extractEntities, normalizeText, buildSearchQuery } from "./entities";

describe("normalizeText", () => {
  it("убирает лишние пробелы и переносы", () => {
    expect(normalizeText("  текст   \n  с  пробелами  ")).toBe("текст с пробелами");
  });
});

describe("extractEntities", () => {
  it("извлекает даты в формате DD.MM.YYYY", () => {
    const e = extractEntities("Событие произошло 15.03.2024.");
    expect(e.dates).toContain("15.03.2024");
  });

  it("извлекает числа и проценты", () => {
    const e = extractEntities("Рост составил 15% и 3,5 млн.");
    expect(e.numbers.length).toBeGreaterThan(0);
  });

  it("извлекает ссылки", () => {
    const e = extractEntities("Подробнее: https://example.com/news");
    expect(e.links).toContain("https://example.com/news");
  });

  it("извлекает имена с заглавной буквы", () => {
    const e = extractEntities("Иван Петров и Мария Сидорова выступили.");
    expect(e.names.length).toBeGreaterThan(0);
  });

  it("возвращает все поля структуры", () => {
    const e = extractEntities("Текст без особых сущностей.");
    expect(e).toHaveProperty("dates");
    expect(e).toHaveProperty("numbers");
    expect(e).toHaveProperty("names");
    expect(e).toHaveProperty("links");
    expect(e).toHaveProperty("claims");
  });
});

describe("buildSearchQuery", () => {
  it("при пустых claims использует весь текст как keyPhrases", () => {
    const e = extractEntities("Короткий текст.");
    const q = buildSearchQuery("Короткий текст.", e);
    expect(q.keyPhrases.length).toBeGreaterThan(0);
    expect(q.rawText).toBe("Короткий текст.");
  });
});
