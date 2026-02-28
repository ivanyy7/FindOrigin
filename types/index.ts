/** Telegram Update (упрощённо: только message с text) */
export interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

/** Извлечённые сущности из текста пользователя */
export interface ExtractedEntities {
  dates: string[];
  numbers: string[];
  names: string[];
  links: string[];
  claims: string[];
}

/** Структурированный запрос для этапа поиска: ключевые фразы + сущности */
export interface SearchQuery {
  keyPhrases: string[];
  entities: ExtractedEntities;
  rawText: string;
}

/** Ответ бота: источники и уверенность (для этапа AI) */
export interface BotResponse {
  sources: { url: string; reason?: string }[];
  confidence: number; // 0–100 или уровень
}
