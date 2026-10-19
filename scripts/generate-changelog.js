/**
 * scripts/generate-changelog.js
 *
 * Генератор журнала изменений (CHANGELOG.md) по спецификации Keep a Changelog 1.1.0
 * и Semantic Versioning 2.0.0 на основе Conventional Commits.
 *
 * Включает обязательный шаг конвертации и обобщения security-записей для публичной аудитории:
 * технические детали уязвимостей (файлы, строки кода, полезные нагрузки, векторы HPP/XSS/SSRF)
 * механически в публичный changelog не попадают, а заменяются на безопасные обобщенные описания.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Conventional Commit regex: <type>(<scope>)?(!)?:\s*<description>
export const CONVENTIONAL_REGEX =
  /^(feat|fix|perf|security|docs|style|refactor|test|chore|ci|revert|deprecate|remove)(?:\(([a-zA-Z0-9_.-]+)\))?(!)?:\s*(.+)$/i;

// Типы коммитов, исключаемые из публичного Changelog (внутренний шум)
export const EXCLUDED_TYPES = new Set(['test', 'chore', 'ci', 'style', 'refactor']);

/**
 * Словарь правил обобщения security-исправлений.
 * Преобразует технические детали уязвимостей в безопасные для публичного changelog описания.
 */
export const SECURITY_GENERALIZATION_RULES = [
  {
    // HTTP Parameter Pollution / query injection / line numbers in API
    pattern: /(?:hpp|http parameter pollution|инъекци[яи].*параметр|shikimori\.js|mal-list\.js|get-info\.js|параметр.*mal_id|параметр.*nickname|символ.*&|query.*injection)/i,
    replacement: 'Усилена серверная валидация входных параметров в API',
  },
  {
    // Token storage in localStorage / XSS token exposure / useAnimeList
    pattern: /(?:localstorage|sessionstorage|токен.*открытом виде|token.*exposure|xss.*токен|хранени[ея].*токен|useanimelist)/i,
    replacement: 'Повышена безопасность хранения токенов авторизации сессии',
  },
  {
    // Iframe sandbox / player security / clickjacking / top-navigation
    pattern: /(?:iframe|sandbox|песочниц|allow-top-navigation|window\.top|кликджекинг|retroplayer|watchmodal)/i,
    replacement: 'Улучшена изоляция встроенных фреймов сторонних видеоплееров',
  },
  {
    // SSRF / host validation / external provider tokens / kodik
    pattern: /(?:ssrf|fallback_tokens|провайдер.*токен|небезопасн.*зависимост.*github|kodik.*токен|валидаци[яи].*хост)/i,
    replacement: 'Повышена надежность и безопасность обращения к внешним медиа-провайдерам',
  },
  {
    // Secret leaks / .env / MAL_CLIENT_ID / API keys
    pattern: /(?:mal_client_id|\.env|утечк[аи].*секрет|сброс.*ключ|secret.*leak|компрометаци[яи].*ключ)/i,
    replacement: 'Улучшена защита и изоляция конфигурационных секретов приложения',
  },
  {
    // Security headers / nosniff / permissions-policy
    pattern: /(?:x-frame-options|x-content-type-options|nosniff|permissions-policy|referrer-policy|заголовк.*безопасност)/i,
    replacement: 'Усилены глобальные заголовки безопасности HTTP-ответов сервера',
  },
  {
    // Rate limiting / DoS / pagination limits
    pattern: /(?:dos|denial of service|исчерпани[ея].*лимит|лимит.*пагинаци|max_pages)/i,
    replacement: 'Усилены ограничения на объем запрашиваемых данных в серверных запросах',
  },
];

/**
 * Очищает и обобщает текст сообщения коммита безопасности.
 * Удаляет пути к файлам, номера строк, символы инъекций и спецсимволы эксплойтов.
 *
 * @param {string} rawMessage Исходное сообщение коммита
 * @param {string} [scope] Область видимости (например 'api', 'player')
 * @returns {string} Безопасное обобщенное описание для публичного changelog
 */
export function generalizeSecurityMessage(rawMessage, scope = '') {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'Обновления и улучшения в подсистеме безопасности';
  }

  const trimmed = rawMessage.trim();

  // 1. Проверяем совпадение с известными паттернами уязвимостей
  for (const rule of SECURITY_GENERALIZATION_RULES) {
    if (rule.pattern.test(trimmed)) {
      return rule.replacement;
    }
  }

  // 2. Если конкретный паттерн не подошёл, применяем эвристическую санитизацию:
  // - Удаляем номера строк и файлы: /api/shikimori.js:47, src/index.js
  // - Удаляем технические аббревиатуры уязвимостей: XSS, SSRF, HPP, CSRF, RCE, LFI, SQLi, CVE-\d+
  // - Удаляем технические пейлоады: &, <script>, ../, %20
  let sanitized = trimmed
    .replace(/(?:[\w/-]+\.(?:js|jsx|ts|tsx|json|yml|html|env))(?::\d+)?/gi, '')
    .replace(/\b(XSS|SSRF|HPP|CSRF|RCE|LFI|SQLI|CVE-\d{4}-\d+)\b/gi, '')
    .replace(/[<>&"'{}\\]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (sanitized.length < 5) {
    return scope
      ? `Повышена безопасность в модуле ${scope}`
      : 'Обновления и улучшения в подсистеме безопасности';
  }

  // Делаем первую букву заглавной
  return sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
}

