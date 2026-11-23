#!/usr/bin/env node
/* Exercise the real eval-cache closure with deterministic in-memory backends. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'src/main/assets/chess.src/ai-bridge.js'),'utf8');
const start=source.indexOf('let _reviewEvalCache=new function(){');
const endMarker='}();\n// v1.0.4 Round-5 Rev20: Expose';
const end=source.indexOf(endMarker,start);
if(start<0||end<0)throw new Error('cache closure anchors not found');
let closure=source.slice(start,end+4);
closure=closure.replace('let _dirty=false;','let _dirty=false; this._isDirty=()=>_dirty;');
if(!closure.includes('this._isDirty'))throw new Error('dirty instrumentation failed');
let passed=0,total=0;
function check(ok,label){total++;if(!ok){console.log('FAIL '+label);process.exitCode=1;}else{passed++;console.log('PASS '+label);}}
function make(opts={}){
  const timers=new Map();let nextTimer=1;const calls={file:0,legacy:0,local:0};
  const localStorage={getItem:()=>null,setItem:()=>{calls.local++;if(opts.local==='throw')throw new Error('local');}};
  const bridge={loadEvalCacheSync:()=>null,persistentGet:()=>null};
  if(opts.file!==undefined){bridge.saveEvalCacheSync=()=>{calls.file++;if(opts.file==='throw')throw new Error('file');return opts.file;};}
  if(opts.legacy!==undefined){bridge.persistentSetSync=()=>{calls.legacy++;if(opts.legacy==='throw')throw new Error('legacy');return opts.legacy;};}
  const ctx=vm.createContext({console:{warn:()=>{}},localStorage,_batchWriteMode:false,_reviewEvalRequestedStep:-1,
    setTimeout:fn=>{const id=nextTimer++;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
  if(opts.bridge!==false)ctx.AndroidBridge=bridge;
  vm.runInContext(closure,ctx,{filename:'ai-bridge-cache.closure.js'});
  const cache=vm.runInContext('_reviewEvalCache',ctx);
  return {cache,calls,timers,set:(name,value)=>{opts[name]=value;},runTimer:()=>{const first=timers.entries().next();if(first.done)return false;const [id,fn]=first.value;timers.delete(id);fn();return true;}};
}
{
  const x=make({file:true,legacy:true});x.cache.clear();check(!x.cache._isDirty(),'file success clears forced dirty');
  check(x.calls.file===1&&x.calls.legacy===0,'file success skips legacy fallback');
}
{
  const x=make({file:false,legacy:true});x.cache.clear();check(!x.cache._isDirty()&&x.calls.legacy===1,'synchronous legacy success clears after file failure');
}
{
  const x=make({file:'throw',legacy:true});x.cache.clear();check(!x.cache._isDirty(),'legacy success clears after file exception');
}
{
  const x=make({file:false,legacy:false});x.cache.clear();check(x.cache._isDirty(),'all durable backends false retain dirty');
}
{
  const x=make({bridge:false});x.cache.clear();check(x.cache._isDirty()&&x.calls.local===1,'localStorage-only success is not durable');
}
{
  const x=make({file:true,local:'throw'});x.cache.clear();check(!x.cache._isDirty(),'localStorage failure does not negate file success');
}
{
  const x=make({file:false,legacy:false,local:'throw'});x.cache.clear();check(x.cache._isDirty(),'all write failures retain dirty');
}
{
  const x=make({file:1});x.cache.clear();check(x.cache._isDirty(),'truthy non-boolean file result is rejected');
}
{
  const x=make({file:false,legacy:1});x.cache.clear();check(x.cache._isDirty(),'truthy non-boolean legacy result is rejected');
}
{
  const x=make({file:false,legacy:false});x.cache.clear();const before=x.calls.file;x.set('file',true);x.cache._flushSync();check(!x.cache._isDirty()&&x.calls.file===before+1,'later flush retries and clears on durable success');
}
{
  const x=make({file:'throw',legacy:'throw'});x.cache.clear();const writes=x.calls.file;x.cache._flushSync();check(x.cache._isDirty()&&x.calls.file===writes+1,'exceptions are retryable on a later flush');
}
{
  const x=make({file:true});x.cache.set(1,{cp:10});const dirtyBefore=x.cache._isDirty();const ran=x.runTimer();check(dirtyBefore&&ran&&!x.cache._isDirty(),'debounce success clears only after write');
}
{
  const x=make({file:false,legacy:false});x.cache.set(1,{cp:10});x.runTimer();check(x.cache._isDirty(),'debounce failure retains dirty');
}
{
  const x=make({file:true});x.cache._flushSync();check(x.calls.file===0&&x.calls.local===0,'clean flush performs no redundant write');
}
{
  const x=make({file:true});x.cache.set(1,{cp:10});x.cache._flushSync();check(x.calls.file===1&&x.timers.size===0&&!x.cache._isDirty(),'flush cancels timer and writes once');
}
{
  const x=make({legacy:true});x.cache.clear();check(!x.cache._isDirty()&&x.calls.legacy===1,'legacy backend works when file API is absent');
}
{
  const x=make({file:false});x.cache.clear();check(x.cache._isDirty(),'file failure without legacy API retains dirty');
}
{
  const x=make({file:false,legacy:false});x.cache.clear();x.cache.set(2,{cp:20});x.runTimer();check(x.cache._isDirty()&&x.calls.file===2,'a later mutation retries after forced failure');
}
console.log(`eval-persistence passed=${passed} total=${total}`);
