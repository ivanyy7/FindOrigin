# PROJECT_MAP — карта проекта

> Краткое описание структуры проекта: какие папки и файлы есть и за что они отвечают.

---

## 1. Общий обзор

- **Технологии / стек**: Next.js (App Router), TypeScript, Vercel (деплой), Telegram Bot API, DuckDuckGo (поиск без ключей), OpenRouter (AI). Тесты: Jest.
- **Основные подсистемы**: приём webhook от Telegram, извлечение текста (ввод/ссылки), извлечение сущностей, поиск кандидатов-источников, ранжирование по смыслу через AI, отправка ответа в Telegram.

---

## 2. Структура директорий

- `app/` — Next.js App Router: страницы и API-маршруты (в т.ч. webhook, TMA).
- `app/api/webhook/` — POST-обработчик входящих update от Telegram.
- `app/api/tma/search/` — API для Telegram Mini App: POST `{ text }` → поиск источников, возврат JSON (sources, confidence, explanation).
- `app/tma/` — UI Telegram Mini App: страница с вводом текста/ссылки и отображением результатов поиска.
- `lib/` — основная логика бота: Telegram, ввод, сущности, поиск, AI, обработка update.
- `types/` — общие типы TypeScript (Telegram update, сущности, кандидаты, ранжирование).
- `.cursor/rules/` — правила для ИИ (формат чата, план/карта/лог, запрет секретов и т.д.).
- `.github/workflows/` — CI (например, прогон тестов).

---

## 3. Ключевые модули и файлы

- `app/api/webhook/route.ts` — точка входа: приём POST от Telegram, валидация, быстрый ответ, вызов `processUpdate`.
- `app/api/tma/search/route.ts` — API для Mini App: приём текста, вызов getInputText + поиск + AI, ответ в JSON.
- `app/tma/page.tsx` — клиентская страница Mini App: форма, запрос к /api/tma/search, отображение результата (заголовок «Результаты анализа», сводный блок, карточки источников); кнопка «История» — список запросов из localStorage (до 30), раскрытие по клику, «Очистить». `app/tma/layout.tsx` подключает скрипт Telegram Web App.
- `lib/processUpdate.ts` — оркестрация: приветствия, получение текста через `getInputText`, поиск через `findCandidateSourcesSimple`, ранжирование через `rankSourcesByMeaning` / `explainWithoutSources`, отправка ответа через `sendMessage`.
- `lib/telegram.ts` — отправка сообщений в Telegram (sendMessage).
- `lib/input.ts` — получение текста для анализа: из `message.text` или из ссылки на пост (getInputText).
- `lib/entities.ts` — извлечение сущностей из текста (даты, числа, имена, ссылки, утверждения); нормализация текста.
- `lib/search.ts` — поиск кандидатов: DuckDuckGo (основной), опционально Google Custom Search API; `findCandidateSourcesSimple` и др.
- `lib/ai.ts` — ранжирование кандидатов по смыслу через OpenRouter; формирование ответа при отсутствии кандидатов.
- `types/index.ts` — типы: TelegramUpdate, ExtractedEntities, SearchQuery, SearchCandidate, RankedSource и т.д.
- `local-bot.ts` — локальный long-polling бот для отладки (тот же `processUpdate`).
- `PROJECT.md` — спецификация бота. `PLAN.md` — поэтапный план (этапы 1–7). `PROJECT_LOG.md` — лог решений и шагов.

---

## 4. Внешние сервисы и интеграции

- **Telegram Bot API**  
  - Используется в: `lib/telegram.ts`, `app/api/webhook/route.ts`, `lib/processUpdate.ts`.  
  - Роль: приём update по webhook, отправка ответов пользователю (sendMessage).

- **DuckDuckGo (HTML-поиск)**  
  - Используется в: `lib/search.ts`.  
  - Роль: поиск кандидатов-источников без API-ключей; парсинг результатов.

- **OpenRouter (AI)**  
  - Используется в: `lib/ai.ts`.  
  - Роль: сравнение смысла текста пользователя с кандидатами, выбор 1–3 источников и оценка уверенности.

- **Google Custom Search API (опционально)**  
  - Поддержка в коде: `lib/search.ts` (при наличии GOOGLE_CSE_* в окружении).  
  - Для работы бота не обязателен.

---

## 5. Точки входа и запуск

- **Локально (веб)**  
  - `npm run dev` — Next.js dev-сервер; webhook снаружи не придёт, нужен туннель (ngrok и т.п.) или тест через `local-bot.ts`.

- **Локально (бот без webhook)**  
  - `npm run bot` — long-polling бот (`local-bot.ts`), использует тот же `processUpdate`.

- **Production**  
  - Деплой на Vercel; webhook Telegram указывается на URL вида `https://<домен>/api/webhook`.

- **Entry-points в коде**  
  - `app/api/webhook/route.ts` — POST handler для Telegram.  
  - `local-bot.ts` — цикл getUpdates и вызов `processUpdate`.

---

## 6. Пометки по рефакторингу / долгу

- При необходимости: вынести константы промтов и лимитов из `lib/ai.ts` и `lib/search.ts` в конфиг или env.
- Карта обновляется по мере появления новых модулей или интеграций.
