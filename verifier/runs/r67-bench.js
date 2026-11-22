#!/usr/bin/env node
// r67-bench.js — round-67 (T6/T7/T9): adversarial benchmark gate for the two
// linearized PGN parsers. Linearity is a BEHAVIORAL property — the v3 text
// sentinels (V3-45) are tripwires against regression to the known-bad forms;
// this harness makes the time bound itself executable. It extracts the
// SHIPPED implementations verbatim from the tree, checks the isomorphic-twin
// invariant (tablebase.js and stats.html must carry byte-identical
// _pgnFirstGameSplit bodies), and fails (exit 1) when any adversarial case
// exceeds BOUND_MS. Run by r62-negative-tests.sh as gate N8; also runnable
// standalone: node verifier/runs/r67-bench.js
//
// round-68 hardening (T1/T2/T3, CodeRabbit r67 outside-diff #1/#2):
//   T1 — the round-67 case-1 input was the escaping accident `' \\n'` (space,
//        backslash, letter n): NO real newline, so the case exercised nothing
//        and the gate was green for a case that tested nothing (false green).
//        Fixed to `' \n'`, and every case now carries an input SPEC whose
//        invariants are asserted by a meta check BEFORE benching (a case
//        whose declared class requires real newlines fails loudly when its
//        input contains none) — the benchmark's own inputs are guarded.
//   T2 — the round-67 harness called fn() synchronously and only checked
//        BOUND_MS after it returned: a regressed parser that ran for minutes
//        stalled the gate for minutes, and one that never returned made the
//        gate pass forever. Each case now runs in a CHILD process
//        (--case <name>); the parent spawns children serially with a hard
//        timeout (BOUND_MS*3), SIGKILLs the offender, reports the case name,
//        and fails the gate. Verdict = exit code + success marker (dual
//        proof, same as the r62 gate's N8 wiring).
//   T3 — the r62-negative-tests.sh gates N8a/N8b prove this harness RED on
//        the known-bad forms (round-66 lookbehind splitter, per-candidate
//        ']' rescan scanner); N8c proves the meta check fires on the
//        escaping accident; N8d proves the parent kills a dead-loop case.
//
// Bound rationale (round67-audit.md §T8): worst observed case in the round-67
// sandbox was ~294ms ([FEN + 10MB spaces]); BOUND_MS = 1000ms keeps >3x
// headroom for slower machines while still failing ANY quadratic regression —
// the round-66 forms cost minutes at these exact input sizes (N8a/N8b make
// that claim executable instead of remembered).
//
// Copyright (C) 2026 Regalia
//
// AI-GEN: AI assisted
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const BOUND_MS = 1000;
const HARD_TIMEOUT_MS = BOUND_MS * 3; // parent kills a hung/regressed case
const N = 200000; // ~1.6-3.2MB adversarial inputs

let failures = 0;
function ok(msg) { console.log('ok: ' + msg); }
function fail(msg) { failures++; console.log('FAIL: ' + msg); }

function readTree(rel) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) { fail('missing file: ' + rel); return ''; }
  return fs.readFileSync(f, 'utf8');
}

