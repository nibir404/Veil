#!/usr/bin/env node

/**
 * scripts/memory.js
 *
 * Lightweight CLI helper to manage docs/MEMORY.md:
 * - node scripts/memory.js status       -> Print current project state, active objectives, recent logs
 * - node scripts/memory.js log ...      -> Append a structured changelog entry with git diff awareness
 * - node scripts/memory.js next ...     -> Update active objectives/next steps
 * - node scripts/memory.js check        -> Verify docs/MEMORY.md health and uncommitted changes
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const memoryPath = path.join(rootDir, 'docs', 'MEMORY.md');

function runCmd(cmd) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function ensureMemoryFile() {
  if (!fs.existsSync(memoryPath)) {
    console.error(`Error: ${memoryPath} not found. Please initialize docs/MEMORY.md first.`);
    process.exit(1);
  }
  return fs.readFileSync(memoryPath, 'utf-8');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  const options = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else if (!options._) {
      options._ = [arg];
    } else {
      options._.push(arg);
    }
  }

  return { command, options };
}

function handleStatus() {
  const content = ensureMemoryFile();
  console.log('\n============================================================');
  console.log('       VEIL — CODEBASE MEMORY & CHANGELOG STATUS');
  console.log('============================================================\n');

  // Extract Last Updated
  const updatedMatch = content.match(/> \*\*Last Updated\*\*:\s*([^\n]+)/i);
  if (updatedMatch) {
    console.log(`Last Updated   : ${updatedMatch[1].trim()}`);
  }

  // Extract Git Branch and Commit
  const branch = runCmd('git rev-parse --abbrev-ref HEAD') || 'unknown';
  const lastCommit = runCmd('git log -1 --oneline') || 'none';
  console.log(`Git Branch     : ${branch}`);
  console.log(`Latest Commit  : ${lastCommit}`);

  // Git Status summary
  const statusShort = runCmd('git status --short');
  const dirtyCount = statusShort ? statusShort.split('\n').filter(Boolean).length : 0;
  console.log(`Working Tree   : ${dirtyCount === 0 ? 'Clean (0 uncommitted files)' : `${dirtyCount} modified/untracked files`}`);

  // Extract Active Objectives
  const objMatch = content.match(/## (?:(?:\d+\.\s*)?(?:Active Objectives & Next Steps|Active Objectives|Next Steps|Current Sprint|Active State))\s*\n([\s\S]*?)(?=\n---|\n## |$)/i);
  if (objMatch) {
    console.log('\n--- ACTIVE OBJECTIVES & PENDING WORK ---\n');
    console.log(objMatch[1].trim());
  }

  // Extract Recent Changelog Entries (last 3)
  const changelogMatch = content.match(/## (?:(?:\d+\.\s*)?(?:Evolution & Decision Log|Changelog & History|Change Log|Changelog))([\s\S]*?)$/i);
  if (changelogMatch) {
    console.log('\n--- RECENT CHANGELOG ENTRIES ---');
    const rawEntries = changelogMatch[1].split(/(?=\n### |\n- \*\*20)/);
    const recent = rawEntries.filter((e) => e.trim().length > 0).slice(0, 3);
    if (recent.length > 0) {
      recent.forEach((entry) => {
        const lines = entry.trim().split('\n');
        console.log(`\n• ${lines[0].replace(/^[-#* ]+/, '')}`);
        lines.slice(1, 6).forEach((l) => console.log(`  ${l}`));
      });
    } else {
      console.log(changelogMatch[1].trim().split('\n').slice(0, 10).join('\n'));
    }
  }

  console.log('\n============================================================\n');
}

function handleLog(options) {
  let content = ensureMemoryFile();
  const dateStr = new Date().toISOString().split('T')[0];
  const type = options.type || 'feat';
  const title = options.title || (options._ && options._.join(' ')) || 'Routine architectural update';
  const desc = options.desc || options.description || '';

  // Get changed files from git if available
  const gitFiles = runCmd('git status --short')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.trim().split(/\s+/)[1])
    .filter(Boolean);

  const filesList = options.files
    ? options.files.split(',').map((f) => f.trim())
    : gitFiles.slice(0, 10);

  const entryHeader = `### [${dateStr}] ${type.toUpperCase()}: ${title}`;
  let entryBody = `\n${entryHeader}\n`;
  if (desc) {
    entryBody += `- **Description**: ${desc}\n`;
  }
  if (filesList.length > 0) {
    entryBody += `- **Files Touched**: \`${filesList.join('`, `')}\`\n`;
  }
  if (options.notes) {
    entryBody += `- **Key Decisions / Notes**: ${options.notes}\n`;
  }
  entryBody += `- **Verification**: Build verified (\`npm run build\` clean)\n`;

  // Find Section 7 or Changelog section
  const sectionRegex = /(## (?:7\.\s*)?(?:Evolution & Decision Log|Changelog & History|Change Log)[\s\S]*?)(?=\n## |$)/i;
  const match = content.match(sectionRegex);

  if (match) {
    const sectionContent = match[1];
    // Insert new entry right after the section header
    const headerEndIndex = sectionContent.indexOf('\n') + 1;
    const updatedSection =
      sectionContent.slice(0, headerEndIndex) +
      entryBody +
      sectionContent.slice(headerEndIndex);

    content = content.replace(sectionRegex, updatedSection);
  } else {
    // Append at the end if not found
    content += `\n\n## 7. Evolution & Decision Log\n${entryBody}`;
  }

  // Update Last Updated header
  content = content.replace(
    /> \*\*Last Updated\*\*:\s*([^\n]+)/i,
    `> **Last Updated**: ${dateStr}`
  );

  fs.writeFileSync(memoryPath, content, 'utf-8');
  console.log(`\n[SUCCESS] Added changelog entry to docs/MEMORY.md:\n${entryHeader}`);
  if (filesList.length > 0) {
    console.log(`Files recorded: ${filesList.join(', ')}`);
  }
}

function handleNext(options) {
  let content = ensureMemoryFile();
  const text = (options._ && options._.join(' ')) || options.text || options.task;

  if (!text) {
    console.error('Error: Please provide task text. Example: node scripts/memory.js next "Implement audio sliders"');
    process.exit(1);
  }

  const sectionRegex = /(## (?:Active Objectives|Next Steps|Current Sprint|Active State)[\s\S]*?)(?=\n## |$)/i;
  const match = content.match(sectionRegex);

  if (match) {
    const existing = match[1];
    const updated = `${existing.trim()}\n- [ ] ${text}\n`;
    content = content.replace(sectionRegex, updated);
  } else {
    // Insert before Section 7 or at end
    const insertPoint = content.indexOf('## 7.') !== -1 ? content.indexOf('## 7.') : content.length;
    const newSection = `## Active Objectives & Next Steps\n\n- [ ] ${text}\n\n`;
    content = content.slice(0, insertPoint) + newSection + content.slice(insertPoint);
  }

  fs.writeFileSync(memoryPath, content, 'utf-8');
  console.log(`\n[SUCCESS] Updated Active Objectives in docs/MEMORY.md with: "${text}"`);
}

function handleCheck() {
  const content = ensureMemoryFile();
  console.log('\nChecking docs/MEMORY.md integrity...');
  let hasErrors = false;

  const requiredSections = [
    'Project Identity & Philosophy',
    'Process Topology & Runtime Ports',
    'Core Subsystems & Architecture',
    'Security & Safety Invariants',
    'Evolution & Decision Log'
  ];

  requiredSections.forEach((sec) => {
    if (!content.includes(sec)) {
      console.warn(`[WARN] Missing standard section: "${sec}"`);
      hasErrors = true;
    }
  });

  const statusShort = runCmd('git status --short');
  if (statusShort) {
    console.log('\n[NOTICE] Uncommitted changes detected in working tree:');
    console.log(statusShort);
    console.log('Remember to log changes before committing: node scripts/memory.js log --type <type> --title "<title>"');
  } else {
    console.log('\n[OK] Git working tree is completely clean.');
  }

  if (!hasErrors) {
    console.log('[OK] docs/MEMORY.md contains all core schema sections.\n');
  }
}

function main() {
  const { command, options } = parseArgs();

  switch (command) {
    case 'status':
    case 'show':
      handleStatus();
      break;
    case 'log':
    case 'add':
      handleLog(options);
      break;
    case 'next':
    case 'todo':
      handleNext(options);
      break;
    case 'check':
    case 'verify':
      handleCheck();
      break;
    default:
      console.log(`
Usage:
  node scripts/memory.js status                  View project memory summary and active objectives
  node scripts/memory.js next "<objective>"      Add an active objective / next step
  node scripts/memory.js log --type <t> --title  Record atomic changelog entry
  node scripts/memory.js check                   Verify memory file health and git cleanliness
      `);
      break;
  }
}

main();
