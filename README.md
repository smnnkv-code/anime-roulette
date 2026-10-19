# 🎰 Anime Roulette (Аниме-рулетка)

Интерактивное аркадное веб-приложение для случайного подбора аниме из списков пользователя ([MyAnimeList](https://myanimelist.net/) и [Shikimori](https://shikimori.io/)) с плавной 60 FPS симуляцией барабана слот-машины, звуковыми эффектами Web Audio API и встроенным пиксельным ретро-видеоплеером.

---

## 🌟 Ключевые возможности

- 🎰 **Слот-барабан 60 FPS**: реалистичная физика прокрутки и замедления, адаптивная бесконечная лента постеров, генерация ленты без лагов (< 0.5 мс на 5 000 элементов).
- 🔊 **Аркадное 8-битное аудио**: звуковые тики вращения барабана и победный фанфар на базе нативного Web Audio API без внешних аудиофайлов.
- 📺 **Пиксельный RetroPlayer**: встроенный проигрыватель в стиле кинескопного ТВ (CRT) с переключением озвучек и серий через серверный Kodik embed-парсер без сторонних редиректов.
- 📋 **Синхронизация MyAnimeList**: импорт списков пользователя (*Watching*, *Plan to Watch*, *Completed*, *On Hold*, *Dropped*) по никнейму через MAL API v2 с контролем дедлайна пагинации и 5-минутным кэшированием.
- 🌸 **Обогащение через Shikimori**: автоматический подбор русскоязычных названий, постеров и синопсисов.
- 🛡️ **Многоуровневая безопасность**:
  - Строгий `Content-Security-Policy` и `sandbox`-изоляция для iframe плеера.
  - Единый серверный CORS-модуль (`api/_lib/cors.js`) с ограничением по доверенным origin/host.
  - Защита от SSRF и HPP при обращении к внешним провайдерам.
  - Pre-commit перехват утечки ключей и файлов `.env*`.
- 📊 **Мониторинг Sentry**: клиентский и серверный захват сбоев с обязательной санитизацией PII (персональных данных, токенов авторизации и параметров запросов).

---

## 🛠 Технологический стек

- **Frontend**: [React 19](https://react.dev/), [Vite 8](https://vite.dev/), CSS Modules, HTML5 Canvas, Web Audio API.
- **Backend / Serverless**: [Vercel Serverless Functions](https://vercel.com/docs/functions) (Node.js 20, ESM).
- **Линтинг и форматирование**: [Oxlint](https://oxc.rs/) (ультрабыстрый статический анализатор Rust-based).
- **Тестирование**:
  - [Vitest](https://vitest.dev/) (135 модульных, интеграционных и property-based тестов со 100% успехом).
  - [Stryker Mutator](https://stryker-mutator.io/) (мутационное тестирование устойчивости, score > 88%).
  - [Autocannon](https://github.com/mcollina/autocannon) (нагрузочное тестирование, p95 < 10 мс).
- **CI/CD & Git Hooks**: [GitHub Actions](https://github.com/features/actions), [Husky 9](https://typicode.github.io/husky/), [lint-staged 17](https://github.com/lint-staged/lint-staged).

---

## 🚀 Быстрый старт

### Требования
- **Node.js** $\ge$ 20.0.0
- **npm** $\ge$ 10.0.0

### Установка

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/SMNNKV/Anime-Roulette.git
   cd Anime-Roulette
   ```

2. Установите зависимости (хуки Husky инициализируются автоматически через `prepare`):
   ```bash
   npm install
   ```

3. Настройте переменные окружения:
   ```bash
   cp .env.example .env
   ```
   Укажите ваш `MAL_CLIENT_ID` (получить можно бесплатно в панели [MyAnimeList API Config](https://myanimelist.net/apiconfig)).

4. Запустите dev-сервер:
   ```bash
   npm run dev
   ```
   Приложение откроется по адресу [http://localhost:5173](http://localhost:5173).

---

## 📜 Доступные npm-скрипты

| Команда | Описание |
|---|---|
| `npm run dev` | Запуск клиента в режиме разработки с HMR (Vite) |
| `npm run build` | Оптимизированная сборка продакшн-бандла в директорию `dist/` |
| `npm run preview` | Локальный предпросмотр собранного продакшн-бандла |
| `npm run lint` | Быстрая проверка кодовой базы линтером Oxlint |
| `npm test` | Запуск полного сьюта модульных и интеграционных тестов Vitest (135 тестов) |
| `npm run test:perf` | Запуск нагрузочного бенчмарка эндпоинтов и клиентских алгоритмов (Autocannon) |
| `npm run test:mutation` | Запуск мутационного тестирования Stryker |
| `npm run changelog` | Генерация или обновление `CHANGELOG.md` на основе Conventional Commits |
| `npm run changelog:dry` | Предпросмотр генерации release notes без записи в файл |

---

## 📁 Структура проекта

```text
├── .github/workflows/         # GitHub Actions CI, Release и Security Audit
├── .husky/                    # Git pre-commit и commit-msg хуки
├── api/                       # Vercel Serverless Functions (Node.js ESM)
│   ├── _lib/                  # Общие серверные модули (CORS, Sentry, санитизация)
│   ├── get-episodes.js        # Парсер серий и озвучек Kodik
│   ├── get-info.js            # Получение прямой ссылки плеера Kodik
│   ├── mal-list.js            # Загрузка пользовательских списков MAL v2
│   ├── mal-poster.js          # Резервный прокси обложек MAL
│   └── shikimori.js           # Поиск и обогащение метаданных тайтлов
├── public/                    # Статические ассеты (иконки, аудио, манифест)
├── scripts/                   # Вспомогательные скрипты
│   ├── check-secrets.js       # Pre-commit сканер секретов и .env файлов
│   ├── generate-changelog.js  # Генератор CHANGELOG.md с обобщением security
│   ├── perf-mock-server.js    # Локальный мок-сервер для нагрузочных тестов
│   ├── run-load-test.js       # Раннер тестов производительности Autocannon
│   └── verify-commit-msg.js   # Валидатор Conventional Commits
├── src/                       # Клиентский код React 19
│   ├── components/            # UI-компоненты (SlotReel, RetroPlayer, WinnerCard...)
│   ├── hooks/                 # Кастомные React-хуки (анимация, звук, списки)
│   ├── monitoring/            # Интеграция Sentry и Error Boundary
│   └── utils/                 # Утилиты нормализации, весов, санитизации PII
├── CHANGELOG.md               # Журнал изменений (Keep a Changelog)
├── package.json               # Зависимости и скрипты
├── vercel.json                # Конфигурация деплоя, CSP и маршрутизации
└── vite.config.js             # Конфигурация сборщика Vite и прокси
```

---

## 🔒 Переменные окружения (`.env`)

| Переменная | Обязательна | Описание |
|---|---|---|
| `MAL_CLIENT_ID` | Да (для MAL) | Client ID приложения в MyAnimeList API v2 |
| `KODIK_TOKEN` | Нет | Персональный токен Kodik API (по умолчанию используются резервные токены) |
| `VITE_SHIKIMORI_DOMAIN` | Нет | Базовый домен Shikimori (по умолчанию `https://shikimori.io`) |
| `VITE_SENTRY_DSN` | Нет | DSN для клиентского мониторинга Sentry |
| `SENTRY_DSN` | Нет | DSN для серверного мониторинга Vercel Functions |

---

## 🧪 Стандарты качества и надежности

В процессе разработки проект прошёл строгие многоуровневые циклы инженерной верификации качества:

- **Безопасность**: Устранены риски SSRF/HPP в API-прокси, настроен строгий CSP (Content-Security-Policy), фреймы плееров изолированы с `sandbox`, а токены сессии защищены от утечек.
- **Тестирование**: 135 модульных, интеграционных и property-based тестов на базе Vitest (100% pass).
- **Мутационное тестирование**: Устойчивость алгоритмов верифицирована Stryker Mutator (Mutation Score > 88%).
- **Производительность**: Нагрузочный бенчмарк Autocannon подтвердил p95 latency < 10 мс для API и выполнение клиентских алгоритмов за < 0.5 мс.
- **Pre-commit барьер**: Автоматическое сканирование секретов и проверка формата коммитов Conventional Commits перед каждым коммитом.
- **Журнал версий**: Подробная история релизов задокументирована в [CHANGELOG.md](CHANGELOG.md).

---

## 📄 Лицензия

MIT License.
