#!/usr/bin/env python3
"""Compile and exercise the production atomic writer with host-only Android stubs."""
from pathlib import Path
import os, subprocess, tempfile, textwrap
ROOT=Path(__file__).resolve().parents[2]
PRODUCTION=ROOT/'src/main/java/com/Regalia/AtomicFileStore.java'
if not PRODUCTION.is_file():
    raise SystemExit('FAIL production AtomicFileStore.java is missing')

STUB_OS='''package android.system;
import java.io.File;
import java.io.IOException;
public final class Os {
  public static volatile boolean failNextRename=false;
  public static void rename(String oldPath,String newPath) throws ErrnoException {
    if(failNextRename){failNextRename=false;throw new ErrnoException("injected rename failure",1);}
    try{java.nio.file.Files.move(new File(oldPath).toPath(),new File(newPath).toPath(),java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);}
    catch(IOException e){throw new ErrnoException(e.toString(),1);}
  }
}
'''
STUB_ERRNO='''package android.system;
public class ErrnoException extends Exception {
  public ErrnoException(String message,int errno){super(message);}
}
'''
HARNESS='''package com.Regalia;
import android.system.Os;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
public final class AtomicFileStoreHarness {
  static int passed=0,total=0;
  static void check(boolean ok,String label){total++;if(!ok)throw new AssertionError(label);passed++;System.out.println("PASS "+label);}
  static String read(File f)throws Exception{return new String(Files.readAllBytes(f.toPath()),StandardCharsets.UTF_8);}
  static boolean noTemps(File dir){String[] names=dir.list();if(names==null)return false;for(String n:names)if(n.endsWith(".tmp"))return false;return true;}
  public static void main(String[] args)throws Exception{
    File dir=new File(args[0]);File target=new File(dir,"cache.json");
    AtomicFileStore.writeUtf8(target,"first");
    check(target.isFile()&&read(target).equals("first"),"new file");
    AtomicFileStore.writeUtf8(target,"second");
    check(read(target).equals("second"),"overwrite");
    String unicode="开局 ♞ ♜ 😀\\n雪";
    AtomicFileStore.writeUtf8(target,unicode);
    check(read(target).equals(unicode),"Unicode UTF-8 round trip");
    Os.failNextRename=true;boolean failed=false;
    try{AtomicFileStore.writeUtf8(target,"must-not-replace");}catch(java.io.IOException expected){failed=true;}
    check(failed,"injected rename failure surfaces");
    check(read(target).equals(unicode),"failed replacement preserves old bytes");
    check(noTemps(dir),"failed replacement cleans owned temporary file");
    ExecutorService pool=Executors.newFixedThreadPool(8);List<Future<Void>> futures=new ArrayList<>();
    for(int i=0;i<96;i++){final int n=i;futures.add(pool.submit(new Callable<Void>(){public Void call()throws Exception{AtomicFileStore.writeUtf8(target,"value-"+n+"-雪");return null;}}));}
    boolean all=true;for(Future<Void> f:futures){try{f.get();}catch(Exception e){all=false;e.printStackTrace(System.out);}}
    pool.shutdown();check(all,"96 concurrent writes all succeed");
    String finalValue=read(target);boolean valid=false;
    for(int i=0;i<96;i++)if(finalValue.equals("value-"+i+"-雪"))valid=true;
    check(valid,"concurrent result is one complete payload");
    check(noTemps(dir),"concurrent writes leave no temporary files");
    boolean nullRejected=false;try{AtomicFileStore.writeUtf8(target,null);}catch(NullPointerException expected){nullRejected=true;}
    check(nullRejected&&read(target).equals(finalValue),"null input rejected without damage");
    boolean parentRejected=false;try{AtomicFileStore.writeUtf8(new File(new File(dir,"missing"),"x"),"x");}catch(java.io.IOException expected){parentRejected=true;}
    check(parentRejected&&read(target).equals(finalValue),"missing parent rejected without damage");
    System.out.println("atomic-checks passed="+passed+" total="+total+" concurrent_writes=96");
  }
}
'''
with tempfile.TemporaryDirectory(prefix='regalia-r77-atomic-') as tmp:
    base=Path(tmp); src=base/'src'; classes=base/'classes'; work=base/'work'
    (src/'android/system').mkdir(parents=True); (src/'com/Regalia').mkdir(parents=True); classes.mkdir(); work.mkdir()
    (src/'android/system/Os.java').write_text(STUB_OS,encoding='utf-8')
    (src/'android/system/ErrnoException.java').write_text(STUB_ERRNO,encoding='utf-8')
    (src/'com/Regalia/AtomicFileStoreHarness.java').write_text(HARNESS,encoding='utf-8')
    sources=[str(PRODUCTION),str(src/'android/system/Os.java'),str(src/'android/system/ErrnoException.java'),str(src/'com/Regalia/AtomicFileStoreHarness.java')]
    subprocess.run(['javac','-encoding','UTF-8','-d',str(classes),*sources],check=True)
    subprocess.run(['java','-cp',str(classes),'com.Regalia.AtomicFileStoreHarness',str(work)],check=True)