/**
 * Парсит строку или объект коммита по правилам Conventional Commits.
 *
 * @param {string|object} commit
 * @returns {object|null}
 */
export function parseCommit(commit) {
  const line = typeof commit === 'string' ? commit : (commit.subject || commit.message || '');
  const body = typeof commit === 'object' ? (commit.body || '') : '';
  const hash = typeof commit === 'object' ? (commit.hash || '') : '';

  const match = line.match(CONVENTIONAL_REGEX);
  if (!match) {
    return null;
  }

  const [, rawType, scope = '', breakingFlag, description] = match;
  const type = rawType.toLowerCase();
  const isBreaking = Boolean(breakingFlag) || /BREAKING[- ]CHANGE:/i.test(body) || /BREAKING[- ]CHANGE:/i.test(line);

  return {
    type,
    scope: scope || '',
    description: description.trim(),
    isBreaking,
    body,
    hash: hash ? hash.slice(0, 7) : '',
    raw: line,
  };
}

/**
 * Распределяет распарсенные коммиты по категориям Keep a Changelog.
 * Исключает шум (test, chore, ci, style, refactor).
 * Применяет security-обобщение для публичной аудитории.
 *
 * @param {Array<object>} parsedCommits
 * @param {object} [options]
 * @param {boolean} [options.publicAudience=true]
 * @returns {Record<string, string[]>}
 */
export function categorizeCommits(parsedCommits, { publicAudience = true } = {}) {
  const categories = {
    Added: [],
    Changed: [],
    Fixed: [],
    Security: [],
    Deprecated: [],
    Removed: [],
  };

  for (const item of parsedCommits) {
    if (!item || EXCLUDED_TYPES.has(item.type)) {
      continue;
    }

    let text = item.description;

    // Определение категории
    if (item.type === 'security' || item.scope === 'security') {
      if (publicAudience) {
        text = generalizeSecurityMessage(text, item.scope);
      }
      categories.Security.push(text);
    } else if (item.type === 'feat') {
      // Если коммит помечен как модификация существующего или perf, идет в Changed, иначе Added
      categories.Added.push(text);
    } else if (item.type === 'perf') {
      categories.Changed.push(text);
    } else if (item.type === 'fix') {
      categories.Fixed.push(text);
    } else if (item.type === 'deprecate') {
      categories.Deprecated.push(text);
    } else if (item.type === 'remove') {
      categories.Removed.push(text);
    }
  }

  // Удаляем дубликаты из категорий
  for (const cat of Object.keys(categories)) {
    categories[cat] = [...new Set(categories[cat])];
  }

  return categories;
}

/**
 * Вычисляет следующую версию согласно SemVer 2.0.0.
 *
 * @param {string} currentVersion Текущая версия (например "1.0.0")
 * @param {Array<object>} parsedCommits Распарсенные коммиты
 * @returns {string} Следующая версия SemVer
 */
