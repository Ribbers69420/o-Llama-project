#!/usr/bin/env node
// Dataset quality checker.
//
// Reads a text/markdown dataset and reports:
//   - Duplicated paragraphs / repeated sections (TOC, headings, code blocks)
//   - Heuristic code-block lints (bad fences, undefined refs, deprecated APIs)
//   - Overall stats: lines, words, unique paragraph ratio
//
// Usage:
//   node scripts/quality-check.mjs <path-to-dataset>
//   node scripts/quality-check.mjs <path-to-dataset> --json
//
// No external dependencies.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: node scripts/quality-check.mjs <file> [--json]');
  process.exit(args.length === 0 ? 1 : 0);
}

const file = resolve(args[0]);
const asJson = args.includes('--json');

let text;
try {
  text = readFileSync(file, 'utf8');
} catch (err) {
  console.error(`Cannot read ${file}: ${err.message}`);
  process.exit(1);
}

// --- Stats ---
const lines = text.split('\n');
const words = text.split(/\s+/).filter(Boolean);

// --- Paragraph dedup ---
// A "paragraph" is a non-empty block separated by blank lines.
// Strip pure-separator paragraphs (---, ===, etc.) — they're structural, not content.
const isSeparator = (p) => /^[-=*_#\s]+$/.test(p) && p.length < 80;

const paragraphs = text
  .split(/\n\s*\n/)
  .map((p) => p.trim())
  .filter((p) => p.length > 0 && !isSeparator(p));

const fingerprintCounts = new Map();
for (const p of paragraphs) {
  const fp = createHash('sha1').update(p.replace(/\s+/g, ' ')).digest('hex');
  fingerprintCounts.set(fp, (fingerprintCounts.get(fp) ?? 0) + 1);
}

let totalDupes = 0;
let uniqueParagraphs = 0;
for (const count of fingerprintCounts.values()) {
  if (count > 1) totalDupes += count - 1;
  uniqueParagraphs += 1;
}

const topRepeated = [...fingerprintCounts.entries()]
  .filter(([, c]) => c > 1)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([fp, count]) => {
    const sample = paragraphs.find(
      (p) => createHash('sha1').update(p.replace(/\s+/g, ' ')).digest('hex') === fp
    );
    return {
      count,
      preview: sample ? sample.slice(0, 120).replace(/\s+/g, ' ') + (sample.length > 120 ? '…' : '') : '',
    };
  });