// ---- case table -----------------------------------------------------------
// spec = the input-class invariants each case DECLARES about its own input;
// metaCheck() asserts them before benching (T1). A case whose class requires
// real newlines but whose built input contains none (the `' \\n'` escaping
// accident) fails the meta check and the gate — the benchmark input itself
// is guarded, not assumed.
const CASES = [
  // Splitter (r66-#2/#3 quadratic classes). Case 1 is the round-67 escaping
  // accident, fixed round-68: 100k space-blank LINES (space + real newline).
  { name: 'split: 100k space-blank pairs, no [', kind: 'split',
    spec: { realNewline: true, bracket: false },
    build: () => ' \n'.repeat(100000) },
  { name: 'split: 1M newlines', kind: 'split',
    spec: { realNewline: true },
    build: () => '\n'.repeat(1000000) },
  { name: 'split: 10MB single line', kind: 'split',
    spec: { realNewline: false },
    build: () => 'a'.repeat(10 * 1024 * 1024) },
  { name: 'split: 50k real games', kind: 'split',
    spec: { realNewline: true, bracket: true },
    build: () => '[Event "x"]\n\n'.repeat(50000) },
  // Header scanner (r66-#4 quadratic classes).
  { name: 'scan: [Event x x' + N + ' (no ])', kind: 'scan',
    spec: { closeBracket: false },
    build: () => '[Event x'.repeat(N) },
  { name: 'scan: [Event x\\n x' + N + ' + ]', kind: 'scan',
    spec: { realNewline: true, closeBracket: true },
    build: () => ('[Event x\n'.repeat(N)) + ']' },
  { name: 'scan: [A x' + N + ' + \\n + 1M spaces + ]', kind: 'scan',
    spec: { realNewline: true, closeBracket: true },
    build: () => ('[A '.repeat(N)) + '\n' + ' '.repeat(1000000) + ']' },
  { name: 'scan: quote-heavy x' + N, kind: 'scan',
    spec: { closeBracket: false },
    build: () => '"[E "a'.repeat(N) },
  { name: 'scan: [FEN + 10MB spaces (no ])', kind: 'scan',
    spec: { closeBracket: false },
    build: () => '[FEN ' + ' '.repeat(10 * 1024 * 1024) },
  { name: 'scan: 10MB single-line mixed tags', kind: 'scan',
    spec: { realNewline: false, bracket: true, closeBracket: true },
    build: () => '[Event "a"] [Site "b"] '.repeat(280000) },
];
// CASES-END (N8d negative anchor: a dead-loop case is inserted right before
// this marker in a mutated copy — do not move or delete this comment)

// Input meta check (T1): assert the built input satisfies the invariants the
// case's class declares. Failing this is a GATE failure, not a skip.
function metaCheck(c, input) {
  if (c.spec.realNewline === true && input.indexOf('\n') === -1) {
    fail('meta ' + c.name + ': input class requires real newlines but the built input contains none (escaping accident, e.g. \' \\n\' vs \' \n\'?)');
    return false;
  }
  if (c.spec.realNewline === false && input.indexOf('\n') !== -1) {
    fail('meta ' + c.name + ': input class is newline-free but the built input contains a real newline');
    return false;
  }
  if (c.spec.bracket === true && input.indexOf('[') === -1) {
    fail('meta ' + c.name + ': input class requires a \'[\' but the built input contains none');
    return false;
  }
  if (c.spec.bracket === false && input.indexOf('[') !== -1) {
    fail('meta ' + c.name + ': input class must be \'[\'-free but the built input contains one');
    return false;
  }
  if (c.spec.closeBracket === false && input.indexOf(']') !== -1) {
    fail('meta ' + c.name + ': input class must be \']\'-free but the built input contains one');
    return false;
  }
  return true;
}

// ---- verbatim extraction (read-only; never writes the tree) ---------------
// Isomorphic-twin invariant (V3-45 pins the same property textually; this is
// the runtime re-check on the extracted bodies).
const fnRe = /function _pgnFirstGameSplit\(text\)\{[\s\S]*?\n\}/;
// The header scanner block: from the cache decls to the "Extract FEN" anchor.
const scanRe = /  let _hs=0;\n  let _nb=text\.indexOf\('\]'\),_nbFrom=0,_nbWs=-1;[\s\S]*?\n  \}\n(?=  \/\/ Extract FEN if present)/;

function extractSplitFn() {
  const tb = readTree('src/main/assets/chess.src/tablebase.js');
  const m = tb.match(fnRe);
  if (!m) { fail('_pgnFirstGameSplit not found in tablebase.js'); return null; }
  return new Function('text', 'return (' + m[0] + ')(text);');
}

