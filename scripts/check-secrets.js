#!/usr/bin/env node

/**
 * scripts/check-secrets.js
 * Pre-commit hook script: сканирует staged-файлы на наличие секретов и .env файлов.
 */

import { execSync } from 'child_process';
import path from 'path';

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.split('\n').map((f) => f.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function getStagedDiff() {
  try {
    return execSync('git diff --cached -U0 --diff-filter=ACM', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

function checkStagedEnvFiles(files) {
  for (const file of files) {
    const base = path.basename(file);
    // Разрешаем только .env.example
    if (base.startsWith('.env') && base !== '.env.example') {
      console.error(`\n❌ [pre-commit] ОШИБКА: Попытка закоммитить файл с переменными окружения: "${file}".`);
      console.error('   Файлы .env содержат секреты и запрещены к публикации в репозитории.');
      console.error('   Удалите файл из stage: git reset HEAD <file>\n');
      process.exit(1);
    }
  }
}

function checkStagedDiffSecrets(diff) {
  const secretPatterns = [
    { name: 'Private Key', regex: /-----BEGIN (RSA|OPENSSH|EC|PGP|PRIVATE) KEY-----/ },
    { name: 'GitHub Personal Access Token', regex: /gh[pous]_[A-Za-z0-9_]{36,255}/ },
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
    { name: 'Hardcoded MAL Client Secret', regex: /client_secret\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/i },
  ];

  const addedLines = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'));

  for (const line of addedLines) {
    for (const { name, regex } of secretPatterns) {
      if (regex.test(line)) {
        console.error(`\n❌ [pre-commit] ОШИБКА: Обнаружен потенциальный секрет (${name}) в diff:`);
        console.error(`   ${line.trim().slice(0, 80)}...`);
        console.error('   Убедитесь, что токены и ключи вынесены в переменные окружения Vercel, а не в исходный код.\n');
        process.exit(1);
      }
    }
  }
}

function main() {
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    process.exit(0);
  }

  checkStagedEnvFiles(stagedFiles);

  const diff = getStagedDiff();
  if (diff) {
    checkStagedDiffSecrets(diff);
  }

  process.exit(0);
}

main();
