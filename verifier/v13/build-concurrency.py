#!/usr/bin/env python3
"""Stress the real web builder with forty concurrent process pairs."""
from pathlib import Path
import hashlib, subprocess, sys
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'src/main/assets/chess.html'
BUILD=ROOT/'build-chess.py'
def digest(): return hashlib.sha256(OUT.read_bytes()).hexdigest()
def run():
    return subprocess.run([sys.executable,str(BUILD)],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,check=False)
def temps(): return sorted(p.name for p in OUT.parent.glob('chess.html*.tmp'))
# Establish a baseline from the current sources, not from a historical bundle hash.
first=run(); second=run()
if first.returncode or second.returncode:
    print(first.stdout);print(second.stdout);raise SystemExit('sequential baseline build failed')
baseline=digest()
if digest()!=baseline: raise SystemExit('sequential digest mismatch')
failures=[];processes=0
for pair in range(40):
    ps=[subprocess.Popen([sys.executable,str(BUILD)],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT) for _ in range(2)]
    for p in ps:
        output,_=p.communicate();processes+=1
        if p.returncode:
            failures.append((pair,p.returncode,output[-1200:]))
if failures:
    for item in failures[:8]: print('FAILED_PAIR',item)
leftover=temps()
final_hash=digest()
last=run()
if last.returncode: failures.append(('final',last.returncode,last.stdout[-1200:]))
ok=not failures and not leftover and final_hash==baseline and digest()==baseline
print(f'concurrent_pairs=40 processes={processes} failures={len(failures)}')
print(f'bundle_sha256={baseline} deterministic={final_hash==baseline and digest()==baseline}')
print(f'temporary_residuals={len(leftover)}')
print('BUILD-CONCURRENCY-V13 '+('OK' if ok else 'FAIL'))
raise SystemExit(0 if ok else 1)
