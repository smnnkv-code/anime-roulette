import { describe, it, expect } from 'vitest';
import {
  parseCommit,
  categorizeCommits,
  generalizeSecurityMessage,
  calculateNextVersion,
  formatChangelogSection,
  generateFullChangelog,
  EXCLUDED_TYPES,
} from '../generate-changelog.js';
import { validateCommitMessage } from '../verify-commit-msg.js';

describe('Conventional Commits parser (parseCommit)', () => {
  it('корректно парсит стандартный conventional commit', () => {
    const parsed = parseCommit('feat(player): добавить субтитры Kodik');
    expect(parsed).toEqual({
      type: 'feat',
      scope: 'player',
      description: 'добавить субтитры Kodik',
      isBreaking: false,
      body: '',
      hash: '',
      raw: 'feat(player): добавить субтитры Kodik',
    });
  });

  it('распознает breaking change через восклицательный знак', () => {
    const parsed = parseCommit('feat(api)!: изменить формат возвращаемых данных');
    expect(parsed?.isBreaking).toBe(true);
    expect(parsed?.type).toBe('feat');
  });

  it('распознает breaking change в теле коммита', () => {
    const parsed = parseCommit({
      subject: 'feat(auth): обновление схемы токена',
      body: 'BREAKING CHANGE: старые токены больше не поддерживаются',
    });
    expect(parsed?.isBreaking).toBe(true);
  });

  it('возвращает null для некорректных форматов коммитов', () => {
    expect(parseCommit('просто коммит без префикса')).toBeNull();
    expect(parseCommit('WIP: работа над плеером')).toBeNull();
  });
});

describe('Фильтрация и категоризация (categorizeCommits)', () => {
  it('исключает внутренний технический шум (test, chore, ci, style, refactor)', () => {
    const commits = [
      parseCommit('test(unit): добавить тест рулетки'),
      parseCommit('chore(deps): обновить vitest'),
      parseCommit('ci: настроить release action'),
      parseCommit('style: выровнять отступы'),
      parseCommit('refactor: переименовать внутренний хелпер'),
      parseCommit('feat(ui): добавить темную тему'),
      parseCommit('fix(roulette): исправить зависание стрелки'),
    ].filter(Boolean);

    const categories = categorizeCommits(commits);

    expect(categories.Added).toHaveLength(1);
    expect(categories.Added[0]).toBe('добавить темную тему');
    expect(categories.Fixed).toHaveLength(1);
    expect(categories.Fixed[0]).toBe('исправить зависание стрелки');

    // Проверяем, что служебные типы никуда не попали
    for (const type of EXCLUDED_TYPES) {
      for (const list of Object.values(categories)) {
        expect(list.some((item) => item.toLowerCase().includes(type))).toBe(false);
      }
    }
  });

  it('направляет perf в категорию Changed', () => {
    const commits = [
      parseCommit('perf(reel): оптимизировать 60 FPS при вращении'),
    ].filter(Boolean);

    const categories = categorizeCommits(commits);
    expect(categories.Changed).toContain('оптимизировать 60 FPS при вращении');
  });
});

describe('Обобщение security-записей (generalizeSecurityMessage)', () => {
  it('транслирует технические детали HPP-инъекции в безопасное обобщение', () => {
    const raw = 'инъекция параметров запроса (HPP) в api/shikimori.js:47 через передачу символа &';
    const generalized = generalizeSecurityMessage(raw, 'api');

    expect(generalized).toBe('Усилена серверная валидация входных параметров в API');
    expect(generalized).not.toContain('HPP');
    expect(generalized).not.toContain('api/shikimori.js:47');
    expect(generalized).not.toContain('&');
  });

  it('транслирует уязвимость хранения токена в localStorage в безопасное обобщение', () => {
    const raw = 'хранение пользовательского токена Shikimori в открытом виде в localStorage (XSS vector)';
    const generalized = generalizeSecurityMessage(raw, 'auth');

    expect(generalized).toBe('Повышена безопасность хранения токенов авторизации сессии');
    expect(generalized).not.toContain('localStorage');
    expect(generalized).not.toContain('XSS');
  });

  it('транслирует отсутствие sandbox в iframe плеера в безопасное обобщение', () => {
    const raw = 'отсутствие атрибута sandbox во встроенных iframe плеера Kodik (allow-top-navigation)';
    const generalized = generalizeSecurityMessage(raw, 'player');

    expect(generalized).toBe('Улучшена изоляция встроенных фреймов сторонних видеоплееров');
    expect(generalized).not.toContain('sandbox');
    expect(generalized).not.toContain('iframe');
    expect(generalized).not.toContain('allow-top-navigation');
  });

  it('транслирует утечку секретов в коммите в безопасное обобщение', () => {
    const raw = 'утечка секрета MAL_CLIENT_ID в файле .env';
    const generalized = generalizeSecurityMessage(raw, 'config');

    expect(generalized).toBe('Улучшена защита и изоляция конфигурационных секретов приложения');
    expect(generalized).not.toContain('MAL_CLIENT_ID');
    expect(generalized).not.toContain('.env');
  });

  it('санитизирует произвольные технические уязвимости через fallback-очистку', () => {
    const raw = 'исправлена ошибка XSS в компоненте /src/components/Header.jsx:12';
    const generalized = generalizeSecurityMessage(raw, 'ui');

    expect(generalized).not.toContain('XSS');
    expect(generalized).not.toContain('/src/components/Header.jsx:12');
  });
});

