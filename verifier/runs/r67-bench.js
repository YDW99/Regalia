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
// Bound rationale (round67-audit.md §T8): worst observed case in the round-67
// sandbox was ~294ms ([FEN + 10MB spaces]); BOUND_MS = 1000ms keeps >3x
// headroom for slower machines while still failing ANY quadratic regression —
// the round-66 forms cost minutes at these exact input sizes.
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

const ROOT = path.join(__dirname, '..', '..');
const BOUND_MS = 1000;
const N = 200000; // ~1.6-3.2MB adversarial inputs

let failures = 0;
function ok(msg) { console.log('ok: ' + msg); }
function fail(msg) { failures++; console.log('FAIL: ' + msg); }

function readTree(rel) {
  const f = path.join(ROOT, rel);
  if (!fs.existsSync(f)) { fail('missing file: ' + rel); return ''; }
  return fs.readFileSync(f, 'utf8');
}

const tb = readTree('src/main/assets/chess.src/tablebase.js');
const st = readTree('src/main/assets/stats.html');

// Isomorphic-twin invariant (V3-45 pins the same property textually; this is
// the runtime re-check on the extracted bodies).
const fnRe = /function _pgnFirstGameSplit\(text\)\{[\s\S]*?\n\}/;
const tbFn = tb.match(fnRe);
const stFn = st.match(fnRe);
if (!tbFn || !stFn) {
  fail('_pgnFirstGameSplit not found in ' + (!tbFn ? 'tablebase.js' : 'stats.html'));
} else if (tbFn[0] !== stFn[0]) {
  fail('twin _pgnFirstGameSplit bodies differ between tablebase.js and stats.html');
} else {
  ok('twin _pgnFirstGameSplit bodies byte-identical (' + tbFn[0].length + ' chars)');
}
const splitFn = tbFn ? new Function('text', 'return (' + tbFn[0] + ')(text);') : null;

// The header scanner block: from the cache decls to the "Extract FEN" anchor.
const scanRe = /  let _hs=0;\n  let _nb=text\.indexOf\('\]'\),_nbFrom=0,_nbWs=-1;[\s\S]*?\n  \}\n(?=  \/\/ Extract FEN if present)/;
const stScan = st.match(scanRe);
if (!stScan) {
  fail('monotonic-cache header scanner block not found in stats.html');
} else if (!/const _nextClose=\(from\)=>\{/.test(stScan[0]) || !/const _nextNl=\(from\)=>\{/.test(stScan[0])) {
  fail('scanner block is missing the monotonic cache helpers');
} else {
  ok('monotonic-cache scanner block extracted verbatim from stats.html');
}
const scanFn = stScan ? new Function('text', 'const headers={};\n' + stScan[0] + '\nreturn headers;') : null;

function bench(name, fn) {
  if (!fn) { fail('bench ' + name + ' skipped (extraction failed)'); return; }
  const t0 = process.hrtime.bigint();
  fn();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (ms >= BOUND_MS) fail('bench ' + name + ': ' + ms.toFixed(1) + 'ms >= bound ' + BOUND_MS + 'ms');
  else console.log('ok: bench ' + name + ': ' + ms.toFixed(1) + 'ms (bound ' + BOUND_MS + 'ms)');
}

// Splitter (T6): the CodeRabbit r66-#2/#3 quadratic classes.
bench('split: 100k space-blank pairs, no [', () => splitFn(' \\n'.repeat(100000)));
bench('split: 1M newlines', () => splitFn('\n'.repeat(1000000)));
bench('split: 10MB single line', () => splitFn('a'.repeat(10 * 1024 * 1024)));
bench('split: 50k real games', () => splitFn('[Event "x"]\n\n'.repeat(50000)));

// Header scanner (T7): the CodeRabbit r66-#4 quadratic classes.
bench('scan: [Event x x' + N + ' (no ])', () => scanFn('[Event x'.repeat(N)));
bench('scan: [Event x\\n x' + N + ' + ]', () => scanFn(('[Event x\n'.repeat(N)) + ']'));
bench('scan: [A x' + N + ' + \\n + 1M spaces + ]', () => scanFn(('[A '.repeat(N)) + '\n' + ' '.repeat(1000000) + ']'));
bench('scan: quote-heavy x' + N, () => scanFn('"[E "a'.repeat(N)));
bench('scan: [FEN + 10MB spaces (no ])', () => scanFn('[FEN ' + ' '.repeat(10 * 1024 * 1024)));
bench('scan: 10MB single-line mixed tags', () => scanFn('[Event "a"] [Site "b"] '.repeat(280000)));

console.log(failures === 0 ? 'R67-BENCH OK' : 'R67-BENCH FAILED: ' + failures);
process.exit(failures === 0 ? 0 : 1);
