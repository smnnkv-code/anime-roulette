/**
 * scripts/verify-commit-msg.js
 *
 * Проверяет формат сообщения коммита по спецификации Conventional Commits 1.0.0.
 * Вызывается из Git hook (.husky/commit-msg).
 */

import fs from 'node:fs';

export const COMMIT_MSG_REGEX =
  /^(feat|fix|perf|security|docs|style|refactor|test|chore|ci|revert)(\([a-zA-Z0-9_.-]+\))?!?: .+/;

export function validateCommitMessage(message) {
  const trimmed = message.trim();
  // Пропускаем автоматические сообщения мерджа
  if (/^Merge branch /i.test(trimmed) || /^Merge pull request /i.test(trimmed)) {
    return { valid: true };
  }

  // Первая строка — заголовок
  const firstLine = trimmed.split('\n')[0].trim();
  if (!COMMIT_MSG_REGEX.test(firstLine)) {
    return {
      valid: false,
      error: `Некорректный формат commit-сообщения: "${firstLine}".\nОжидается Conventional Commits: <type>(<scope>): <описание>\nПримеры:\n  feat(roulette): добавить вращение барабана\n  fix(player): устранить таймаут в Kodik\n  security(api): усилить валидацию параметров\n  perf(reel): оптимизировать 60 FPS`,
    };
  }

  return { valid: true };
}

// Запуск из CLI (передается путь к файлу с сообщением коммита)
if (process.argv[1] && process.argv[1].endsWith('verify-commit-msg.js')) {
  const msgFile = process.argv[2];
  if (msgFile && fs.existsSync(msgFile)) {
    const content = fs.readFileSync(msgFile, 'utf8');
    const result = validateCommitMessage(content);
    if (!result.valid) {
      console.error(`\n❌ [Commit-Msg Hook] ${result.error}\n`);
      process.exit(1);
    }
  }
}
