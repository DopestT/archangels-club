#!/usr/bin/env node
/**
 * Bug Report Generator
 *
 * Runs every check (typecheck, lint, tests, build, API health) and collects
 * failures into a structured JSON report at bug-report.json.
 *
 * Usage:  npm run bug:report
 * Output: bug-report.json  (machine-readable)
 *         stdout           (human-readable summary)
 */
import { execSync, spawnSync }              from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath }                   from 'node:url';
import { dirname, resolve, join }          from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// ── Report skeleton ───────────────────────────────────────────────────────────

const report = {
  timestamp:    new Date().toISOString(),
  git_sha:      gitSha(),
  summary:      { total: 0, errors: 0, warnings: 0, all_pass: false },
  checks:       [],  // { name, pass, output? }
  errors:       [],  // structured error objects
};

// ── Runners ───────────────────────────────────────────────────────────────────

function run(cmd) {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8', cwd: ROOT });
  return {
    stdout:   r.stdout  ?? '',
    stderr:   r.stderr  ?? '',
    exitCode: r.status  ?? 1,
  };
}

function gitSha() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: ROOT }).trim(); }
  catch { return 'unknown'; }
}

function addCheck(name, pass, output) {
  report.checks.push({ name, pass, ...(output ? { output: output.slice(-1500) } : {}) });
  process.stdout.write(`  ${pass ? '✓' : '✗'} ${name}\n`);
}

function addError(fields) {
  report.errors.push({ id: `err-${report.errors.length + 1}`, ...fields });
}

// ── 1. TypeScript ─────────────────────────────────────────────────────────────

process.stdout.write('\n[1/5] TypeScript check…\n');
const tsServer = run('npm --prefix server run typecheck 2>&1');
const tsClient = run('npm --prefix client run typecheck 2>&1');
const tsOut    = tsServer.stdout + tsServer.stderr + tsClient.stdout + tsClient.stderr;
const tsPass   = tsServer.exitCode === 0 && tsClient.exitCode === 0;
addCheck('typecheck', tsPass, tsOut);

