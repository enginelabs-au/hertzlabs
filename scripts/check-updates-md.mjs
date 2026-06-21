#!/usr/bin/env node
/**
 * Gate releases: fail if UPDATES.md has open `- [ ]` items under ## Issues or ## Features.
 * Placeholder features use `- [~]` and do not block.
 */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPDATES_PATH = path.join(ROOT, 'UPDATES.md');

const OPEN_ITEM = /^-\s+\[\s\]\s+/;
const SECTION_ISSUES = /^##\s+Issues\b/i;
const SECTION_FEATURES = /^##\s+Features\b/i;
const ANY_SECTION = /^##\s+/;

function findBlockingItems(content) {
  const lines = content.split('\n');
  let section = null;
  const blocking = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (SECTION_ISSUES.test(line)) {
      section = 'Issues';
      continue;
    }
    if (SECTION_FEATURES.test(line)) {
      section = 'Features';
      continue;
    }
    if (section && ANY_SECTION.test(line) && !SECTION_ISSUES.test(line) && !SECTION_FEATURES.test(line)) {
      section = null;
      continue;
    }
    if (!section) {
      continue;
    }
    if (OPEN_ITEM.test(line)) {
      blocking.push({section, line: i + 1, text: line.trim()});
    }
  }

  return blocking;
}

function main() {
  if (!fs.existsSync(UPDATES_PATH)) {
    console.log('check-updates-md: skip — UPDATES.md not present (local-only, gitignored)');
    process.exit(0);
  }

  const content = fs.readFileSync(UPDATES_PATH, 'utf8');
  const blocking = findBlockingItems(content);

  if (blocking.length === 0) {
    console.log('check-updates-md: OK — no open issues or features in UPDATES.md');
    process.exit(0);
  }

  console.error('check-updates-md: BLOCKED — resolve or check off all open items in UPDATES.md:\n');
  for (const item of blocking) {
    console.error(`  [${item.section}] line ${item.line}: ${item.text}`);
  }
  console.error(
    '\nMark fixed items `- [x]` with a Fix/Shipped note, or use `- [~]` for feature placeholders not yet in scope.',
  );
  process.exit(1);
}

main();
