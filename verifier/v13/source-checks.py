#!/usr/bin/env python3
"""Round-77 static wiring, metadata and compatibility-boundary checks."""
import pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[2]
checks=[]
def check(ok,label):
    checks.append((label,bool(ok)))
def read(rel): return (ROOT/rel).read_text(encoding='utf-8')

atomic_path=ROOT/'src/main/java/com/Regalia/AtomicFileStore.java'
atomic=atomic_path.read_text(encoding='utf-8') if atomic_path.exists() else ''
stock=read('src/main/java/com/Regalia/StockfishNative.java')
pgn=read('src/main/java/com/Regalia/PgnCacheManager.java')
js=read('src/main/assets/chess.src/ai-bridge.js')
build=read('build-chess.py')

check('File.createTempFile(' in atomic,'unique same-directory temporary file')
check('FileOutputStream' in atomic and '.getFD().sync()' in atomic and 'writer.flush()' in atomic,'flush and file-descriptor sync')
check('android.system.Os' in atomic and 'Os.rename(' in atomic,'API-23 atomic rename')
check('java.nio.file' not in atomic and 'finalFile.delete()' not in stock,'no NIO-only path or delete-before-replace')
check(stock.count('AtomicFileStore.writeUtf8')==1,'eval cache uses shared writer')
check(pgn.count('AtomicFileStore.writeUtf8')==3,'PGN save and both tags writes use shared writer')
check('public boolean persistentSetSync(String key, String value)' in stock,'synchronous preference API returns result')
check('return editor.commit();' in stock,'commit result is propagated')
check('public void persistentSetSync' not in stock,'old void preference API removed')
check('_writeToDiskNow()' in js and 'return fileOk||legacyOk;' in js,'JS returns durable backend result')
check('let fileOk=false,legacyOk=false;' in js,'file and legacy outcomes tracked independently')
check(js.count('_writeToDiskNow())_dirty=false;')==3,'all three dirty clears require durable success')
check('else _dirty=true;' in js,'forced clear failure retains dirty')
check('mkstemp(' in build and "OUT + \".tmp\"" not in build and 'OUT+".tmp"' not in build,'web builder uses unique temporary names')
check('src/main/jniLibs/' in read('.gitignore'),'engine payload remains excluded')
check((ROOT/'.github/dependabot.yml').is_file(),'Dependabot metadata restored')
check('language: c-cpp' in read('.github/workflows/codeql.yml') and 'build-mode: none' in read('.github/workflows/codeql.yml'),'CodeQL native no-build coverage restored')
check('persist-credentials: false' in read('.github/workflows/codeql.yml'),'CodeQL checkout credentials disabled')
check('mobsfscan==1.2.0' in read('.github/workflows/mobsf.yml'),'MobSF tool version pinned')
check((ROOT/'gradlew').stat().st_mode & 0o111,'gradlew executable on disk')
mode=subprocess.check_output(['git','ls-files','-s','gradlew'],cwd=ROOT,text=True).split()[0]
check(mode=='100755','gradlew executable in Git index')
check('AtomicFileStore.java' in read('src/main/java/com/Regalia/README.license'),'new Java file added to per-file license ledger')
check('java/*.java (16 files' in read('src/main/README.license'),'top-level Java count updated to 16')
engine_rel='src/main/jniLibs/arm64-v8a/libstockfish.so'
engine_path=ROOT/engine_rel
tracked=subprocess.check_output(['git','ls-files','--',engine_rel],cwd=ROOT,text=True).strip()
ignored=subprocess.run(['git','check-ignore','-q',engine_rel],cwd=ROOT).returncode==0
check(not engine_path.exists() or (not tracked and ignored),'engine build input absent or untracked and ignored')

for label,ok in checks: print(('PASS ' if ok else 'FAIL ')+label)
print('source-checks passed=%d total=%d'%(sum(ok for _,ok in checks),len(checks)))
if not all(ok for _,ok in checks): sys.exit(1)