// path(line,col): error TS1234: message
const TS_RE = /^(.+\.tsx?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
for (const m of tsOut.matchAll(TS_RE)) {
  const [, file, line, col, severity, code, message] = m;
  addError({
    type:         'typescript',
    severity,
    file:         file.replace(ROOT + '/', ''),
    line:         +line,
    col:          +col,
    code,
    message,
    fix_category: tsFix(code),
    suggestion:   tsSuggestion(code, message),
  });
}

// ── 2. ESLint ─────────────────────────────────────────────────────────────────

process.stdout.write('\n[2/5] ESLint…\n');
const lintServer = run('npm --prefix server run lint -- --format json 2>&1 || true');
const lintClient = run('npm --prefix client run lint -- --format json 2>&1 || true');

function parseLint(raw) {
  const idx = raw.indexOf('[');
  if (idx === -1) return [];
  try { return JSON.parse(raw.slice(idx)); } catch { return []; }
}

const lintFiles  = [...parseLint(lintServer.stdout + lintServer.stderr),
                    ...parseLint(lintClient.stdout + lintClient.stderr)];
const lintErrors = lintFiles.reduce((n, f) => n + (f.errorCount ?? 0), 0);
const lintWarns  = lintFiles.reduce((n, f) => n + (f.warningCount ?? 0), 0);
addCheck('lint', lintErrors === 0);

for (const file of lintFiles) {
  for (const msg of file.messages ?? []) {
    addError({
      type:         'lint',
      severity:     msg.severity === 2 ? 'error' : 'warning',
      file:         file.filePath?.replace(ROOT + '/', '') ?? '?',
      line:         msg.line,
      col:          msg.column,
      code:         msg.ruleId,
      route:        null,
      message:      msg.message,
      fix_category: null,
      suggestion:   `ESLint rule ${msg.ruleId}. Run: eslint --fix`,
    });
  }
}

// ── 3. Backend unit tests ─────────────────────────────────────────────────────

process.stdout.write('\n[3/5] Backend unit tests…\n');
const testOut  = run('npm --prefix server run test 2>&1');
const testPass = testOut.exitCode === 0;
addCheck('backend-tests', testPass, testOut.stdout);

if (!testPass) {
  const raw = testOut.stdout + testOut.stderr;

  // Vitest failure lines:  FAIL src/tests/routes.test.ts > suite > test name
  const FAIL_RE = /✗\s+(.+?)\n[\s\S]*?(?:AssertionError|Error):\s*(.+?)(?:\n|$)/g;
  for (const m of raw.matchAll(FAIL_RE)) {
    const msg = m[2].trim();
    addError({
      type:         'test-failure',
      severity:     'error',
      file:         'server/src/tests/',
      line:         null,
      col:          null,
      code:         null,
      route:        null,
      message:      `Test "${m[1]}" — ${msg}`,
      fix_category: inferTestFix(msg),
      suggestion:   testSuggestion(msg),
    });
  }

  // SQL column errors surfacing inside test output
  for (const m of raw.matchAll(/column ['""]?(\S+)['""]? does not exist/gi)) {
    addError({
      type:         'sql-error',
      severity:     'error',
      file:         'server/src/',
      line:         null,
      col:          null,
      code:         'PGERR',
      route:        null,
      message:      m[0],
      fix_category: 'missing-column',
      suggestion:   `Run: npm run bug:fix — will generate ALTER TABLE migration for ${m[1]}`,
    });
  }
}

// ── 4. Frontend build ─────────────────────────────────────────────────────────

process.stdout.write('\n[4/5] Frontend build…\n');
const buildOut  = run('npm --prefix client run build 2>&1');
const buildPass = buildOut.exitCode === 0;
addCheck('frontend-build', buildPass);

if (!buildPass) {
  const combined = buildOut.stdout + buildOut.stderr;
  const firstErr = combined.split('\n').find(l => /error/i.test(l)) ?? combined.slice(-300);
  addError({
    type:         'build',
    severity:     'error',
    file:         'client/',
    line:         null,
    col:          null,
    code:         null,
    route:        null,
    message:      `Frontend build failed: ${firstErr.trim()}`,
    fix_category: null,
    suggestion:   'Fix the TypeScript/import error shown above and retry.',
  });
}

// ── 5. API health checks ──────────────────────────────────────────────────────

process.stdout.write('\n[5/5] API health checks…\n');
const apiOut  = run('node scripts/check-api.mjs 2>&1');
const apiPass = apiOut.exitCode === 0;
addCheck('api-health', apiPass, apiOut.stdout);

if (!apiPass) {
  for (const m of (apiOut.stdout + apiOut.stderr).matchAll(/✗\s+(.+?):\s+(.+)/g)) {
    const msg = m[2].trim();
    addError({
      type:         'api-health',
      severity:     'error',
      file:         null,
      line:         null,
      col:          null,
      code:         null,
      route:        m[1],
      message:      msg,
      fix_category: inferApiFix(msg),
      suggestion:   apiSuggestion(msg),
    });
  }
}

// ── Finalise ──────────────────────────────────────────────────────────────────

report.summary.total    = report.errors.length;
report.summary.errors   = report.errors.filter(e => e.severity === 'error').length;
report.summary.warnings = report.errors.filter(e => e.severity === 'warning').length;
report.summary.all_pass = report.checks.every(c => c.pass);

mkdirSync(join(ROOT, 'test-results'), { recursive: true });
const reportPath = join(ROOT, 'bug-report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));

// ── Also write docs/BUG_REPORT.json with enriched format for Bug Control Center ─

const docsPath = join(ROOT, 'docs', 'BUG_REPORT.json');

// Read existing report to preserve first_seen timestamps
let existing = { bugs: [] };
if (existsSync(docsPath)) {
  try { existing = JSON.parse(readFileSync(docsPath, 'utf8')); } catch {}
}
const existingById = Object.fromEntries((existing.bugs ?? []).map(b => [b.id, b]));

const now = new Date().toISOString();

function mapSeverity(s) {
  if (s === 'error') return 'high';
  if (s === 'warning') return 'medium';
  return 'low';
}

function mapArea(type) {
  if (type === 'typescript' || type === 'build') return 'frontend';
  if (type === 'lint') return 'frontend';
  if (type === 'sql-error') return 'database';
  if (type === 'api-health') return 'backend';
  if (type === 'test-failure') return 'backend';
  return 'backend';
}

const bugs = report.errors.map(e => {
  const prior = existingById[e.id];
  return {
    id:           e.id,
    status:       prior?.status ?? 'open',
    severity:     mapSeverity(e.severity),
    area:         mapArea(e.type),
    type:         e.type,
    message:      e.message,
    file:         e.file ?? null,
    line:         e.line ?? null,
    route:        e.route ?? null,
    code:         e.code ?? null,
    fix_category: e.fix_category ?? null,
    suggestion:   e.suggestion ?? null,
    first_seen:   prior?.first_seen ?? now,
    last_seen:    now,
  };
});

const docsReport = {
  timestamp:  report.timestamp,
  git_sha:    report.git_sha,
  summary:    report.summary,
  checks:     report.checks.map(({ name, pass }) => ({ name, pass })),
  bugs,
};

writeFileSync(docsPath, JSON.stringify(docsReport, null, 2));

// ── Print summary ─────────────────────────────────────────────────────────────

const bar = '─'.repeat(60);
process.stdout.write(`\n${bar}\n`);
process.stdout.write(`Bug Report  ${report.timestamp}  (${report.git_sha})\n`);
process.stdout.write(`${bar}\n`);
for (const c of report.checks) process.stdout.write(`  ${c.pass ? '✓' : '✗'} ${c.name}\n`);
process.stdout.write(`${bar}\n`);

if (report.errors.length === 0) {
  process.stdout.write('  All clean — 0 errors.\n');
} else {
  process.stdout.write(`  ${report.summary.errors} error(s)  ${report.summary.warnings} warning(s)\n\n`);
  for (const e of report.errors) {
    const loc = e.file ? `[${e.file}${e.line ? ':' + e.line : ''}]` : `[${e.route ?? e.type}]`;
    process.stdout.write(`  ${loc} ${e.message}\n`);
    if (e.suggestion) process.stdout.write(`    → ${e.suggestion}\n`);
  }
}

process.stdout.write(`\nFull report: ${reportPath}\n\n`);
process.exit(report.summary.errors > 0 ? 1 : 0);

// ── Inference helpers ─────────────────────────────────────────────────────────

function tsFix(code) {
  if (['TS2531','TS2532','TS18047','TS18048'].includes(code)) return 'null-check';
  return null;
}

function tsSuggestion(code, msg) {
  if (['TS2531','TS2532','TS18047','TS18048'].includes(code))
    return 'Add null guard: `if (!x) return;`  or use optional chaining: `x?.prop`';
  if (code === 'TS2339') return `Property does not exist on type. Check type definition or add missing property.`;
  if (code === 'TS2345') return 'Type mismatch — argument type does not match parameter type.';
  if (code === 'TS2554') return 'Wrong number of arguments — check function signature.';
  return `TypeScript ${code}: ${msg}`;
}

function inferTestFix(msg) {
  if (/column.+does not exist/i.test(msg))   return 'missing-column';
  if (/relation.+does not exist/i.test(msg)) return 'missing-table';
  if (/404|route not found/i.test(msg))      return 'undefined-route';
  return null;
}

function testSuggestion(msg) {
  if (/column.+does not exist/i.test(msg)) {
    const col = msg.match(/column ['""]?(\S+)['""]?/i)?.[1] ?? '?';
    return `Missing column ${col} — run: npm run bug:fix`;
  }
  if (/404/i.test(msg)) return 'Route missing — check route file registration.';
  return 'Review assertion failure above.';
}

function inferApiFix(msg) {
  if (/column.+does not exist/i.test(msg))   return 'missing-column';
  if (/relation.+does not exist/i.test(msg)) return 'missing-table';
  if (/404|not found/i.test(msg))            return 'undefined-route';
  return null;
}

function apiSuggestion(msg) {
  if (/column.+does not exist/i.test(msg)) return 'Run: npm run bug:fix — generates ALTER TABLE migration.';
  if (/relation.+does not exist/i.test(msg)) return 'Table is missing — check server/src/db/migrate.ts.';
  if (/ECONNREFUSED|timeout|unreachable/i.test(msg)) return 'Server unreachable — check Railway deployment.';
  if (/401/i.test(msg)) return 'Auth required — endpoint needs a valid JWT.';
  if (/media_url leaked/i.test(msg)) return 'media_url is not being stripped — check GET /api/content/:id handler.';
  return 'Review API response above.';
}