// --- Heading repetition ---
const headings = lines
  .map((l) => l.match(/^(#{1,6})\s+(.+?)\s*$/))
  .filter(Boolean)
  .map((m) => ({ level: m[1].length, text: m[2].trim() }));

const headingCounts = new Map();
for (const h of headings) {
  const key = `${h.level}:${h.text.toLowerCase()}`;
  headingCounts.set(key, (headingCounts.get(key) ?? 0) + 1);
}
const repeatedHeadings = [...headingCounts.entries()]
  .filter(([, c]) => c > 1)
  .sort((a, b) => b[1] - a[1])
  .map(([key, count]) => ({ heading: key.split(':').slice(1).join(':'), count }));

// --- Code blocks ---
const codeBlocks = [];
{
  let inBlock = false;
  let lang = '';
  let buf = [];
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = line.match(/^```(\w+)?\s*$/);
    if (!inBlock && open) {
      inBlock = true;
      lang = open[1] ?? '';
      buf = [];
      startLine = i + 1;
      continue;
    }
    if (inBlock && /^```\s*$/.test(line)) {
      codeBlocks.push({ lang, body: buf.join('\n'), startLine });
      inBlock = false;
      lang = '';
      buf = [];
      continue;
    }
    if (inBlock) buf.push(line);
  }
  if (inBlock) {
    codeBlocks.push({ lang: lang + ' [UNCLOSED]', body: buf.join('\n'), startLine });
  }
}

// --- Code block lints ---
const codeIssues = [];
const blockFingerprints = new Map();
for (const block of codeBlocks) {
  const fp = createHash('sha1').update(block.body.replace(/\s+/g, ' ')).digest('hex');
  blockFingerprints.set(fp, (blockFingerprints.get(fp) ?? 0) + 1);

  if (block.lang.includes('UNCLOSED')) {
    codeIssues.push({
      severity: 'error',
      line: block.startLine,
      message: 'Unclosed code fence',
    });
  }

  if (block.lang === 'python') {
    if (/datetime\.utcnow\(\)/.test(block.body)) {
      codeIssues.push({
        severity: 'warning',
        line: block.startLine,
        message: 'datetime.utcnow() is deprecated since Python 3.12 — use datetime.now(timezone.utc)',
      });
    }
    if (/openai\.RealtimeSession\.create|openai\.ChatCompletion\.create|openai\.File\.create/.test(block.body)) {
      codeIssues.push({
        severity: 'warning',
        line: block.startLine,
        message: 'Uses legacy openai SDK v0 globals — current SDK uses an OpenAI() client instance',
      });
    }
    // Undefined names: API_KEY referenced but not defined in same block.
    if (/\bAPI_KEY\b/.test(block.body) && !/API_KEY\s*=/.test(block.body)) {
      codeIssues.push({
        severity: 'error',
        line: block.startLine,
        message: 'Reference to undefined name API_KEY',
      });
    }
  }

  if (block.lang === 'tsx' || block.lang === 'typescript') {
    if (/from\s+["']@\/components\/ui\//.test(block.body)) {
      codeIssues.push({
        severity: 'warning',
        line: block.startLine,
        message: 'Imports shadcn/ui via @/ alias — depends on shadcn install + path alias',
      });
    }
    if (/key=\{index\}/.test(block.body) && /\.map\(/.test(block.body)) {
      codeIssues.push({
        severity: 'warning',
        line: block.startLine,
        message: 'Uses array index as React key in a mutable list — generate stable ids',
      });
    }
  }
}

const duplicateCodeBlocks = [...blockFingerprints.values()].filter((c) => c > 1).length;

// --- Output ---
const report = {
  file,
  stats: {
    bytes: Buffer.byteLength(text, 'utf8'),
    lines: lines.length,
    words: words.length,
    paragraphs: paragraphs.length,
    uniqueParagraphs,
    duplicateParagraphs: totalDupes,
    uniqueRatio: paragraphs.length === 0 ? 1 : +(uniqueParagraphs / paragraphs.length).toFixed(3),
    codeBlocks: codeBlocks.length,
    duplicateCodeBlocks,
  },
  topRepeatedParagraphs: topRepeated,
  repeatedHeadings,
  codeIssues,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.codeIssues.some((i) => i.severity === 'error') ? 1 : 0);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nQUALITY REPORT — ${file}\n${'='.repeat(60)}`);
console.log(`Bytes:                  ${report.stats.bytes.toLocaleString()}`);
console.log(`Lines:                  ${report.stats.lines.toLocaleString()}`);
console.log(`Words:                  ${report.stats.words.toLocaleString()}`);
console.log(`Paragraphs:             ${report.stats.paragraphs}`);
console.log(`Unique paragraphs:      ${report.stats.uniqueParagraphs}`);
console.log(`Duplicate paragraphs:   ${report.stats.duplicateParagraphs}`);
console.log(`Unique ratio:           ${(report.stats.uniqueRatio * 100).toFixed(1)}%`);
console.log(`Code blocks:            ${report.stats.codeBlocks}`);
console.log(`Duplicate code blocks:  ${report.stats.duplicateCodeBlocks}`);

if (report.topRepeatedParagraphs.length > 0) {
  console.log(`\nTOP REPEATED PARAGRAPHS`);
  console.log('-'.repeat(60));
  for (const r of report.topRepeatedParagraphs) {
    console.log(`  ${pad('×' + r.count, 6)} ${r.preview}`);
  }
}

if (report.repeatedHeadings.length > 0) {
  console.log(`\nREPEATED HEADINGS`);
  console.log('-'.repeat(60));
  for (const r of report.repeatedHeadings.slice(0, 10)) {
    console.log(`  ${pad('×' + r.count, 6)} ${r.heading}`);
  }
}

if (report.codeIssues.length > 0) {
  console.log(`\nCODE ISSUES`);
  console.log('-'.repeat(60));
  for (const i of report.codeIssues) {
    console.log(`  [${i.severity.toUpperCase()}] line ${i.line}: ${i.message}`);
  }
}

const errorCount = report.codeIssues.filter((i) => i.severity === 'error').length;
const warnCount = report.codeIssues.filter((i) => i.severity === 'warning').length;
console.log(`\n${errorCount} error(s), ${warnCount} warning(s)\n`);
process.exit(errorCount > 0 ? 1 : 0);