export function calculateNextVersion(currentVersion = '0.0.0', parsedCommits = []) {
  const parts = currentVersion.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  let [major = 0, minor = 0, patch = 0] = parts;

  if (currentVersion === '0.0.0' && parsedCommits.length > 0) {
    return '1.0.0';
  }

  const hasBreaking = parsedCommits.some((c) => c && c.isBreaking);
  const hasFeature = parsedCommits.some((c) => c && c.type === 'feat');
  const hasFixOrSecurityOrPerf = parsedCommits.some(
    (c) => c && (c.type === 'fix' || c.type === 'security' || c.type === 'perf')
  );

  if (hasBreaking) {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (hasFeature) {
    minor += 1;
    patch = 0;
  } else if (hasFixOrSecurityOrPerf) {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

/**
 * Формирует markdown секцию Keep a Changelog.
 *
 * @param {object} params
 * @param {string} params.version Версия (например "1.0.0")
 * @param {string} params.date Дата (YYYY-MM-DD)
 * @param {Record<string, string[]>} params.categories Категории изменений
 * @returns {string} Markdown блок версии
 */
export function formatChangelogSection({ version, date, categories }) {
  const lines = [`## [${version}] - ${date}`];
  const order = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

  let hasEntries = false;

  for (const section of order) {
    const items = categories[section];
    if (items && items.length > 0) {
      hasEntries = true;
      lines.push('');
      lines.push(`### ${section}`);
      for (const item of items) {
        lines.push(`- ${item}`);
      }
    }
  }

  if (!hasEntries) {
    lines.push('');
    lines.push('Никаких изменений в этом релизе.');
  }

  return lines.join('\n');
}

/**
 * Генерирует полный Markdown файл CHANGELOG.md или вставляет новую секцию в существующий.
 *
 * @param {object} params
 * @param {string} params.version
 * @param {string} params.date
 * @param {Record<string, string[]>} params.categories
 * @param {string} [params.existingContent='']
 * @returns {string} Полное содержимое CHANGELOG.md
 */
export function generateFullChangelog({ version, date, categories, existingContent = '' }) {
  const sectionMd = formatChangelogSection({ version, date, categories });

  const header = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
`;

  if (!existingContent || !existingContent.trim()) {
    return `${header}\n${sectionMd}\n`;
  }

  // Если файл уже есть, вставляем новую секцию после ## [Unreleased]
  if (existingContent.includes('## [Unreleased]')) {
    return existingContent.replace(
      '## [Unreleased]',
      `## [Unreleased]\n\n${sectionMd}`
    );
  }

  // Иначе вставляем в начало после заголовка # Changelog
  return `${header}\n${sectionMd}\n\n${existingContent.replace(/^# Changelog\s*/i, '')}`;
}

/**
 * Получает коммиты из git log.
 * Если репозиторий пуст или нет коммитов, возвращает пустой массив.
 *
 * @param {string} [fromTag] Тег начала диапазона
 * @param {string} [toTag='HEAD'] Тег окончания диапазона
 * @returns {Array<{ hash: string, subject: string, body: string }>}
 */
export function getGitCommits(fromTag, toTag = 'HEAD') {
  try {
    const range = fromTag ? `${fromTag}..${toTag}` : toTag;
    const output = execSync(
      `git log ${range} --pretty=format:"%H|||%s|||%b<<<END_COMMIT>>>"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    if (!output.trim()) return [];

    return output
      .split('<<<END_COMMIT>>>')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [hash = '', subject = '', body = ''] = chunk.split('|||');
        return { hash: hash.trim(), subject: subject.trim(), body: body.trim() };
      });
  } catch {
    return [];
  }
}

/**
 * Набор демонстрационных коммитов для проекта Anime Roulette,
 * используемый при dry-run, если в git репозитории пока нет закоммиченной истории,
 * либо при явном флаге --sample.
 */
export const SAMPLE_COMMITS = [
  'feat(roulette): реализован генератор случайного аниме и анимация барабана',
  'feat(player): добавлен встроенный ретро-плеер с поддержкой озвучек Kodik',
  'feat(mal): добавлена авторизация и синхронизация пользовательских списков MyAnimeList',
  'perf(roulette): оптимизирован рендеринг барабана до стабильных 60 FPS',
  'fix(player): устранена ошибка падения плеера при сетевом таймауте Kodik API',
  'security(api): инъекция параметров запроса (HPP) в api/shikimori.js:47 через передачу символа &',
  'security(auth): хранение пользовательского токена Shikimori в открытом виде в localStorage',
  'security(player): отсутствие атрибута sandbox во встроенных iframe плеера Kodik',
  'test(unit): добавлены тесты для компонентов рулетки и плеера',
  'chore(deps): обновление зависимостей Vite и React 19',
  'ci: настройка GitHub Actions workflow для автотестов',
  'style: форматирование отступов и выравнивание стилей Tailwind',
];

// CLI запуск
if (process.argv[1] && process.argv[1].endsWith('generate-changelog.js')) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const useSample = args.includes('--sample');
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : path.resolve(process.cwd(), 'CHANGELOG.md');

  // Читаем текущую версию из package.json
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  let currentVersion = '0.0.0';
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      currentVersion = pkg.version || '0.0.0';
    } catch {
      // fallback
    }
  }

  // Получаем коммиты
  let rawCommits = [];
  if (!useSample) {
    rawCommits = getGitCommits();
  }

  if (rawCommits.length === 0) {
    // Если git коммитов нет, используем репрезентативный набор для демонстрации генерации
    rawCommits = SAMPLE_COMMITS.map((msg) => ({ subject: msg, hash: 'a1b2c3d' }));
  }

  const parsed = rawCommits.map(parseCommit).filter(Boolean);
  const categories = categorizeCommits(parsed, { publicAudience: true });
  const nextVersion = calculateNextVersion(currentVersion, parsed);
  const today = new Date().toISOString().split('T')[0];

  let existingContent = '';
  if (fs.existsSync(outputPath)) {
    existingContent = fs.readFileSync(outputPath, 'utf8');
  }

  const sectionMd = formatChangelogSection({
    version: nextVersion,
    date: today,
    categories,
  });

  const fullContent = generateFullChangelog({
    version: nextVersion,
    date: today,
    categories,
    existingContent,
  });

  if (isDryRun) {
    console.log(`\n======================================================`);
    console.log(`[DRY-RUN] Сгенерированный блок CHANGELOG.md (${nextVersion})`);
    console.log(`======================================================\n`);
    console.log(sectionMd);
    console.log(`\n======================================================\n`);
  } else {
    fs.writeFileSync(outputPath, fullContent, 'utf8');
    console.log(`✅ CHANGELOG.md успешно обновлен до версии ${nextVersion} в ${outputPath}`);
  }
}
