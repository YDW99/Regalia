#!/usr/bin/env python3
"""Syntax-check real JS modules, generated inline script and v13 Python gates."""
from html.parser import HTMLParser
from pathlib import Path
import os,py_compile,re,subprocess,sys,tempfile
ROOT=Path(__file__).resolve().parents[2]
MODULES=['game-logic.js','chess960.js','pgn-standard.js','state-store.js','ai-bridge.js','tablebase.js','eco-data.js','ui-gameflow.js','ui-interactions.js','ui.js']
class Scripts(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=False);self.active=False;self.current=[];self.scripts=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=='script' and not dict(attrs).get('src'):
            self.active=True;self.current=[]
    def handle_endtag(self,tag):
        if tag.lower()=='script' and self.active:
            self.scripts.append(''.join(self.current));self.active=False
    def handle_data(self,data):
        if self.active:self.current.append(data)
with tempfile.TemporaryDirectory(prefix='regalia-r77-syntax-') as tmp:
    tmp=Path(tmp)
    targets=[ROOT/'src/main/assets/chess.src'/m for m in MODULES]
    parser=Scripts();parser.feed((ROOT/'src/main/assets/chess.html').read_text(encoding='utf-8'));parser.close()
    if len(parser.scripts)!=1: raise SystemExit(f'expected one generated inline script, got {len(parser.scripts)}')
    inline=tmp/'chess-inline.js';inline.write_text(parser.scripts[0],encoding='utf-8');targets.append(inline)
    for target in targets:
        subprocess.run(['node','--check',str(target)],check=True)
        print(f'PASS JS {target.name}')
    env=os.environ.copy();env['PYTHONPYCACHEPREFIX']=str(tmp/'pycache')
    pyfiles=sorted((ROOT/'verifier/v13').glob('*.py'))
    for target in pyfiles:
        subprocess.run([sys.executable,'-m','py_compile',str(target)],check=True,env=env)
        print(f'PASS PY {target.name}')
    print(f'SYNTAX-V13 OK js_modules={len(MODULES)} inline_scripts=1 python_files={len(pyfiles)}')