describe('Инкремент версий SemVer (calculateNextVersion)', () => {
  it('инкрементирует major при breaking changes', () => {
    const commits = [
      parseCommit('feat(api)!: полная переработка API'),
      parseCommit('fix(ui): мелкий фикс'),
    ].filter(Boolean);

    expect(calculateNextVersion('1.2.3', commits)).toBe('2.0.0');
  });

  it('инкрементирует minor при появлении новых feature без breaking changes', () => {
    const commits = [
      parseCommit('feat(mal): поддержка экспорта списка'),
      parseCommit('fix(player): исправление звука'),
    ].filter(Boolean);

    expect(calculateNextVersion('1.2.3', commits)).toBe('1.3.0');
  });

  it('инкрементирует patch при наличии только fix/security/perf', () => {
    const commits = [
      parseCommit('fix(player): исправление звука'),
      parseCommit('security(api): валидация ввода'),
      parseCommit('perf(reel): оптимизация кэша'),
    ].filter(Boolean);

    expect(calculateNextVersion('1.2.3', commits)).toBe('1.2.4');
  });

  it('инициализирует версию с 1.0.0 при первом релизе с 0.0.0', () => {
    const commits = [parseCommit('feat: начальный релиз')].filter(Boolean);
    expect(calculateNextVersion('0.0.0', commits)).toBe('1.0.0');
  });
});

describe('Форматирование Keep a Changelog', () => {
  it('генерирует корректную структуру секции по спецификации Keep a Changelog', () => {
    const md = formatChangelogSection({
      version: '1.1.0',
      date: '2026-10-20',
      categories: {
        Added: ['Новый режим рулетки'],
        Changed: ['Ускорение запуска плеера'],
        Fixed: ['Исправлена ошибка сети'],
        Security: ['Усилена валидация входных параметров в API'],
      },
    });

    expect(md).toContain('## [1.1.0] - 2026-10-20');
    expect(md).toContain('### Added\n- Новый режим рулетки');
    expect(md).toContain('### Changed\n- Ускорение запуска плеера');
    expect(md).toContain('### Fixed\n- Исправлена ошибка сети');
    expect(md).toContain('### Security\n- Усилена валидация входных параметров в API');
  });

  it('вставляет новую секцию после ## [Unreleased] при наличии существующего CHANGELOG', () => {
    const existing = `# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-09-01\n### Added\n- Базовая версия\n`;
    const full = generateFullChangelog({
      version: '1.1.0',
      date: '2026-10-20',
      categories: { Added: ['Новая фича'] },
      existingContent: existing,
    });

    expect(full).toContain('## [Unreleased]\n\n## [1.1.0] - 2026-10-20');
    expect(full).toContain('## [1.0.0] - 2026-09-01');
  });
});

describe('Хук валидации сообщений коммитов (validateCommitMessage)', () => {
  it('принимает корректные Conventional Commits', () => {
    expect(validateCommitMessage('feat(player): добавить субтитры').valid).toBe(true);
    expect(validateCommitMessage('fix: исправить баг').valid).toBe(true);
    expect(validateCommitMessage('security(api): усилить валидацию').valid).toBe(true);
    expect(validateCommitMessage('perf(roulette)!: оптимизировать 60 FPS').valid).toBe(true);
  });

  it('отклоняет некорректные сообщения без префикса', () => {
    const result = validateCommitMessage('просто текст без типа коммита');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Некорректный формат commit-сообщения');
  });

  it('пропускает системные сообщения слияния веток', () => {
    expect(validateCommitMessage('Merge branch main into dev').valid).toBe(true);
    expect(validateCommitMessage('Merge pull request #42 from fix-player').valid).toBe(true);
  });
});