function extractScanFn() {
  const st = readTree('src/main/assets/stats.html');
  const m = st.match(scanRe);
  if (!m) { fail('monotonic-cache header scanner block not found in stats.html'); return null; }
  if (!/const _nextClose=\(from\)=>\{/.test(m[0]) || !/const _nextNl=\(from\)=>\{/.test(m[0])) {
    fail('scanner block is missing the monotonic cache helpers');
    return null;
  }
  return new Function('text', 'const headers={};\n' + m[0] + '\nreturn headers;');
}

// ---- child mode: run ONE case, enforce the bound locally too --------------
function runChildCase(c) {
  let input;
  try {
    input = c.build();
  } catch (e) {
    fail('bench ' + c.name + ': input build threw: ' + e.message);
    process.exit(1);
  }
  if (!metaCheck(c, input)) process.exit(1);
  const fn = c.kind === 'split' ? extractSplitFn() : extractScanFn();
  if (!fn) process.exit(1);
  const t0 = process.hrtime.bigint();
  fn(input);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (ms >= BOUND_MS) {
    fail('bench ' + c.name + ': ' + ms.toFixed(1) + 'ms >= bound ' + BOUND_MS + 'ms');
    process.exit(1);
  }
  console.log('ok: bench ' + c.name + ': ' + ms.toFixed(1) + 'ms (bound ' + BOUND_MS + 'ms)');
  process.exit(0);
}

// ---- parent mode -----------------------------------------------------------
function spawnCase(c) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [__filename, '--case', c.name],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    let killed = false;
    const killer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, HARD_TIMEOUT_MS);
    child.stdout.on('data', (d) => process.stdout.write(d));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('error', (err) => {
      clearTimeout(killer);
      fail('bench ' + c.name + ': child spawn failed: ' + err.message);
      resolve(false);
    });
    child.on('close', (code) => {
      clearTimeout(killer);
      if (killed) {
        fail('bench ' + c.name + ': child exceeded ' + HARD_TIMEOUT_MS +
             'ms hard timeout — killed (parser regression to a super-linear/hanging form?)');
        resolve(false);
      } else if (code !== 0) {
        failures++; // the child already printed its own FAIL line
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function main() {
  const argIdx = process.argv.indexOf('--case');
  if (argIdx !== -1) {
    const name = process.argv[argIdx + 1];
    const c = CASES.find((x) => x.name === name);
    if (!c) { fail('no such case: ' + name); process.exit(1); }
    runChildCase(c);
    return;
  }

  // Parent: structural checks first (fail-closed before any timing run).
  const tb = readTree('src/main/assets/chess.src/tablebase.js');
  const st = readTree('src/main/assets/stats.html');
  const tbFn = tb.match(fnRe);
  const stFn = st.match(fnRe);
  if (!tbFn || !stFn) {
    fail('_pgnFirstGameSplit not found in ' + (!tbFn ? 'tablebase.js' : 'stats.html'));
  } else if (tbFn[0] !== stFn[0]) {
    fail('twin _pgnFirstGameSplit bodies differ between tablebase.js and stats.html');
  } else {
    ok('twin _pgnFirstGameSplit bodies byte-identical (' + tbFn[0].length + ' chars)');
  }
  const stScan = st.match(scanRe);
  if (!stScan) {
    fail('monotonic-cache header scanner block not found in stats.html');
  } else if (!/const _nextClose=\(from\)=>\{/.test(stScan[0]) || !/const _nextNl=\(from\)=>\{/.test(stScan[0])) {
    fail('scanner block is missing the monotonic cache helpers');
  } else {
    ok('monotonic-cache scanner block extracted verbatim from stats.html');
  }
  if (failures > 0) {
    console.log('R67-BENCH FAILED: ' + failures);
    process.exit(1);
  }

  // Serial children — one case per process, each under the parent's hard
  // timeout (T2). A hung child is killed and NAMED; the gate cannot be
  // stalled past HARD_TIMEOUT_MS per case, and can never hang forever.
  for (const c of CASES) {
    await spawnCase(c);
  }

  console.log(failures === 0 ? 'R67-BENCH OK' : 'R67-BENCH FAILED: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { fail('harness error: ' + (e && e.stack || e)); process.exit(1); });
